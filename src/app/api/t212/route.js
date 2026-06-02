/**
 * CATALYST — src/app/api/t212/route.js
 *
 * READ-ONLY connection to Trading 212 API.
 * NEVER places, modifies or cancels any orders.
 *
 * Auth: Trading 212 uses HTTP Basic Auth.
 *   Username = API Key, Password = API Secret
 *   Header = "Authorization: Basic base64(KEY:SECRET)"
 *
 * Env vars needed in Vercel:
 *   TRADING212_API_KEY    — your API key from T212
 *   TRADING212_API_SECRET — your API secret from T212
 *   TRADING212_DEMO       — set to "true" to use paper trading account
 *
 * How to get your credentials:
 *   T212 app → Settings → API (Beta) → Generate API key
 *   You will receive BOTH a Key and a Secret — save both immediately.
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const T212_KEY    = process.env.TRADING212_API_KEY
const T212_SECRET = process.env.TRADING212_API_SECRET
const IS_DEMO     = process.env.TRADING212_DEMO === 'true'
const T212_BASE   = IS_DEMO
  ? 'https://demo.trading212.com/api/v0'
  : 'https://live.trading212.com/api/v0'

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
}

function resp(body, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

// Build Basic Auth header — Base64(key:secret)
function buildAuthHeader() {
  const credentials = `${T212_KEY}:${T212_SECRET}`
  // Node.js / Edge runtime compatible base64
  const encoded = Buffer.from(credentials).toString('base64')
  return `Basic ${encoded}`
}

async function t212(path) {
  const res = await fetch(`${T212_BASE}${path}`, {
    headers: {
      'Authorization': buildAuthHeader(),
      'Content-Type':  'application/json',
    },
    cache: 'no-store',
  })

  if (res.status === 401) {
    throw new Error('Trading 212 authentication failed. Check TRADING212_API_KEY and TRADING212_API_SECRET in Vercel environment variables.')
  }
  if (res.status === 403) {
    throw new Error('API key lacks permission. Regenerate your T212 API key with Account, Portfolio and Orders read permissions.')
  }
  if (res.status === 429) {
    throw new Error('Trading 212 rate limit hit. Wait a moment and try again.')
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Trading 212 API error ${res.status}: ${body.slice(0, 200)}`)
  }

  return res.json()
}

// Clean T212 ticker format — they append _US_EQ, _EQ etc.
function cleanTicker(raw) {
  if (!raw) return raw
  return raw.replace(/_US_EQ$/, '').replace(/_EQ$/, '').replace(/_US$/, '').replace(/_\w+_\w+$/, '')
}

export async function GET() {
  // Check credentials are configured
  if (!T212_KEY || !T212_SECRET) {
    return resp({
      error: 'Trading 212 credentials not configured',
      missing: [
        !T212_KEY    && 'TRADING212_API_KEY',
        !T212_SECRET && 'TRADING212_API_SECRET',
      ].filter(Boolean),
      setup: [
        '1. Open Trading 212 app → Settings → API (Beta) → Generate API key',
        '2. Copy BOTH the Key and the Secret (the secret is only shown once)',
        '3. Go to Vercel → Settings → Environment Variables',
        '4. Add TRADING212_API_KEY = your key',
        '5. Add TRADING212_API_SECRET = your secret',
        '6. Redeploy',
      ],
    }, 500)
  }

  try {
    // Fetch all three endpoints in parallel — read only
    const [portfolioRes, accountRes, ordersRes] = await Promise.allSettled([
      t212('/equity/portfolio'),
      t212('/equity/account/cash'),
      t212('/equity/orders'),
    ])

    // ── Positions ─────────────────────────────────────────────────────────────
    const positions = portfolioRes.status === 'fulfilled'
      ? (Array.isArray(portfolioRes.value) ? portfolioRes.value : []).map(p => {
          const ticker   = cleanTicker(p.ticker)
          const avgPrice = parseFloat(p.averagePrice  || 0)
          const curPrice = parseFloat(p.currentPrice  || 0)
          const qty      = parseFloat(p.quantity       || 0)
          const ppl      = parseFloat(p.ppl            || 0)
          const gainPct  = avgPrice > 0 ? ((curPrice - avgPrice) / avgPrice * 100) : 0
          return {
            ticker,
            rawTicker:    p.ticker,
            quantity:     qty,
            averagePrice: avgPrice,
            currentPrice: curPrice,
            ppl:          parseFloat(ppl.toFixed(2)),
            gainPct:      parseFloat(gainPct.toFixed(2)),
            totalValue:   parseFloat((curPrice * qty).toFixed(2)),
            initialDate:  p.initialFillDate || null,
          }
        })
      : []

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
        .filter(o => ['PENDING', 'AWAITING_EXECUTION'].includes(o.status))
        .map(o => ({
          ticker:     cleanTicker(o.ticker),
          side:       parseFloat(o.quantity || 0) > 0 ? 'BUY' : 'SELL',
          orderType:  o.type || 'LIMIT',
          quantity:   Math.abs(parseFloat(o.quantity || 0)),
          limitPrice: parseFloat(o.limitPrice || 0),
          status:     o.status,
          created:    o.creationTime || null,
        }))
    }

    // ── Errors from individual endpoints ─────────────────────────────────────
    const errors = {
      portfolio: portfolioRes.status === 'rejected' ? portfolioRes.reason?.message : null,
      account:   accountRes.status   === 'rejected' ? accountRes.reason?.message   : null,
      orders:    ordersRes.status    === 'rejected' ? ordersRes.reason?.message     : null,
    }

    return resp({
      source:        'trading212',
      env:           IS_DEMO ? 'DEMO' : 'LIVE',
      fetchedAt:     new Date().toISOString(),
      positions,
      cash,
      pendingOrders,
      errors,
    })

  } catch (err) {
    return resp({ error: err.message }, 500)
  }
}
