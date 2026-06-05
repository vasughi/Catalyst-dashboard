/**
 * CATALYST — src/app/api/t212/route.js
 * READ-ONLY. Never places, modifies or cancels orders.
 *
 * KEY INSIGHT: T212 /equity/portfolio returns ONE entry per ticker
 * with pieQuantity = shares held inside pies.
 * So MU with 3 direct + pie shares comes as ONE entry.
 * We must SPLIT it into pie portion + direct portion.
 *
 * Grouping logic:
 * 1. Fetch pie instrument lists → build tickerToPie map
 * 2. For each position:
 *    - If pieQty > 0 AND directQty > 0 → split into two entries
 *    - If pieQty == qty → entirely in pie
 *    - If pieQty == 0 → entirely direct
 * 3. For positions in pies but not in instrument lists → __pie_unknown__
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
    if (res.status === 401) throw new Error('T212 auth failed — check API key/secret in Vercel env vars.')
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

// Strip T212 exchange suffixes: NVDA_US_EQ → NVDA, ARMG_GBX_EQ → ARMG
function cleanTicker(raw) {
  if (!raw) return raw
  let s = raw
  const suffixes = [
    '_US_EQ', '_GBX_EQ', '_GBP_EQ', '_EUR_EQ', '_CAD_EQ',
    '_LSE_EQ', '_AMS_EQ', '_ETR_EQ', '_EPA_EQ', '_ASX_EQ',
    '_EQ', '_US', '_GBX', '_GBP',
  ]
  for (const sfx of suffixes) {
    if (s.endsWith(sfx)) { s = s.slice(0, -sfx.length); break }
  }
  // Strip trailing underscores (e.g. AVAV_)
  s = s.replace(/_+$/, '')
  return s
}

export async function GET() {
  if (!T212_KEY || !T212_SECRET) {
    return resp({
      error: 'Trading 212 credentials not configured',
      missing: [
        !T212_KEY    && 'TRADING212_API_KEY',
        !T212_SECRET && 'TRADING212_API_SECRET',
      ].filter(Boolean),
    }, 500)
  }

  try {
    // ── Phase 1: parallel fetches ──────────────────────────────────────────────
    const [portfolioRes, accountRes, ordersRes, piesListRes] = await Promise.allSettled([
      t212fetch('/equity/portfolio'),
      t212fetch('/equity/account/cash'),
      t212fetch('/equity/orders'),
      t212fetch('/equity/pies'),
    ])

    const rawPositions = portfolioRes.status === 'fulfilled'
      ? (Array.isArray(portfolioRes.value) ? portfolioRes.value : [])
      : []

    const rawPies = piesListRes.status === 'fulfilled'
      ? (Array.isArray(piesListRes.value) ? piesListRes.value : [])
      : []

    // ── Phase 2: fetch each pie's instrument list ──────────────────────────────
    const piesToFetch = rawPies.slice(0, 20)
    const pieDetailResults = await Promise.allSettled(
      piesToFetch.map(pie =>
        t212fetch(`/equity/pies/${pie.id}`, 6000).catch(() => null)
      )
    )

    // ── Phase 3: build tickerToPie map from instrument lists ───────────────────
    // tickerToPie: cleaned ticker → pie name (from instrument lists — reliable source)
    const tickerToPie = new Map()
    const pieObjects  = []

    piesToFetch.forEach((pie, idx) => {
      const detail   = pieDetailResults[idx]?.status === 'fulfilled'
        ? pieDetailResults[idx].value
        : null

      const settings = detail?.settings || pie.settings || {}
      const pieName  = settings.name || `Pie ${pie.id}`
      const result   = detail?.result || {}

      const rawInstruments = detail?.instruments || []
      const instruments = rawInstruments.map(inst => {
        const rawTick = inst.ticker || inst.tickerSymbol || ''
        const ticker  = cleanTicker(rawTick)
        const ownedQty = parseFloat(inst.ownedQuantity ?? inst.currentShare ?? 0)
        const instValue = parseFloat(inst.result?.value ?? inst.value ?? (ownedQty * parseFloat(inst.currentPrice ?? 0)))
        const instPPL   = parseFloat(inst.result?.resultValue ?? inst.result?.ppl ?? inst.ppl ?? 0)
        const instGain  = inst.result?.resultCoeff != null
          ? parseFloat((inst.result.resultCoeff * 100).toFixed(2))
          : 0

        // Register both cleaned and raw ticker
        if (ticker)  tickerToPie.set(ticker,  pieName)
        if (rawTick) tickerToPie.set(rawTick, pieName)

        return { ticker, rawTicker: rawTick, ownedQty, value: instValue, ppl: instPPL, gainPct: instGain }
      })

      const instrValueSum = instruments.reduce((s, i) => s + i.value, 0)
      const instrPPLSum   = instruments.reduce((s, i) => s + i.ppl,   0)
      const totalValue    = parseFloat(result.value       ?? instrValueSum ?? 0)
      const totalPPL      = parseFloat(result.returnValue ?? instrPPLSum   ?? 0)
      const investedValue = totalValue - totalPPL
      const gainPct       = investedValue > 0
        ? parseFloat((totalPPL / investedValue * 100).toFixed(2))
        : parseFloat(result.returnPercent ?? 0)

      pieObjects.push({
        id: pie.id, name: pieName, totalValue, ppl: totalPPL, gainPct,
        instruments, hasDetails: rawInstruments.length > 0,
      })
    })

    // ── Phase 4: split positions into pie + direct portions ────────────────────
    //
    // T212 returns ONE portfolio entry per ticker.
    // p.quantity     = total shares (pie + direct)
    // p.pieQuantity  = shares held inside a pie
    // directQty      = p.quantity - p.pieQuantity
    //
    // MU example: quantity=3.22, pieQuantity=0.22 (in DRAM pie), directQty=3.0
    // We create TWO entries: one for the pie portion, one for direct.
    //
    // For the pie portion we use the pie's avgPrice if we have it from instruments,
    // otherwise use the overall avgPrice as best estimate.

    const positions = []

    for (const p of rawPositions) {
      const ticker    = cleanTicker(p.ticker)
      const avgPrice  = parseFloat(p.averagePrice ?? 0)
      const curPrice  = parseFloat(p.currentPrice ?? 0)
      const totalQty  = parseFloat(p.quantity     ?? 0)
      const pieQty    = parseFloat(p.pieQuantity  ?? 0)
      const directQty = Math.max(0, parseFloat((totalQty - pieQty).toFixed(8)))
      const totalPPL  = parseFloat(p.ppl ?? 0)

      // Look up pie name from instrument lists
      const pieName = tickerToPie.get(ticker) ?? tickerToPie.get(p.ticker) ?? null

      // Helper: build a position entry
      const makeEntry = (qty, pName) => {
        const value   = parseFloat((curPrice * qty).toFixed(2))
        const ppl     = avgPrice > 0 ? parseFloat(((curPrice - avgPrice) * qty).toFixed(2)) : 0
        const gainPct = avgPrice > 0 ? parseFloat(((curPrice - avgPrice) / avgPrice * 100).toFixed(2)) : 0
        return {
          ticker,
          rawTicker:    p.ticker,
          averagePrice: avgPrice,
          currentPrice: curPrice,
          quantity:     qty,
          ppl,
          gainPct,
          totalValue:   value,
          pieName:      pName,
          initialDate:  p.initialFillDate ?? null,
        }
      }

      if (pieQty > 0 && directQty > 0.001) {
        // SPLIT: position exists in both pie AND direct holdings
        const assignedPieName = pieName ?? '__pie_unknown__'
        positions.push(makeEntry(pieQty,    assignedPieName))  // pie portion
        positions.push(makeEntry(directQty, null))             // direct portion
      } else if (pieQty > 0) {
        // Entirely in a pie
        const assignedPieName = pieName ?? '__pie_unknown__'
        positions.push(makeEntry(totalQty, assignedPieName))
      } else {
        // Entirely direct (pieQty == 0)
        positions.push(makeEntry(totalQty, null))
      }
    }

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

    // ── Summary stats ─────────────────────────────────────────────────────────
    const taggedCount = positions.filter(p => p.pieName && p.pieName !== '__pie_unknown__').length
    const unknownCount = positions.filter(p => p.pieName === '__pie_unknown__').length
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
        rawPositionCount:   rawPositions.length,
        splitPositions:     positions.length - rawPositions.length,  // how many were split
        taggedToPie:        taggedCount,
        inPiesUnknown:      unknownCount,
        directHoldings:     directCount,
        pieCount:           pieObjects.length,
        piesWithDetails:    pieObjects.filter(p => p.hasDetails).length,
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
