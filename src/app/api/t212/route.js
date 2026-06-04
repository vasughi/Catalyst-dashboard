/**
 * CATALYST — src/app/api/t212/route.js
 * READ-ONLY. Never places, modifies or cancels orders.
 *
 * Pie grouping strategy:
 * - Build tickerToPie map from pie instrument lists (reliable source)
 * - Assign pieName to position based on tickerToPie lookup
 * - DON'T use pieQuantity field — it's unreliable in T212 free API
 * - If ticker appears in a pie's instruments → it belongs to that pie
 */

import { NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

const T212_KEY   = process.env.TRADING212_API_KEY
const T212_SECRET = process.env.TRADING212_API_SECRET
const IS_DEMO    = process.env.TRADING212_DEMO === 'true'
const T212_BASE  = IS_DEMO
  ? 'https://demo.trading212.com/api/v0'
  : 'https://live.trading212.com/api/v0'

function resp(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache' },
  })
}

function buildAuthHeader() {
  return 'Basic ' + Buffer.from(T212_KEY + ':' + T212_SECRET).toString('base64')
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
    if (res.status === 401) throw new Error('T212 auth failed — check API key/secret in Vercel.')
    if (res.status === 403) throw new Error('T212 API key lacks permission.')
    if (res.status === 429) throw new Error('T212 rate limit — wait a moment.')
    if (!res.ok) throw new Error(`T212 ${path} → ${res.status}`)
    return res.json()
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') throw new Error(`T212 timeout: ${path}`)
    throw e
  }
}

// Strip T212 exchange suffixes: NVDA_US_EQ → NVDA, ARMG_GBX_EQ → ARMG
// Order matters — most specific first
function cleanTicker(raw) {
  if (!raw) return raw
  let s = raw
  const suffixes = [
    '_US_EQ', '_GBX_EQ', '_GBP_EQ', '_EUR_EQ',
    '_LSE_EQ', '_AMS_EQ', '_ETR_EQ', '_EPA_EQ',
    '_EQ', '_US', '_GBX', '_GBP',
  ]
  for (const sfx of suffixes) {
    if (s.endsWith(sfx)) { s = s.slice(0, -sfx.length); break }
  }
  return s
}

export async function GET() {
  if (!T212_KEY || !T212_SECRET) {
    return resp({
      error: 'Trading 212 credentials not configured',
      missing: [!T212_KEY && 'TRADING212_API_KEY', !T212_SECRET && 'TRADING212_API_SECRET'].filter(Boolean),
    }, 500)
  }

  try {
    // Phase 1: fetch portfolio + account + orders + pie list — all parallel
    const [portfolioRes, accountRes, ordersRes, piesRes] = await Promise.allSettled([
      t212('/equity/portfolio'),
      t212('/equity/account/cash'),
      t212('/equity/orders'),
      t212('/equity/pies'),
    ])

    const rawPositions = portfolioRes.status === 'fulfilled'
      ? (Array.isArray(portfolioRes.value) ? portfolioRes.value : [])
      : []

    // Phase 2: fetch each pie's instrument list — parallel, 5s timeout each
    const rawPies = piesRes.status === 'fulfilled'
      ? (Array.isArray(piesRes.value) ? piesRes.value : [])
      : []

    const piesToFetch = rawPies.slice(0, 15)
    const pieDetails  = await Promise.allSettled(
      piesToFetch.map(p => t212(`/equity/pies/${p.id}`, 5000).catch(() => null))
    )

    // Build tickerToPie from instrument lists — the reliable source
    // Store both cleaned AND raw tickers to handle any suffix variations
    const tickerToPie = {}  // cleaned ticker → pie name
    const pies        = []

    piesToFetch.forEach((pie, idx) => {
      const detail   = pieDetails[idx]?.status === 'fulfilled' ? pieDetails[idx].value : null
      const settings = detail?.settings || pie.settings || {}
      const pieName  = settings.name || `Pie ${pie.id}`
      const result   = detail?.result || {}

      // Parse instrument list
      const instruments = (detail?.instruments || []).map(inst => {
        const rawTick = inst.ticker || inst.tickerSymbol || ''
        const ticker  = cleanTicker(rawTick)
        // Register in tickerToPie
        if (ticker)    tickerToPie[ticker]    = pieName
        if (rawTick)   tickerToPie[rawTick]   = pieName
        return {
          ticker,
          rawTicker:    rawTick,
          ownedQty:     parseFloat(inst.ownedQuantity || inst.quantity || 0),
          currentPrice: parseFloat(inst.currentPrice || 0),
          value:        parseFloat(inst.result?.value || 0),
          ppl:          parseFloat(inst.result?.resultValue || inst.result?.ppl || 0),
          gainPct:      inst.result?.resultCoeff != null
            ? parseFloat((inst.result.resultCoeff * 100).toFixed(2))
            : 0,
        }
      })

      // Pie-level financials — use instrument sum as fallback if API fields missing
      const instrValue = instruments.reduce((s, i) => s + (i.value || 0), 0)
      const instrPPL   = instruments.reduce((s, i) => s + (i.ppl   || 0), 0)
      const totalValue = parseFloat(result.value || instrValue || 0)
      const totalPPL   = parseFloat(result.returnValue || instrPPL || 0)

      pies.push({
        id:           pie.id,
        name:         pieName,
        totalValue,
        ppl:          totalPPL,
        gainPct:      totalValue > totalPPL && totalValue > 0
          ? parseFloat((totalPPL / (totalValue - totalPPL) * 100).toFixed(2))
          : parseFloat(result.returnPercent || 0),
        instruments,
      })
    })

    // Phase 3: map each position to its pie
    // Strategy: use tickerToPie lookup (from instrument lists) as the source of truth
    // Don't rely on pieQuantity — it's often 0 even for pie positions
    const positions = rawPositions.map(p => {
      const ticker    = cleanTicker(p.ticker)
      const avgPrice  = parseFloat(p.averagePrice || 0)
      const curPrice  = parseFloat(p.currentPrice || 0)
      const qty       = parseFloat(p.quantity     || 0)
      const ppl       = parseFloat(p.ppl          || 0)
      const gainPct   = avgPrice > 0
        ? parseFloat(((curPrice - avgPrice) / avgPrice * 100).toFixed(2))
        : 0

      // Look up pie by cleaned ticker, then raw ticker
      const pieName = tickerToPie[ticker] || tickerToPie[p.ticker] || null

      return {
        ticker,
        rawTicker:    p.ticker,
        name:         p.ticker,  // display name fallback
        averagePrice: avgPrice,
        currentPrice: curPrice,
        quantity:     qty,
        ppl:          parseFloat(ppl.toFixed(2)),
        gainPct,
        totalValue:   parseFloat((curPrice * qty).toFixed(2)),
        pieName,      // null = direct holding
        initialDate:  p.initialFillDate || null,
      }
    })

    // Cash
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

    // Pending orders
    let pendingOrders = []
    if (ordersRes.status === 'fulfilled') {
      const raw = Array.isArray(ordersRes.value)
        ? ordersRes.value
        : (ordersRes.value?.items || [])
      pendingOrders = raw
        .filter(o => ['PENDING', 'AWAITING_EXECUTION', 'PLACED'].includes(o.status))
        .map(o => ({
          ticker:     cleanTicker(o.ticker),
          side:       o.type?.includes('BUY') ? 'BUY' : 'SELL',
          orderType:  o.type || 'LIMIT',
          quantity:   Math.abs(parseFloat(o.quantity || 0)),
          limitPrice: parseFloat(o.limitPrice || 0).toFixed(2),
          status:     o.status,
        }))
    }

    const tagged  = positions.filter(p => p.pieName).length
    const direct  = positions.filter(p => !p.pieName).length

    return resp({
      source:       'trading212',
      env:          IS_DEMO ? 'DEMO' : 'LIVE',
      fetchedAt:    new Date().toISOString(),
      positions,
      pies,
      cash,
      pendingOrders,
      debug: {
        rawPositionCount: rawPositions.length,
        taggedCount:      tagged,
        directCount:      direct,
        pieCount:         pies.length,
        tickerToPieKeys:  Object.keys(tickerToPie).filter(k => !k.includes('_')), // cleaned keys only
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
