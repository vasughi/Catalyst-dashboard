/**
 * CATALYST — src/app/api/t212/route.js
 * READ-ONLY. Never places, modifies or cancels orders.
 *
 * Grouping approach (revised after API research):
 * - /equity/portfolio returns positions with pieQuantity field
 * - /equity/pies returns pie list with id + settings.name
 * - /equity/pies/{id} returns pie detail with instruments list
 *
 * The Pies API is deprecated but still works.
 * Key insight: position.pieQuantity tells us HOW MANY shares are in pies.
 * We cross-reference with pie instruments to know WHICH pie.
 *
 * Strategy:
 * 1. Fetch portfolio + pie list in parallel
 * 2. For each pie, fetch its instrument list
 * 3. Build ticker→pieName map from instrument lists
 * 4. Tag each position: if ticker is in tickerToPie → pieName assigned
 *    regardless of pieQuantity (pieQuantity is unreliable)
 * 5. Positions not in any pie instrument list → Direct Holdings
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

function resp(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}

function buildAuthHeader() {
  return 'Basic ' + Buffer.from(T212_KEY + ':' + T212_SECRET).toString('base64')
}

async function t212fetch(path, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${T212_BASE}${path}`, {
      headers: { 'Authorization': buildAuthHeader() },
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (res.status === 401) throw new Error('T212 auth failed — check API key/secret.')
    if (res.status === 403) throw new Error('T212 API key lacks permission.')
    if (res.status === 429) throw new Error('T212 rate limit hit — wait a moment.')
    if (!res.ok) throw new Error(`T212 API error: ${path} returned ${res.status}`)
    return res.json()
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') throw new Error(`T212 timeout: ${path}`)
    throw e
  }
}

// Strip T212 exchange suffixes from tickers
// e.g. NVDA_US_EQ → NVDA, ARMG_GBX_EQ → ARMG, MDA_CA_US_EQ → MDA_CA
function cleanTicker(raw) {
  if (!raw) return raw
  let s = raw
  // Strip known suffix patterns (most specific first)
  const suffixes = [
    '_US_EQ', '_GBX_EQ', '_GBP_EQ', '_EUR_EQ', '_CAD_EQ',
    '_LSE_EQ', '_AMS_EQ', '_ETR_EQ', '_EPA_EQ', '_ASX_EQ',
    '_EQ', '_US', '_GBX', '_GBP',
  ]
  for (const sfx of suffixes) {
    if (s.endsWith(sfx)) {
      s = s.slice(0, -sfx.length)
      break // only strip one suffix
    }
  }
  // Strip any remaining trailing underscores (e.g. AVAV_ from T212)
  s = s.replace(/_+$/, '')
  return s
}

export async function GET() {
  if (!T212_KEY || !T212_SECRET) {
    return resp({
      error: 'Trading 212 credentials not configured',
      missing: [
        !T212_KEY    && 'TRADING212_API_KEY',
        !T212_SECRET && 'TRADING212_API_SECRET'
      ].filter(Boolean),
    }, 500)
  }

  try {
    // ── Phase 1: fetch portfolio, account, orders, pie list — all parallel ────
    const [portfolioRes, accountRes, ordersRes, piesListRes] = await Promise.allSettled([
      t212fetch('/equity/portfolio'),
      t212fetch('/equity/account/cash'),
      t212fetch('/equity/orders'),
      t212fetch('/equity/pies'),
    ])

    // Raw positions from portfolio endpoint
    const rawPositions = portfolioRes.status === 'fulfilled'
      ? (Array.isArray(portfolioRes.value) ? portfolioRes.value : [])
      : []

    // Pie list — just ids and names at this point
    const rawPies = piesListRes.status === 'fulfilled'
      ? (Array.isArray(piesListRes.value) ? piesListRes.value : [])
      : []

    // ── Phase 2: fetch each pie's details (instruments + P&L) ─────────────────
    const piesToFetch = rawPies.slice(0, 20) // cap at 20 pies
    const pieDetailResults = await Promise.allSettled(
      piesToFetch.map(pie =>
        t212fetch(`/equity/pies/${pie.id}`, 6000).catch(() => null)
      )
    )

    // ── Phase 3: build tickerToPie map ────────────────────────────────────────
    // This is the core of grouping — which tickers belong to which pie
    const tickerToPie = new Map()  // cleaned ticker → pie name
    const pieObjects  = []

    piesToFetch.forEach((pie, idx) => {
      const detail   = pieDetailResults[idx]?.status === 'fulfilled'
        ? pieDetailResults[idx].value
        : null

      const settings = detail?.settings || pie.settings || {}
      const pieName  = settings.name || `Pie ${pie.id}`
      const result   = detail?.result || {}

      // Parse instruments — T212 returns them in various formats
      const rawInstruments = detail?.instruments || []
      const instruments = rawInstruments.map(inst => {
        // Handle both old and new API response shapes
        const rawTick   = inst.ticker || inst.tickerSymbol || ''
        const ticker    = cleanTicker(rawTick)
        const ownedQty  = parseFloat(inst.ownedQuantity ?? inst.currentShare ?? 0)
        const instValue = parseFloat(
          inst.result?.value ??
          inst.value ??
          (ownedQty * parseFloat(inst.currentPrice ?? 0))
        )
        const instPPL = parseFloat(
          inst.result?.resultValue ??
          inst.result?.ppl ??
          inst.ppl ?? 0
        )
        const instGain = inst.result?.resultCoeff != null
          ? parseFloat((inst.result.resultCoeff * 100).toFixed(2))
          : 0

        // Register in tickerToPie — both cleaned and raw variants
        if (ticker)  tickerToPie.set(ticker,  pieName)
        if (rawTick) tickerToPie.set(rawTick, pieName)

        return { ticker, rawTicker: rawTick, ownedQty, value: instValue, ppl: instPPL, gainPct: instGain }
      })

      // Pie-level value: prefer API's result.value, fallback to summing instruments
      const instrValueSum = instruments.reduce((s, i) => s + i.value, 0)
      const instrPPLSum   = instruments.reduce((s, i) => s + i.ppl, 0)
      const totalValue    = parseFloat(result.value ?? instrValueSum ?? 0)
      const totalPPL      = parseFloat(result.returnValue ?? instrPPLSum ?? 0)
      const investedValue = totalValue - totalPPL
      const gainPct       = investedValue > 0
        ? parseFloat((totalPPL / investedValue * 100).toFixed(2))
        : parseFloat(result.returnPercent ?? 0)

      pieObjects.push({
        id:          pie.id,
        name:        pieName,
        totalValue,
        ppl:         totalPPL,
        gainPct,
        instruments,
        hasDetails:  rawInstruments.length > 0,
      })
    })

    // ── Phase 4: map portfolio positions to pies ──────────────────────────────
    // Primary: tickerToPie map from instruments (reliable when API returns data)
    // Fallback: pieQuantity > 0 means position is in SOME pie
    //   If exactly one pie has no instruments AND pieQuantity > 0, assign to that pie
    const piesWithNoInstruments = pieObjects.filter(p => !p.hasDetails || p.instruments.length === 0)

    const positions = rawPositions.map(p => {
      const ticker   = cleanTicker(p.ticker)
      const avgPrice = parseFloat(p.averagePrice ?? 0)
      const curPrice = parseFloat(p.currentPrice ?? 0)
      const qty      = parseFloat(p.quantity     ?? 0)
      const ppl      = parseFloat(p.ppl          ?? 0)
      const pieQty   = parseFloat(p.pieQuantity  ?? 0)
      const gainPct  = avgPrice > 0
        ? parseFloat(((curPrice - avgPrice) / avgPrice * 100).toFixed(2))
        : 0

      // Primary: instrument list lookup
      let pieName = tickerToPie.get(ticker) ?? tickerToPie.get(p.ticker) ?? null

      // Fallback: if not found in any instrument list but pieQuantity > 0,
      // the position is in a pie — but we don't know which one
      // Mark as 'in-pie-unknown' for now; will be resolved in debug
      if (!pieName && pieQty > 0) {
        pieName = '__pie_unknown__'
      }

      return {
        ticker,
        rawTicker:    p.ticker,
        averagePrice: avgPrice,
        currentPrice: curPrice,
        quantity:     qty,
        pieQuantity:  pieQty,
        ppl:          parseFloat(ppl.toFixed(2)),
        gainPct,
        totalValue:   parseFloat((curPrice * qty).toFixed(2)),
        pieName,
        initialDate:  p.initialFillDate ?? null,
      }
    })

    // ── Cash ──────────────────────────────────────────────────────────────────
    let cash = null
    if (accountRes.status === 'fulfilled') {
      const a = accountRes.value
      cash = {
        free:     parseFloat(a.free     ?? 0).toFixed(2),
        invested: parseFloat(a.invested ?? 0).toFixed(2),
        total:    parseFloat(a.total    ?? 0).toFixed(2),
        ppl:      parseFloat(a.ppl      ?? 0).toFixed(2),
      }
    }

    // ── Pending orders ────────────────────────────────────────────────────────
    let pendingOrders = []
    if (ordersRes.status === 'fulfilled') {
      const rawOrders = Array.isArray(ordersRes.value)
        ? ordersRes.value
        : (ordersRes.value?.items ?? [])

      pendingOrders = rawOrders
        .filter(o => ['PENDING', 'AWAITING_EXECUTION', 'PLACED', 'LOCAL'].includes(o.status))
        .map(o => ({
          ticker:     cleanTicker(o.ticker),
          side:       parseFloat(o.quantity ?? 0) > 0 ? 'BUY' : 'SELL',
          orderType:  o.type ?? 'LIMIT',
          quantity:   Math.abs(parseFloat(o.quantity ?? 0)),
          limitPrice: parseFloat(o.limitPrice ?? 0).toFixed(2),
          status:     o.status,
          created:    o.creationTime ?? null,
        }))
    }

    // ── Debug info ────────────────────────────────────────────────────────────
    const taggedCount = positions.filter(p => p.pieName).length
    const directCount = positions.filter(p => !p.pieName).length

    return resp({
      source:       'trading212',
      env:          IS_DEMO ? 'DEMO' : 'LIVE',
      fetchedAt:    new Date().toISOString(),
      positions,
      pies:         pieObjects,
      cash,
      pendingOrders,
      debug: {
        rawPositionCount: rawPositions.length,
        taggedToPie:      taggedCount,
        directHoldings:   directCount,
        pieCount:         pieObjects.length,
        piesWithDetails:  pieObjects.filter(p => p.hasDetails).length,
        piesWithoutDetails: pieObjects.filter(p => !p.hasDetails).map(p => p.name),
        tickerToPieEntries: tickerToPie.size,
      },
      errors: {
        portfolio: portfolioRes.status  === 'rejected' ? portfolioRes.reason?.message  : null,
        account:   accountRes.status    === 'rejected' ? accountRes.reason?.message    : null,
        orders:    ordersRes.status     === 'rejected' ? ordersRes.reason?.message     : null,
        piesList:  piesListRes.status   === 'rejected' ? piesListRes.reason?.message   : null,
      },
    })

  } catch (err) {
    return resp({ error: err.message }, 500)
  }
}
