/**
 * CATALYST — src/app/api/t212/route.js
 *
 * READ-ONLY connection to Trading 212 API.
 * NEVER places, modifies or cancels any orders.
 *
 * Fetches: positions, cash, pending orders, pies (with holdings)
 * Groups positions by pie using pieQuantity field + pies API
 *
 * Auth: Basic Auth — Base64(API_KEY:API_SECRET)
 * Env vars: TRADING212_API_KEY, TRADING212_API_SECRET, TRADING212_DEMO
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
  return `Basic ${Buffer.from(`${T212_KEY}:${T212_SECRET}`).toString('base64')}`
}

async function t212(path) {
  const res = await fetch(`${T212_BASE}${path}`, {
    headers: { 'Authorization': buildAuthHeader(), 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  if (res.status === 401) throw new Error('Trading 212 authentication failed. Check TRADING212_API_KEY and TRADING212_API_SECRET in Vercel.')
  if (res.status === 403) throw new Error('API key lacks permission. Regenerate with Account, Portfolio and Orders read permissions.')
  if (res.status === 429) throw new Error('Rate limit hit. Wait a moment and try again.')
  if (!res.ok) throw new Error(`T212 API ${path} → ${res.status}: ${(await res.text().catch(()=>'')).slice(0,150)}`)
  return res.json()
}

// Clean T212 ticker suffixes: NVDA_US_EQ → NVDA
function cleanTicker(raw) {
  if (!raw) return raw
  return raw.replace(/_US_EQ$/, '').replace(/_EQ$/, '').replace(/_US$/, '').replace(/_\w{2,}_\w{2,}$/, '')
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
    // Fetch everything in parallel — read only
    const [portfolioRes, accountRes, ordersRes, piesRes] = await Promise.allSettled([
      t212('/equity/portfolio'),
      t212('/equity/account/cash'),
      t212('/equity/orders'),
      t212('/equity/pies'),          // pie list — deprecated but still works
    ])

    // ── Positions ─────────────────────────────────────────────────────────────
    const rawPositions = portfolioRes.status === 'fulfilled'
      ? (Array.isArray(portfolioRes.value) ? portfolioRes.value : [])
      : []

    const positions = rawPositions.map(p => {
      const ticker   = cleanTicker(p.ticker)
      const avgPrice = parseFloat(p.averagePrice || 0)
      const curPrice = parseFloat(p.currentPrice || 0)
      const qty      = parseFloat(p.quantity      || 0)
      const ppl      = parseFloat(p.ppl           || 0)
      const pieQty   = parseFloat(p.pieQuantity   || 0)  // shares held inside pies
      const gainPct  = avgPrice > 0 ? ((curPrice - avgPrice) / avgPrice * 100) : 0
      return {
        ticker,
        rawTicker:    p.ticker,
        quantity:     qty,
        pieQuantity:  pieQty,        // > 0 means this position is (partly) in a pie
        directQty:    Math.max(0, qty - pieQty),  // shares held directly
        averagePrice: avgPrice,
        currentPrice: curPrice,
        ppl:          parseFloat(ppl.toFixed(2)),
        gainPct:      parseFloat(gainPct.toFixed(2)),
        totalValue:   parseFloat((curPrice * qty).toFixed(2)),
        initialDate:  p.initialFillDate || null,
      }
    })

    // ── Pies ──────────────────────────────────────────────────────────────────
    // Pie list: [{ id, cash, dividendDetails, progress, status,
    //             result: { investedValue, value, returnValue, returnPercent },
    //             settings: { name, ... },
    //             instruments: [{ ticker, ... }] }]
    let pies = []
    if (piesRes.status === 'fulfilled') {
      const rawPies = Array.isArray(piesRes.value) ? piesRes.value : []

      // Fetch full details for each pie to get instruments
      const pieDetails = await Promise.allSettled(
        rawPies.map(p => t212(`/equity/pies/${p.id}`).catch(() => null))
      )

      pies = rawPies.map((pie, idx) => {
        const detail     = pieDetails[idx]?.status === 'fulfilled' ? pieDetails[idx].value : pie
        const result     = detail?.result || {}
        const settings   = detail?.settings || pie.settings || {}
        const instruments = (detail?.instruments || []).map(inst => ({
          ticker:        cleanTicker(inst.ticker),
          rawTicker:     inst.ticker,
          ownedQty:      parseFloat(inst.ownedQuantity    || inst.quantity    || 0),
          targetWeight:  parseFloat(inst.expectedShare    || inst.currentShare|| 0),
          result: {
            value:         parseFloat(inst.result?.value          || 0),
            investedValue: parseFloat(inst.result?.investedValue  || 0),
            ppl:           parseFloat(inst.result?.resultValue    || 0),
            gainPct:       parseFloat(inst.result?.resultCoeff != null
              ? inst.result.resultCoeff * 100
              : 0),
          },
        }))

        return {
          id:            pie.id,
          name:          settings.name || `Pie ${pie.id}`,
          totalValue:    parseFloat(result.value          || pie.cash || 0),
          investedValue: parseFloat(result.investedValue  || 0),
          ppl:           parseFloat(result.returnValue    || 0),
          gainPct:       parseFloat(result.returnPercent  || 0),
          cash:          parseFloat(detail?.cash          || 0),
          instruments,
        }
      })
    }

    // ── Group positions ───────────────────────────────────────────────────────
    // Build a map: ticker → which pie name it belongs to
    const tickerToPie = {}
    pies.forEach(pie => {
      pie.instruments.forEach(inst => {
        tickerToPie[inst.ticker] = pie.name
      })
    })

    // Tag each position with its pie name (if any)
    const taggedPositions = positions.map(p => ({
      ...p,
      pieName: tickerToPie[p.ticker] || null,
    }))

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
      const raw = Array.isArray(ordersRes.value) ? ordersRes.value : (ordersRes.value?.items || [])
      pendingOrders = raw
        .filter(o => ['PENDING','AWAITING_EXECUTION'].includes(o.status))
        .map(o => ({
          ticker:     cleanTicker(o.ticker),
          side:       parseFloat(o.quantity||0) > 0 ? 'BUY' : 'SELL',
          orderType:  o.type || 'LIMIT',
          quantity:   Math.abs(parseFloat(o.quantity||0)),
          limitPrice: parseFloat(o.limitPrice||0),
          status:     o.status,
          created:    o.creationTime || null,
        }))
    }

    return resp({
      source:        'trading212',
      env:           IS_DEMO ? 'DEMO' : 'LIVE',
      fetchedAt:     new Date().toISOString(),
      positions:     taggedPositions,
      pies,
      cash,
      pendingOrders,
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
