/**
 * CATALYST v3 — src/app/api/market/route.js
 *
 * 3-tab architecture: opportunities | global | risk
 * Data source: Finnhub free tier (60 calls/min, no credit card)
 *
 * Env vars:
 *   FINNHUB_API_KEY   — finnhub.io
 *   ANTHROPIC_API_KEY — console.anthropic.com
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const FH  = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

function resp(body, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

// ─── Finnhub helpers ──────────────────────────────────────────────────────────

async function fh(path) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${FH}${path}${sep}token=${KEY}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Finnhub ${path} → ${res.status}`)
  return res.json()
}

async function quote(sym) {
  try {
    const d = await fh(`/quote?symbol=${encodeURIComponent(sym)}`)
    if (!d || d.c === 0) return null
    return { symbol: sym, price: d.c, changePct: d.dp ?? 0, prevClose: d.pc }
  } catch { return null }
}

async function quotes(syms) {
  // Batch in chunks of 20 with a small gap to avoid Finnhub 60/min rate limit
  const CHUNK = 20
  const map = {}
  for (let i = 0; i < syms.length; i += CHUNK) {
    const chunk = syms.slice(i, i + CHUNK)
    const res = await Promise.allSettled(chunk.map(quote))
    res.forEach((r, j) => {
      if (r.status === 'fulfilled' && r.value) map[chunk[j]] = r.value
    })
    // Small delay between chunks if more to fetch
    if (i + CHUNK < syms.length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }
  return map
}

async function earningsCalendar(from, to) {
  try {
    const d = await fh(`/calendar/earnings?from=${from}&to=${to}`)
    return d?.earningsCalendar || []
  } catch { return [] }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isoDate(d) { return d.toISOString().split('T')[0] }

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function tradingDaysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const now = new Date()
  if (target < now) return -1
  let days = 0, cur = new Date(now)
  while (cur < target) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) days++
  }
  return days
}

// ─── Company names ────────────────────────────────────────────────────────────

const COMPANY_NAMES = {
  // AI silicon
  NVDA: 'NVIDIA',       AMD:  'AMD',            AVGO: 'Broadcom',
  TSM:  'TSMC',         MRVL: 'Marvell',        ARM:  'Arm Holdings',
  INTC: 'Intel',        QCOM: 'Qualcomm',
  // Networking
  ANET: 'Arista',       CIEN: 'Ciena',          CRDO: 'Credo Tech',
  // Big tech
  MSFT: 'Microsoft',    GOOGL:'Alphabet',        META: 'Meta',
  PLTR: 'Palantir',     NOW:  'ServiceNow',
  // Servers
  DELL: 'Dell',         SMCI: 'Super Micro',     HPE:  'HP Enterprise',
  // Cyber
  CRWD: 'CrowdStrike',  PANW: 'Palo Alto',       ZS:   'Zscaler',
  S:    'SentinelOne',
  // Defence
  LMT:  'Lockheed',     RTX:  'RTX Corp',        NOC:  'Northrop',
  AXON: 'Axon',         HII:  'Huntington Ingalls', GD: 'General Dynamics',
  BA:   'Boeing',
  // Space / drones
  RKLB: 'Rocket Lab',   LUNR: 'Intuitive Machines', ACHR: 'Archer Aviation',
  JOBY: 'Joby Aviation',
  // Power / grid
  VRT:  'Vertiv',       ETN:  'Eaton',           CEG:  'Constellation',
  VST:  'Vistra',       GEV:  'GE Vernova',      NRG:  'NRG Energy',
  // Solar
  FSLR: 'First Solar',  ENPH: 'Enphase',
  // Critical minerals
  FCX:  'Freeport-McMoRan', MP: 'MP Materials',  CCJ:  'Cameco',
}

// ── Fallback earnings dates ───────────────────────────────────────────────────
// Finnhub confirmed dates take priority. These fill the gaps.
// AUDIT LOG (02 Jun 2026):
//   META: 29 Jul 2026 CONFIRMED (TipRanks)
//   VRT:  05 Aug 2026 CONFIRMED (TipRanks/Investing.com) — NOT 28 Jul
//   MRVL: 20 Aug 2026 CONFIRMED (TipRanks/Investing.com) — reports after close
//   GEV:  23 Jul 2026 estimated (multiple sources)
//   NOW:  23 Jul 2026 estimated
//   GOOGL:22 Jul 2026 estimated
//   MSFT: 28 Jul 2026 estimated
//   AMD:  29 Jul 2026 estimated
//   NVDA: 27 Aug 2026 estimated
//   PLTR: 04 Aug 2026 estimated
//   CRWD: 26 Aug 2026 estimated
//   SMCI: 05 Aug 2026 estimated
//   ANET: 29 Jul 2026 estimated
//   AVGO: 11 Sep 2026 estimated (fiscal year end Dec, reports ~Sep)
//   CRDO: 27 Aug 2026 estimated
//   VST:  07 Aug 2026 estimated
//   CEG:  07 Aug 2026 estimated
//   FCX:  22 Jul 2026 estimated
//   CCJ:  07 Aug 2026 estimated
const FALLBACK_EARNINGS = {
  // CONFIRMED dates
  META: { date: '2026-07-29', note: 'confirmed' },
  VRT:  { date: '2026-08-05', note: 'confirmed' },
  MRVL: { date: '2026-08-20', note: 'confirmed' },
  // Estimated dates
  GEV:  { date: '2026-07-23', note: 'est' },
  NOW:  { date: '2026-07-23', note: 'est' },
  FCX:  { date: '2026-07-22', note: 'est' },
  GOOGL:{ date: '2026-07-22', note: 'est' },
  MSFT: { date: '2026-07-28', note: 'est' },
  AMD:  { date: '2026-07-29', note: 'est' },
  ANET: { date: '2026-07-29', note: 'est' },
  PLTR: { date: '2026-08-04', note: 'est' },
  SMCI: { date: '2026-08-05', note: 'est' },
  VST:  { date: '2026-08-07', note: 'est' },
  CEG:  { date: '2026-08-07', note: 'est' },
  CCJ:  { date: '2026-08-07', note: 'est' },
  NVDA: { date: '2026-08-27', note: 'est' },
  CRDO: { date: '2026-08-27', note: 'est' },
  CRWD: { date: '2026-08-26', note: 'est' },
  AVGO: { date: '2026-09-10', note: 'est' },
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (!type) return resp({ error: 'Missing type parameter' }, 400)
  if (!KEY)  return resp({ error: 'FINNHUB_API_KEY not set in Vercel environment variables.' }, 500)

  try {

    // ── OPPORTUNITIES ──────────────────────────────────────────────────────
    if (type === 'opportunities') {
      const UNIVERSE = [
        // AI silicon / semis (highest priority — largest earnings movers)
        'NVDA','AMD','AVGO','TSM','MRVL','ARM','QCOM','INTC',
        // Networking / AI infra (high earnings velocity)
        'ANET','CRDO','CIEN',
        // Big tech / AI software
        'MSFT','GOOGL','META','PLTR','NOW',
        // Servers / storage
        'DELL','SMCI','HPE',
        // Cybersecurity
        'CRWD','PANW','ZS','S',
        // Defence / aerospace
        'LMT','RTX','NOC','AXON','GD','HII',
        // Space / drones / autonomy
        'RKLB','LUNR','ACHR',
        // Power / grid / nuclear (AI infrastructure beneficiaries)
        'VRT','ETN','CEG','VST','GEV','NRG',
        // Solar / clean energy
        'FSLR','ENPH',
        // Critical minerals / supply chain choke points
        'FCX','CCJ','MP',
      ]

      const today    = new Date()
      const in60days = addDays(today, 60)

      // All data in parallel — one round trip
      const [stockQuotes, earnings, sectorQ, vixQ] = await Promise.all([
        quotes(UNIVERSE),
        earningsCalendar(isoDate(today), isoDate(in60days)),
        quotes(['XLK','ITA','XSD','CIBR','XLE']),
        quote('VIXY'),
      ])

      // Build earnings map — Finnhub first, fallbacks fill gaps
      const earningsMap = {}

      earnings
        .filter(e => UNIVERSE.includes(e.symbol))
        .forEach(e => {
          const days = tradingDaysUntil(e.date)
          if (days !== null && days >= 0) {
            earningsMap[e.symbol] = {
              ticker: e.symbol,
              date: e.date,
              tradingDaysAway: days,
              epsEstimate: e.epsEstimate ?? null,
              source: 'finnhub',
            }
          }
        })

      Object.entries(FALLBACK_EARNINGS).forEach(([ticker, fb]) => {
        if (!earningsMap[ticker]) {
          const days = tradingDaysUntil(fb.date)
          if (days !== null && days >= 0) {
            earningsMap[ticker] = {
              ticker,
              date: fb.date,
              tradingDaysAway: days,
              epsEstimate: null,
              source: 'estimate',
              note: fb.note,
            }
          }
        }
      })

      // VIX & sector regime
      const vixPrice  = vixQ?.price ?? null
      const vixRegime = vixPrice
        ? (vixPrice > 25 ? 'HIGH_FEAR' : vixPrice > 18 ? 'ELEVATED' : 'CALM')
        : 'UNKNOWN'

      // Sector direction (today's % change of ETF)
      const mkSector = (sym, label) => {
        const q = sectorQ[sym]
        if (!q) return null
        return {
          label,
          changePct: q.changePct,
          direction: q.changePct >= 0 ? 'BULLISH' : 'BEARISH',
          change: `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`,
        }
      }
      const sectors = [
        mkSector('XLK',  'Technology'),
        mkSector('XSD',  'Semiconductors'),
        mkSector('ITA',  'Defence'),
        mkSector('CIBR', 'Cybersecurity'),
        mkSector('XLE',  'Energy'),
      ].filter(Boolean)

      // Build stock objects
      const stocks = UNIVERSE
        .filter(sym => stockQuotes[sym])
        .map(sym => {
          const q  = stockQuotes[sym]
          const ec = earningsMap[sym] || null
          return {
            ticker: sym,
            name:   COMPANY_NAMES[sym] || sym,
            price:        q.price,
            priceFormatted: `$${q.price.toFixed(2)}`,
            changePct:    q.changePct,
            change1d:     `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`,
            direction:    q.changePct >= 0 ? 'up' : 'down',
            bigMoverToday: Math.abs(q.changePct) > 8,
            earningsDate:            ec?.date ?? null,
            earningsTradingDaysAway: ec?.tradingDaysAway ?? null,
            epsEstimate:             ec?.epsEstimate ?? null,
            earningsSource:          ec?.source ?? null,
            hasVerifiedEarnings:     !!ec,
          }
        })
        .sort((a, b) => {
          // Nearest earnings first, then by absolute % move
          const aD = a.earningsTradingDaysAway ?? 999
          const bD = b.earningsTradingDaysAway ?? 999
          if (aD !== bD) return aD - bD
          return Math.abs(b.changePct) - Math.abs(a.changePct)
        })

      // Sorted earnings calendar for display
      const calendarItems = Object.values(earningsMap)
        .sort((a, b) => a.tradingDaysAway - b.tradingDaysAway)

      return resp({
        meta: {
          requestedType: type,
          fetchedAt: new Date().toISOString(),
          provider: 'finnhub',
          stocksReturned: stocks.length,
          earningsFound: calendarItems.length,
        },
        vix: vixPrice,
        vixRegime,
        sectors,
        stocks,
        earningsCalendar: calendarItems,
      })
    }

    // ── GLOBAL MACRO ───────────────────────────────────────────────────────
    if (type === 'global') {
      async function fxQuote(sym) {
        try {
          const d = await fh(`/quote?symbol=${encodeURIComponent(sym)}`)
          if (!d || d.c === 0) return null
          return { price: d.c, changePct: d.dp ?? 0 }
        } catch { return null }
      }

      const [indices, comms, sectorQ, vixQ, gbpusd, eurusd, usdjpy] = await Promise.all([
        quotes(['SPY','QQQ','DIA','IWM','EWG','EWQ','EWJ','ITA','XSD']), // ITA=defence, XSD=semis added
        quotes(['USO','GLD','CPER']),
        quotes(['XLK','ITA','XSD','CIBR','XLE','XLI']),
        quote('VIXY'),
        fxQuote('GBPUSD'),
        fxQuote('EURUSD'),
        fxQuote('USDJPY'),
      ])

      const vixPrice  = vixQ?.price ?? null
      const vixRegime = vixPrice
        ? (vixPrice > 25 ? 'HIGH_FEAR' : vixPrice > 18 ? 'ELEVATED' : 'CALM')
        : 'UNKNOWN'

      const fmtQ = (q, name) => {
        if (!q) return null
        const c = q.changePct ?? 0
        return {
          name,
          value: q.price.toLocaleString('en-US', { maximumFractionDigits: 2 }),
          change: `${c >= 0 ? '+' : ''}${c.toFixed(2)}%`,
          direction: c >= 0 ? 'up' : 'down',
        }
      }

      // Sanity check commodity ETF prices
      const usoQ  = comms['USO']
      const gldQ  = comms['GLD']
      const cperQ = comms['CPER']

      const mkSector = (sym, label) => {
        const q = sectorQ[sym]
        if (!q) return null
        return {
          label,
          changePct: q.changePct,
          direction: q.changePct >= 0 ? 'up' : 'down',
          change: `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`,
        }
      }

      return resp({
        meta: { requestedType: type, fetchedAt: new Date().toISOString(), provider: 'finnhub' },
        vix: vixPrice,
        vixRegime,
        // US indices via ETF proxies
        indices: [
          fmtQ(indices['SPY'], 'S&P 500'),
          fmtQ(indices['QQQ'], 'NASDAQ 100'),
          fmtQ(indices['DIA'], 'Dow Jones'),
          fmtQ(indices['IWM'], 'Russell 2000'),
          fmtQ(indices['EWG'], 'DAX'),
          fmtQ(indices['EWQ'], 'CAC 40'),
          fmtQ(indices['EWJ'], 'Nikkei'),
        ].filter(Boolean),
        // Sector performance today
        sectors: [
          mkSector('XLK',  'Technology'),
          mkSector('XSD',  'Semiconductors'),
          mkSector('ITA',  'Defence'),
          mkSector('CIBR', 'Cybersecurity'),
          mkSector('XLE',  'Energy'),
          mkSector('XLI',  'Industrials'),
        ].filter(Boolean),
        // Commodities (sanity-checked)
        commodities: [
          usoQ  && usoQ.price  < 200 ? fmtQ(usoQ,  'WTI Oil (USO)') : null,
          gldQ  && gldQ.price  < 500 ? fmtQ(gldQ,  'Gold (GLD)')    : null,
          cperQ && cperQ.price < 100 ? fmtQ(cperQ, 'Copper (CPER)') : null,
        ].filter(Boolean),
        // FX
        currencies: [
          gbpusd ? { pair: 'GBP/USD', value: gbpusd.price.toFixed(4), change: `${gbpusd.changePct >= 0 ? '+' : ''}${gbpusd.changePct.toFixed(2)}%` } : null,
          eurusd ? { pair: 'EUR/USD', value: eurusd.price.toFixed(4), change: `${eurusd.changePct >= 0 ? '+' : ''}${eurusd.changePct.toFixed(2)}%` } : null,
          usdjpy ? { pair: 'USD/JPY', value: usdjpy.price.toFixed(2), change: `${usdjpy.changePct >= 0 ? '+' : ''}${usdjpy.changePct.toFixed(2)}%` } : null,
        ].filter(Boolean),
      })
    }

    return resp({ error: `Unknown type: ${type}` }, 400)

  } catch (err) {
    console.error('[market-route]', err)
    return resp({ error: `Market data error: ${err.message}` }, 500)
  }
}
