/**
 * CATALYST — src/app/api/t212/route.js
 *
 * READ-ONLY connection to Trading 212 API.
 * NEVER places, modifies or cancels any orders.
 *
 * Grouping logic:
 * - Fetches /equity/pies to get pie names and their instruments
 * - Builds tickerToPie map from pie instruments
 * - If a position has pieQuantity == quantity → entirely in a pie
 * - If pieQuantity > 0 AND directQty > 0 → split into pie + direct entry
 * - If pieQuantity == 0 → direct holding
 */

import { NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

const T212_KEY    = process.env.TRADING212_API_KEY
const T212_SECRET = process.env.TRADING212_API_SECRET
const IS_DEMO     = process.env.TRADING212_DEMO === 'true'
const T212_BASE   = IS_DEMO
  ? 'https://demo.trading212.com/api/v0'
  : 'https://live.trading212.com/api/v0'

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache' }

function resp(body, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

function buildAuthHeader() {
  const creds = T212_KEY + ':' + T212_SECRET
  return 'Basic ' + Buffer.from(creds).toString('base64')
}

async function t212(path, timeoutMs = 7000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${T212_BASE}${path}`, {
      headers: { 'Authorization': buildAuthHeader(), 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (res.status === 401) throw new Error('T212 auth failed — check API key/secret in Vercel env vars.')
    if (res.status === 403) throw new Error('T212 API key lacks permission — regenerate with read permissions.')
    if (res.status === 429) throw new Error('T212 rate limit — wait a moment and retry.')
    if (!res.ok) throw new Error(`T212 API ${path} → ${res.status}`)
    return res.json()
  } catch(e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') throw new Error(`T212 timeout on ${path}`)
    throw e
  }
}

// Clean T212 ticker suffixes: NVDA_US_EQ → NVDA, ARMG_GBX_EQ → ARMG
// T212 format: TICKER_EXCHANGE_TYPE e.g. NVDA_US_EQ, ARMG_GBX_EQ
// We strip the exchange (_US, _GBX, _GBP, _LSE) and type (_EQ) suffixes
// but preserve tickers that have underscores as part of their name (MDA_CA)
function cleanTicker(raw) {
  if (!raw) return raw
  // Strip known patterns: _XX_EQ where XX is a 2-3 char exchange code
  let s = raw
  // Known exchange+equity suffix combos (most specific first)
  const patterns = [
    /_US_EQ$/, /_GBX_EQ$/, /_GBP_EQ$/, /_EUR_EQ$/,
    /_LSE_EQ$/, /_AMS_EQ$/, /_ETR_EQ$/, /_EPA_EQ$/,
    // After removing _EQ, also strip bare exchange suffixes
    /_EQ$/,    /_US$/,     /_GBX$/,    /_GBP$/,
  ]
  for (const p of patterns) { s = s.replace(p, '') }
  return s
}

export async function GET() {
  if (!T212_KEY || !T212_SECRET) {
    return resp({
      error: 'Trading 212 credentials not configured',
      missing: [!T212_KEY && 'TRADING212_API_KEY', !T212_SECRET && 'TRADING212_API_SECRET'].filter(Boolean),
      setup: [
        '1. T212 app → Settings → API (Beta) → Generate API key',
        '2. Copy BOTH the Key and the Secret (secret shown only once)',
        '3. Vercel → Settings → Environment Variables',
        '4. Add TRADING212_API_KEY and TRADING212_API_SECRET',
        '5. Redeploy',
      ],
    }, 500)
  }

  try {
    // Fetch everything in parallel
    const [portfolioRes, accountRes, ordersRes, piesRes] = await Promise.allSettled([
      t212('/equity/portfolio'),
      t212('/equity/account/cash'),
      t212('/equity/orders'),
      t212('/equity/pies'),
    ])

    // ── Raw positions ──────────────────────────────────────────────────────────
    const rawPositions = portfolioRes.status === 'fulfilled'
      ? (Array.isArray(portfolioRes.value) ? portfolioRes.value : [])
      : []

    // ── Pies — fetch full details for each ────────────────────────────────────
    let pies = []
    let tickerToPie = {}   // ticker → pie name (for positions entirely in one pie)
    let pieDataMap  = {}   // pie name → pie summary data

    if (piesRes.status === 'fulfilled') {
      const rawPies = Array.isArray(piesRes.value) ? piesRes.value : []

      // Fetch pie details in parallel — cap at 15 pies, 5s timeout each
      const piesToFetch = rawPies.slice(0, 15)
      const pieDetails = await Promise.allSettled(
        piesToFetch.map(p => t212(`/equity/pies/${p.id}`, 5000).catch(() => null))
      )

      pies = piesToFetch.map((pie, idx) => {
        const detail     = pieDetails[idx]?.status === 'fulfilled' ? pieDetails[idx].value : pie
        const result     = detail?.result     || {}
        const settings   = detail?.settings   || pie.settings || {}
        const pieName    = settings.name      || `Pie ${pie.id}`

        // Parse instruments — handle multiple possible field names from T212 API
        const instruments = (detail?.instruments || []).map(inst => {
          const rawTick = inst.ticker || inst.tickerSymbol || ''
          const ticker  = cleanTicker(rawTick)
          return {
            ticker,
            rawTicker:     rawTick,
            ownedQty:      parseFloat(inst.ownedQuantity   || inst.quantity    || 0),
            targetWeight:  parseFloat(inst.expectedShare   || inst.currentShare|| inst.targetWeight || 0),
            result: {
              value:         parseFloat(inst.result?.value         || 0),
              investedValue: parseFloat(inst.result?.investedValue || 0),
              ppl:           parseFloat(inst.result?.resultValue   || 0),
              gainPct:       parseFloat(inst.result?.resultCoeff != null
                ? inst.result.resultCoeff * 100 : 0),
            },
          }
        })

        // Map instruments to pie — use both cleaned ticker AND raw ticker
        // as fallback to handle any suffix mismatches
        instruments.forEach(inst => {
          if (inst.ticker)    tickerToPie[inst.ticker]    = pieName
          if (inst.rawTicker) tickerToPie[inst.rawTicker] = pieName
        })

        const pieObj = {
          id:            pie.id,
          name:          pieName,
          totalValue:    parseFloat(result.value          || detail?.cash || 0),
          investedValue: parseFloat(result.investedValue  || 0),
          ppl:           parseFloat(result.returnValue    || 0),
          gainPct:       parseFloat(result.returnPercent  || 0),
          cash:          parseFloat(detail?.cash          || 0),
          instruments,
        }

        pieDataMap[pieName] = pieObj
        return pieObj
      })
    }

    // ── Process positions with smart grouping ─────────────────────────────────
    // If a position has both pie and direct shares, split it into two entries
    const positions = []

    rawPositions.forEach(p => {
      const ticker   = cleanTicker(p.ticker)
      const avgPrice = parseFloat(p.averagePrice || 0)
      const curPrice = parseFloat(p.currentPrice || 0)
      const qty      = parseFloat(p.quantity     || 0)
      const ppl      = parseFloat(p.ppl          || 0)
      const pieQty   = parseFloat(p.pieQuantity  || 0)
      const directQty = Math.max(0, qty - pieQty)
      const pieName  = tickerToPie[ticker] || null

      const base = {
        ticker,
        rawTicker:    p.ticker,
        averagePrice: avgPrice,
        currentPrice: curPrice,
        initialDate:  p.initialFillDate || null,
      }

      const calcPpl    = (q) => parseFloat((q * (curPrice - avgPrice)).toFixed(2))
      const calcGain   = () => avgPrice > 0 ? parseFloat(((curPrice - avgPrice) / avgPrice * 100).toFixed(2)) : 0
      const gainPct    = calcGain()

      if (pieQty > 0 && directQty > 0) {
        // Split: part in pie, part direct
        positions.push({
          ...base,
          quantity:   pieQty,
          pieQuantity: pieQty,
          directQty:  0,
          ppl:        calcPpl(pieQty),
          gainPct,
          totalValue: parseFloat((curPrice * pieQty).toFixed(2)),
          pieName,
        })
        positions.push({
          ...base,
          quantity:   directQty,
          pieQuantity: 0,
          directQty,
          ppl:        calcPpl(directQty),
          gainPct,
          totalValue: parseFloat((curPrice * directQty).toFixed(2)),
          pieName:    null,  // direct portion has no pie
        })
      } else {
        // Entire position is one or the other
        positions.push({
          ...base,
          quantity:    qty,
          pieQuantity: pieQty,
          directQty,
          ppl:         parseFloat(ppl.toFixed(2)),
          gainPct,
          totalValue:  parseFloat((curPrice * qty).toFixed(2)),
          pieName:     pieQty > 0 ? (pieName || tickerToPie[p.ticker] || null) : null,
        })
      }
    })

    // ── Cash ──────────────────────────────────────────────────────────────────
    let cash = null
    if (accountRes.status === 'fulfilled') {
      const a = accountRes.value
      cash = {
        free:     parseFloat(a.free     || 0).toFixed(2),
        invested: parseFloat(a.invested || 0).toFixed(2),
        total:    parseFloat(a.total    || 0).toFixed(2),
        ppl:      parseFloat(a.ppl      || 0).toFixed(2),
      }
    }

    // ── Pending orders ────────────────────────────────────────────────────────
    let pendingOrders = []
    if (ordersRes.status === 'fulfilled') {
      const raw = Array.isArray(ordersRes.value)
        ? ordersRes.value
        : (ordersRes.value?.items || [])
      pendingOrders = raw
        .filter(o => ['PENDING', 'AWAITING_EXECUTION', 'PLACED'].includes(o.status))
        .map(o => ({
          ticker:     cleanTicker(o.ticker),
          side:       (o.type?.includes('BUY') || parseFloat(o.quantity||0) > 0) ? 'BUY' : 'SELL',
          orderType:  o.type || 'LIMIT',
          quantity:   Math.abs(parseFloat(o.quantity || 0)),
          limitPrice: parseFloat(o.limitPrice || 0).toFixed(2),
          status:     o.status,
          created:    o.creationTime || null,
        }))
    }

    return resp({
      source:        'trading212',
      env:           IS_DEMO ? 'DEMO' : 'LIVE',
      fetchedAt:     new Date().toISOString(),
      positions,
      pies,
      cash,
      pendingOrders,
      debug: {
        rawPositionCount: rawPositions.length,
        taggedCount:      positions.filter(p => p.pieName).length,
        directCount:      positions.filter(p => !p.pieName).length,
        pieCount:         pies.length,
        tickerToPieKeys:  Object.keys(tickerToPie),  // helps debug missing groupings
      },
      errors: {
        portfolio: portfolioRes.status === 'rejected' ? portfolioRes.reason?.message : null,
        account:   accountRes.status   === 'rejected' ? accountRes.reason?.message   : null,
        orders:    ordersRes.status    === 'rejected' ? ordersRes.reason?.message     : null,
        pies:      piesRes.status      === 'rejected' ? piesRes.reason?.message       : null,
      },
    })

  } catch (err) {
    return resp({ error: err.message }, 500)
  }
}
