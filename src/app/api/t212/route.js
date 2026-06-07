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
    // ── Phase 1: sequential fetches to avoid T212 rate limits ────────────────
    // T212 rate limits aggressively — parallel calls trigger 429s
    // Fetch pies list FIRST with priority, then other data
    const piesListRes  = await t212fetch('/equity/pies').then(d => ({status:'fulfilled',value:d})).catch(e => ({status:'rejected',reason:e}))
    await new Promise(r => setTimeout(r, 300))
    const portfolioRes = await t212fetch('/equity/portfolio').then(d => ({status:'fulfilled',value:d})).catch(e => ({status:'rejected',reason:e}))
    await new Promise(r => setTimeout(r, 300))
    const [accountRes, ordersRes] = await Promise.allSettled([
      t212fetch('/equity/account/cash'),
      t212fetch('/equity/orders'),
    ])

    const rawPositions = portfolioRes.status === 'fulfilled'
      ? (Array.isArray(portfolioRes.value) ? portfolioRes.value : [])
      : []

    const rawPies = piesListRes.status === 'fulfilled'
      ? (Array.isArray(piesListRes.value) ? piesListRes.value : [])
      : []

    // ── Phase 2: fetch pie details for instrument lists ────────────────────────
    // Fetch pie details SEQUENTIALLY — retry up to 3x on 429 with backoff
    const pieDetailResults = []
    for (const pie of rawPies) {
      let lastErr = null
      let result  = null
      // Try up to 3 times with increasing delays: 1s, 3s, 6s
      for (const waitMs of [0, 1000, 3000, 6000]) {
        if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs))
        try {
          result = await t212fetch(`/equity/pies/${pie.id}`, 8000)
          lastErr = null
          break  // success
        } catch (e) {
          lastErr = e
          // Only retry on rate limit errors
          if (!e.message?.includes('429') && !e.message?.includes('rate limit') && !e.message?.includes('timeout')) break
        }
      }
      pieDetailResults.push(result
        ? { status: 'fulfilled', value: result }
        : { status: 'rejected', reason: lastErr }
      )
      // 800ms between pies — well under T212's rate limit
      await new Promise(r => setTimeout(r, 800))
    }

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

      // Detect GBX (pence-denominated) stocks:
      // _GBX_EQ suffix = explicit pence
      // _EQ only (no _US, no _GBP) + averagePrice > 200 + no fxPpl = heuristic pence detection
      // This correctly identifies FTCl_EQ, SMTl_EQ, SMSNl_EQ as pence-denominated
      const rawAvg   = parseFloat(p.averagePrice ?? 0)
      const rawCur   = parseFloat(p.currentPrice ?? 0)
      const rawFxPpl = p.fxPpl
      const isExplicitGBX = p.ticker?.includes('_GBX')
      const isHeuristicGBX = !p.ticker?.includes('_US') &&
                             !p.ticker?.includes('_GBP') &&
                             !p.ticker?.includes('_EUR') &&
                             !p.ticker?.includes('_GBX') &&
                             rawAvg > 200 &&
                             (rawFxPpl === null || rawFxPpl === undefined)
      const isGBX   = isExplicitGBX || isHeuristicGBX
      const fx      = isGBX ? 0.01 : 1  // pence → pounds

      const avgPrice = rawAvg * fx
      const curPrice = rawCur * fx
      const totalQty  = parseFloat(p.quantity     ?? 0)
      const pieQty    = parseFloat(p.pieQuantity  ?? 0)
      const directQty = Math.max(0, parseFloat((totalQty - pieQty).toFixed(8)))

      // Pie name from instrument list (reliable), else 'My Pies' (honest fallback)
      const pieName = tickerToPie.get(ticker) ?? tickerToPie.get(p.ticker) ?? null
      const assignedPieName = pieQty > 0 ? (pieName ?? 'My Pies') : null

      // Use fxPpl (already in GBP account currency) scaled to qty fraction
      const totalPplGbp = parseFloat(p.fxPpl ?? p.ppl ?? 0)

      const makeEntry = (qty, pName) => {
        const value   = parseFloat((curPrice * qty).toFixed(2))
        // Scale fxPpl proportionally — fxPpl covers the full position
        const ppl     = totalQty > 0
          ? parseFloat((totalPplGbp * qty / totalQty).toFixed(2))
          : parseFloat(((curPrice - avgPrice) * qty).toFixed(2))
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
          frontend:     p.frontend || null,
          isGBX,
          initialDate:  p.initialFillDate ?? null,
        }
      }

      // Use 'frontend' field: AUTOINVEST = created via pie, IOS/ANDROID = direct
      const isAutoInvest = p.frontend === 'AUTOINVEST'

      if (pieQty > 0.001 && directQty > 0.001) {
        // Split: shares in both pie and direct holdings
        positions.push(makeEntry(pieQty,    assignedPieName))
        positions.push(makeEntry(directQty, null))
      } else if (pieQty > 0.001 || isAutoInvest) {
        // Entirely in a pie (pieQty > 0, OR frontend=AUTOINVEST with pieQty=0)
        positions.push(makeEntry(totalQty, assignedPieName))
      } else {
        // Direct holding
        positions.push(makeEntry(totalQty, null))
      }
    }

    // ── Supplement with pie-only positions not in /equity/portfolio ─────────────
    // T212 omits positions with 0 direct shares from /equity/portfolio
    // We recover them from pie instrument lists
    const portfolioTickers = new Set(positions.map(p => p.ticker))

    for (const pie of pieObjects) {
      for (const inst of pie.instruments) {
        if (!inst.ticker) continue
        if (portfolioTickers.has(inst.ticker)) continue  // already in portfolio

        // This stock exists only in a pie — add it as a pie-only position
        const curPrice = parseFloat(inst.currentPrice ?? 0) || 0
        const avgPrice = inst.ownedQty > 0 && inst.value > 0
          ? parseFloat((inst.value / inst.ownedQty).toFixed(4))
          : 0
        const gainPct  = avgPrice > 0 && curPrice > 0
          ? parseFloat(((curPrice - avgPrice) / avgPrice * 100).toFixed(2))
          : parseFloat((inst.gainPct ?? 0).toFixed(2))

        positions.push({
          ticker:       inst.ticker,
          rawTicker:    inst.rawTicker || inst.ticker,
          averagePrice: avgPrice,
          currentPrice: curPrice,
          quantity:     inst.ownedQty,
          ppl:          parseFloat(inst.ppl.toFixed(2)),
          gainPct,
          totalValue:   parseFloat(inst.value.toFixed(2)),
          pieName:      pie.name,
          frontend:     'AUTOINVEST',
          initialDate:  null,
          fromInstruments: true,  // flag: recovered from pie instruments, not portfolio
        })
        portfolioTickers.add(inst.ticker)  // prevent duplicates
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
