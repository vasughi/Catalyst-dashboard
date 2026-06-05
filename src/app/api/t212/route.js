/**
 * CATALYST — src/app/api/t212/route.js
 * READ-ONLY. Never places, modifies or cancels orders.
 *
 * T212 API LIMITATION: /equity/portfolio has no pieId per position.
 * We cannot reliably know which pie each stock belongs to unless the
 * /equity/pies/{id} instruments endpoint returns data (works for ~2/8 pies).
 *
 * Strategy:
 * 1. Use instrument lists where available (SpaceX, DRAM → correct grouping)
 * 2. For remaining pie stocks (pieQuantity > 0, no instrument match):
 *    group them all under "My Pies" — honest, not misleading
 * 3. Pie-level summaries (name, total value, P&L) come from /equity/pies
 *    and are shown as summary cards regardless of instrument data
 * 4. Direct holdings (pieQuantity == 0) shown separately
 * 5. Positions split into pie portion + direct portion where both exist
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
    if (res.status === 401) throw new Error('T212 auth failed — check API key/secret in Vercel.')
    if (res.status === 403) throw new Error('T212 API key lacks permission.')
    if (res.status === 429) throw new Error('T212 rate limit hit.')
    if (!res.ok) throw new Error(`T212 ${path} → ${res.status}`)
    return res.json()
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') throw new Error(`T212 timeout: ${path}`)
    throw e
  }
}

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
  return s.replace(/_+$/, '')
}

export async function GET() {
  if (!T212_KEY || !T212_SECRET) {
    return resp({
      error: 'Trading 212 credentials not configured',
      missing: [!T212_KEY && 'TRADING212_API_KEY', !T212_SECRET && 'TRADING212_API_SECRET'].filter(Boolean),
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

    // ── Phase 2: fetch pie details for instrument lists ────────────────────────
    const pieDetailResults = await Promise.allSettled(
      rawPies.map(pie => t212fetch(`/equity/pies/${pie.id}`, 6000).catch(() => null))
    )

    // ── Phase 3: build tickerToPie + pie summary objects ──────────────────────
    const tickerToPie = new Map()  // cleaned/raw ticker → pieName (from instrument lists)
    const pieObjects  = []         // pie summaries with their known data

    rawPies.forEach((pie, idx) => {
      const detail    = pieDetailResults[idx]?.status === 'fulfilled' ? pieDetailResults[idx].value : null
      const settings  = detail?.settings || pie.settings || {}
      const pieName   = settings.name || `Pie ${pie.id}`
      const result    = detail?.result || {}

      // Parse instruments where available
      const rawInstruments = detail?.instruments || []
      const instruments = rawInstruments.map(inst => {
        const rawTick  = inst.ticker || inst.tickerSymbol || ''
        const ticker   = cleanTicker(rawTick)
        const ownedQty = parseFloat(inst.ownedQuantity ?? inst.currentShare ?? 0)
        const value    = parseFloat(inst.result?.value ?? (ownedQty * parseFloat(inst.currentPrice ?? 0)))
        const ppl      = parseFloat(inst.result?.resultValue ?? 0)
        const gainPct  = inst.result?.resultCoeff != null ? parseFloat((inst.result.resultCoeff * 100).toFixed(2)) : 0

        // Map both cleaned and raw ticker to this pie
        if (ticker)  tickerToPie.set(ticker,  pieName)
        if (rawTick) tickerToPie.set(rawTick, pieName)

        return { ticker, rawTicker: rawTick, ownedQty, value, ppl, gainPct }
      })

      // Pie-level financials
      const instrValueSum = instruments.reduce((s, i) => s + i.value, 0)
      const instrPPLSum   = instruments.reduce((s, i) => s + i.ppl, 0)
      const totalValue    = parseFloat(result.value       ?? instrValueSum ?? 0)
      const totalPPL      = parseFloat(result.returnValue ?? instrPPLSum   ?? 0)
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
        instruments,                         // stocks we know about (from instrument list)
        hasInstruments: instruments.length > 0,  // whether instrument list returned data
      })
    })

    // ── Phase 4: map positions to pie or direct ────────────────────────────────
    // For each raw position, determine:
    //   - pieQty: shares in pies
    //   - directQty: shares held directly
    // Split into two entries if both > 0
    // Assign pieName from instrument lookup; if not found but pieQty>0 → 'My Pies'

    const positions = []

    for (const p of rawPositions) {
      const ticker    = cleanTicker(p.ticker)
      const avgPrice  = parseFloat(p.averagePrice ?? 0)
      const curPrice  = parseFloat(p.currentPrice ?? 0)
      const totalQty  = parseFloat(p.quantity     ?? 0)
      const pieQty    = parseFloat(p.pieQuantity  ?? 0)
      const directQty = Math.max(0, parseFloat((totalQty - pieQty).toFixed(8)))

      // Pie name from instrument list (reliable), else 'My Pies' (honest fallback)
      const pieName = tickerToPie.get(ticker) ?? tickerToPie.get(p.ticker) ?? null
      const assignedPieName = pieQty > 0 ? (pieName ?? 'My Pies') : null

      const makeEntry = (qty, pName) => {
        const value   = parseFloat((curPrice * qty).toFixed(2))
        const ppl     = parseFloat(((curPrice - avgPrice) * qty).toFixed(2))
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

      if (pieQty > 0.001 && directQty > 0.001) {
        // Split: in both pie and direct
        positions.push(makeEntry(pieQty,    assignedPieName))
        positions.push(makeEntry(directQty, null))
      } else if (pieQty > 0.001) {
        positions.push(makeEntry(totalQty, assignedPieName))
      } else {
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
        ? ordersRes.value : (ordersRes.value?.items ?? [])
      pendingOrders = rawOrders
        .filter(o => ['PENDING', 'AWAITING_EXECUTION', 'PLACED', 'LOCAL'].includes(o.status))
        .map(o => ({
          ticker:     cleanTicker(o.ticker),
          side:       parseFloat(o.quantity ?? 0) > 0 ? 'BUY' : 'SELL',
          quantity:   Math.abs(parseFloat(o.quantity ?? 0)),
          limitPrice: parseFloat(o.limitPrice ?? 0).toFixed(2),
          status:     o.status,
        }))
    }

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
        positionsAfterSplit: positions.length,
        pieCount:           pieObjects.length,
        piesWithInstruments: pieObjects.filter(p => p.hasInstruments).map(p => p.name),
        piesWithoutInstruments: pieObjects.filter(p => !p.hasInstruments).map(p => p.name),
        tickerToPieCount:   tickerToPie.size,
        directCount:        positions.filter(p => !p.pieName).length,
        knownPieCount:      positions.filter(p => p.pieName && p.pieName !== 'My Pies').length,
        myPiesCount:        positions.filter(p => p.pieName === 'My Pies').length,
      },
      errors: {
        portfolio: portfolioRes.status  === 'rejected' ? portfolioRes.reason?.message : null,
        account:   accountRes.status    === 'rejected' ? accountRes.reason?.message   : null,
        orders:    ordersRes.status     === 'rejected' ? ordersRes.reason?.message     : null,
        piesList:  piesListRes.status   === 'rejected' ? piesListRes.reason?.message   : null,
      },
    })

  } catch (err) {
    return resp({ error: err.message }, 500)
  }
}
