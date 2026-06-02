/**
 * CATALYST — src/app/api/t212/route.js
 *
 * READ-ONLY connection to Trading 212 API.
 * Fetches: portfolio positions, account cash balance, pending orders.
 * NEVER places, modifies or cancels any orders.
 *
 * Env var required: TRADING212_API_KEY
 * Get it from: T212 app → Settings → API (Beta) → Generate key
 * Permissions needed: Account data, Portfolio positions, Orders (read only)
 *
 * T212 API base:
 *   Live:  https://live.trading212.com/api/v0
 *   Demo:  https://demo.trading212.com/api/v0
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const T212_KEY  = process.env.TRADING212_API_KEY
const T212_BASE = process.env.TRADING212_DEMO === 'true'
  ? 'https://demo.trading212.com/api/v0'
  : 'https://live.trading212.com/api/v0'

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
}

function resp(body, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

async function t212(path) {
  const res = await fetch(`${T212_BASE}${path}`, {
    headers: {
      'Authorization': T212_KEY,
      'Content-Type':  'application/json',
    },
    cache: 'no-store',
  })
  if (res.status === 401) throw new Error('Invalid Trading 212 API key — check TRADING212_API_KEY in Vercel')
  if (res.status === 403) throw new Error('API key lacks permission for this endpoint — regenerate with full read permissions')
  if (!res.ok) throw new Error(`Trading 212 API ${path} → ${res.status}`)
  return res.json()
}

export async function GET() {
  if (!T212_KEY) {
    return resp({
      error: 'TRADING212_API_KEY not set',
      setup: 'Go to Vercel → Settings → Environment Variables and add TRADING212_API_KEY',
      docs:  'Get your key from T212 app → Settings → API (Beta) → Generate API key',
    }, 500)
  }

  try {
    // Fetch all three endpoints in parallel — read only, no trades
    const [portfolio, account, orders] = await Promise.allSettled([
      t212('/equity/portfolio'),
      t212('/equity/account/cash'),
      t212('/equity/orders'),
    ])

    // ── Portfolio positions ───────────────────────────────────────────────────
    // T212 returns: { ticker, quantity, averagePrice, currentPrice, ppl, fxPpl,
    //                initialFillDate, frontend, maxBuy, maxSell, pieQuantity }
    const positions = portfolio.status === 'fulfilled'
      ? (Array.isArray(portfolio.value) ? portfolio.value : []).map(p => {
          const ticker     = p.ticker?.replace(/_US_EQ$|_EQ$/, '') || p.ticker
          const avgPrice   = parseFloat(p.averagePrice  || 0)
          const currentP   = parseFloat(p.currentPrice  || 0)
          const qty        = parseFloat(p.quantity       || 0)
          const ppl        = parseFloat(p.ppl            || 0)  // profit/loss in account currency
          const gainPct    = avgPrice > 0 ? ((currentP - avgPrice) / avgPrice * 100) : 0
          return {
            ticker,
            rawTicker:    p.ticker,
            quantity:     qty,
            averagePrice: avgPrice,
            currentPrice: currentP,
            ppl:          parseFloat(ppl.toFixed(2)),
            gainPct:      parseFloat(gainPct.toFixed(2)),
            totalValue:   parseFloat((currentP * qty).toFixed(2)),
            initialDate:  p.initialFillDate || null,
          }
        })
      : []

    const portfolioError = portfolio.status === 'rejected'
      ? portfolio.reason?.message
      : null

    // ── Cash balance ─────────────────────────────────────────────────────────
    // T212 returns: { free, invested, pieCash, result, total, ppl }
    let cash = null
    if (account.status === 'fulfilled') {
      const a = account.value
      cash = {
        free:     parseFloat(a.free     || 0).toFixed(2),
        invested: parseFloat(a.invested || 0).toFixed(2),
        total:    parseFloat(a.total    || 0).toFixed(2),
        ppl:      parseFloat(a.ppl      || 0).toFixed(2),
        currency: 'GBP',  // T212 UK accounts are GBP
      }
    }

    // ── Pending orders ────────────────────────────────────────────────────────
    // T212 returns array of orders with status PENDING
    let pendingOrders = []
    if (orders.status === 'fulfilled') {
      const raw = Array.isArray(orders.value) ? orders.value
        : (orders.value?.items || [])
      pendingOrders = raw
        .filter(o => ['PENDING', 'AWAITING_EXECUTION'].includes(o.status))
        .map(o => ({
          ticker:    o.ticker?.replace(/_US_EQ$|_EQ$/, '') || o.ticker,
          side:      o.type === 'LIMIT' ? (o.quantity > 0 ? 'BUY' : 'SELL') : o.type,
          orderType: o.type || 'LIMIT',
          quantity:  Math.abs(parseFloat(o.quantity || 0)),
          limitPrice:parseFloat(o.limitPrice || 0),
          status:    o.status,
          created:   o.creationTime || null,
        }))
    }

    return resp({
      source:    'trading212',
      env:       process.env.TRADING212_DEMO === 'true' ? 'DEMO' : 'LIVE',
      fetchedAt: new Date().toISOString(),
      positions,
      cash,
      pendingOrders,
      errors: {
        portfolio: portfolioError,
        account:   account.status   === 'rejected' ? account.reason?.message   : null,
        orders:    orders.status    === 'rejected' ? orders.reason?.message    : null,
      },
    })

  } catch (err) {
    return resp({ error: err.message }, 500)
  }
}
