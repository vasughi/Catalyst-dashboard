/**
 * CATALYST v4 — src/app/api/market/route.js
 *
 * Now includes: SMA 20/50/200, trend classification, entry quality,
 * breakout/pullback setup detection for every stock.
 *
 * Env vars: FINNHUB_API_KEY, API_NINJAS_KEY (optional)
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

// Wide sanity ranges — catches Finnhub glitch prices
const SANITY = {
  NVDA:[80,280],  AMD:[80,280],   AVGO:[150,900], TSM:[100,300],  MRVL:[50,450],
  ARM:[80,700],   MSFT:[300,700], GOOGL:[100,600],META:[300,900], PLTR:[50,400],
  DELL:[80,250],  SMCI:[20,150],  CRWD:[200,650], PANW:[100,350], ZS:[100,350],
  LMT:[300,950],  RTX:[50,250],   NOC:[300,950],  AXON:[100,550], VRT:[100,750],
  ETN:[150,550],  CEG:[100,500],  FSLR:[50,500],  ANET:[50,200],  RKLB:[5,80],
  GEV:[200,1800], VST:[30,400],   NOW:[500,2000], CRDO:[50,600],  FCX:[20,150],
  CCJ:[20,120],   ENPH:[20,300],  INTC:[15,80],   QCOM:[100,350], CIEN:[40,150],
  S:[10,60],      LUNR:[5,60],    ACHR:[2,50],    NRG:[40,250],
  MP:[5,60],      HII:[100,400],  GD:[150,400],
}

async function quote(sym) {
  try {
    const d = await fh(`/quote?symbol=${encodeURIComponent(sym)}`)
    if (!d || d.c === 0) return null
    const r = SANITY[sym]
    if (r && (d.c < r[0] || d.c > r[1])) return null
    return { symbol: sym, price: d.c, changePct: d.dp ?? 0, prevClose: d.pc }
  } catch { return null }
}

async function quotes(syms) {
  const CHUNK = 20   // was 15 — 20 is safe within 60/min free tier for short bursts
  const map = {}
  for (let i = 0; i < syms.length; i += CHUNK) {
    const chunk = syms.slice(i, i + CHUNK)
    const res = await Promise.allSettled(chunk.map(quote))
    res.forEach((r, j) => {
      if (r.status === 'fulfilled' && r.value) map[chunk[j]] = r.value
    })
    if (i + CHUNK < syms.length) await new Promise(r => setTimeout(r, 200))  // was 500ms
  }
  return map
}

// Fetch daily candles — used for SMA calculation
// Compute full technical picture for one stock
// ─── Earnings helpers ─────────────────────────────────────────────────────────

async function earningsCalendar(from, to) {
  try {
    const d = await fh(`/calendar/earnings?from=${from}&to=${to}`)
    return d?.earningsCalendar || []
  } catch { return [] }
}

async function earningsCalendarNinjas(tickers) {
  const NINJAS_KEY = process.env.API_NINJAS_KEY
  if (!NINJAS_KEY) return {}
  const results = {}
  const fetches = tickers.slice(0, 20).map(async ticker => {
    try {
      const res = await fetch(
        `https://api.api-ninjas.com/v1/earningscalendar?ticker=${ticker}`,
        { headers: { 'X-Api-Key': NINJAS_KEY }, cache: 'no-store' }
      )
      if (!res.ok) return
      const data = await res.json()
      const today = new Date().toISOString().split('T')[0]
      const upcoming = (data || []).filter(e => e.date >= today).sort((a,b) => a.date.localeCompare(b.date))[0]
      if (upcoming) results[ticker] = { date: upcoming.date, source: 'api_ninjas' }
    } catch {}
  })
  await Promise.allSettled(fetches)
  return results
}

// ── Earnings calendar cache — valid for 4 hours ─────────────────────────────
let EARNINGS_CACHE = null
let EARNINGS_CACHE_AT = 0
const EARNINGS_CACHE_TTL = 4 * 60 * 60 * 1000  // 4 hours

async function earningsCalendarCached(from, to) {
  const now = Date.now()
  if (EARNINGS_CACHE && (now - EARNINGS_CACHE_AT) < EARNINGS_CACHE_TTL) {
    return EARNINGS_CACHE
  }
  const result = await earningsCalendar(from, to)
  EARNINGS_CACHE = result
  EARNINGS_CACHE_AT = now
  return result
}

async function companyNews(ticker, days = 7) {
  try {
    const to   = new Date().toISOString().split('T')[0]
    const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    const d    = await fh(`/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}`)
    if (!Array.isArray(d)) return []
    return d.slice(0, 5).map(n => ({
      headline: n.headline,
      summary:  n.summary?.slice(0, 200),
      date:     new Date(n.datetime * 1000).toISOString().split('T')[0],
    }))
  } catch { return [] }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isoDate(d) { return d.toISOString().split('T')[0] }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

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
  NVDA:'NVIDIA',  AMD:'AMD',       AVGO:'Broadcom', TSM:'TSMC',     MRVL:'Marvell',
  ARM:'Arm',      INTC:'Intel',    QCOM:'Qualcomm', ANET:'Arista',  CRDO:'Credo',
  CIEN:'Ciena',   MSFT:'Microsoft',GOOGL:'Alphabet',META:'Meta',    PLTR:'Palantir',
  NOW:'ServiceNow',DELL:'Dell',    SMCI:'SuperMicro',CRWD:'CrowdStrike',PANW:'Palo Alto',
  ZS:'Zscaler',   S:'SentinelOne', LMT:'Lockheed',  RTX:'RTX',     NOC:'Northrop',
  AXON:'Axon',    HII:'Huntington',GD:'General Dynamics',BA:'Boeing',
  RKLB:'RocketLab',LUNR:'Intuitive',ACHR:'Archer',  VRT:'Vertiv',  ETN:'Eaton',
  CEG:'Constellation',VST:'Vistra',GEV:'GE Vernova',NRG:'NRG',
  FSLR:'FirstSolar',ENPH:'Enphase',FCX:'Freeport',  CCJ:'Cameco',  MP:'MP Materials',
}

// ── Fallback earnings dates ───────────────────────────────────────────────────
const FALLBACK_EARNINGS = {
  // CONFIRMED
  META: { date: '2026-07-29', note: 'confirmed' },
  VRT:  { date: '2026-07-28', note: 'confirmed' },
  MRVL: { date: '2026-08-20', note: 'confirmed' },
  AVGO: { date: '2026-06-03', note: 'confirmed' },
  CRDO: { date: '2026-06-01', note: 'confirmed' },
  ARM:  { date: '2026-07-29', note: 'confirmed' },
  // Estimated
  FCX:  { date: '2026-07-16', note: 'est' },
  GEV:  { date: '2026-07-23', note: 'est' },
  GOOGL:{ date: '2026-07-22', note: 'est' },
  NOW:  { date: '2026-07-23', note: 'est' },
  MSFT: { date: '2026-07-28', note: 'est' },
  AMD:  { date: '2026-07-29', note: 'est' },
  ANET: { date: '2026-07-29', note: 'est' },
  PLTR: { date: '2026-08-04', note: 'est' },
  SMCI: { date: '2026-08-05', note: 'est' },
  VST:  { date: '2026-08-07', note: 'est' },
  CEG:  { date: '2026-08-07', note: 'est' },
  CCJ:  { date: '2026-08-07', note: 'est' },
  NVDA: { date: '2026-08-27', note: 'est' },
  CRWD: { date: '2026-08-26', note: 'est' },
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (!type) return resp({ error: 'Missing type parameter' }, 400)
  if (!KEY)  return resp({ error: 'FINNHUB_API_KEY not set.' }, 500)

  try {

    // ── OPPORTUNITIES ──────────────────────────────────────────────────────
    if (type === 'opportunities') {
      const UNIVERSE = [
        'NVDA','AMD','AVGO','TSM','MRVL','ARM','QCOM',
        'ANET','CRDO',
        'MSFT','GOOGL','META','PLTR','NOW',
        'DELL','SMCI',
        'CRWD','PANW','ZS',
        'LMT','RTX','NOC','AXON','GD',
        'RKLB','LUNR',
        'VRT','ETN','CEG','VST','GEV',
        'FSLR',
        'FCX','CCJ',
      ]

      const today    = new Date()
      const in60days = addDays(today, 60)

      // Run everything in parallel — no SMA computation here (moved to /api/technicals)
      const HIGH_PRIORITY_NEWS = ['NVDA','AVGO','MRVL','ARM','PLTR','CRDO','VRT','GEV','META','NOW']

      const [stockQuotes, earnings, ninjasEarnings, sectorQ, vixQ, newsResults] =
        await Promise.all([
          quotes(UNIVERSE),
          earningsCalendarCached(isoDate(today), isoDate(in60days)),
          earningsCalendarNinjas(UNIVERSE),
          quotes(['XLK','ITA','XSD','CIBR','XLE']),
          quote('VIXY'),
          Promise.allSettled(
            HIGH_PRIORITY_NEWS.map(t => companyNews(t, 5).then(n => [t, n]))
          ),
        ])

      // techResults now comes from /api/technicals — empty here, filled async on client
      const techResults = {}

      // News map
      const newsMap = {}
      newsResults.forEach(r => {
        if (r.status === 'fulfilled' && r.value) {
          const [ticker, items] = r.value
          if (items.length) newsMap[ticker] = items
        }
      })

      // Earnings map — three-tier confidence
      const earningsMap = {}
      earnings.filter(e => UNIVERSE.includes(e.symbol)).forEach(e => {
        const days = tradingDaysUntil(e.date)
        if (days !== null && days >= 0) {
          earningsMap[e.symbol] = {
            ticker: e.symbol, date: e.date,
            tradingDaysAway: days, epsEstimate: e.epsEstimate ?? null, source: 'finnhub',
          }
        }
      })
      Object.entries(ninjasEarnings).forEach(([ticker, nb]) => {
        if (!UNIVERSE.includes(ticker)) return
        const days = tradingDaysUntil(nb.date)
        if (days === null || days < 0) return
        const existing = earningsMap[ticker]
        if (!existing) {
          earningsMap[ticker] = { ticker, date: nb.date, tradingDaysAway: days, epsEstimate: null, source: 'ninjas' }
        } else if (existing.date === nb.date) {
          earningsMap[ticker].source = 'confirmed'
        } else {
          earningsMap[ticker].source = 'conflicted'
          earningsMap[ticker].altDate = nb.date
          if (days < existing.tradingDaysAway) {
            earningsMap[ticker].date = nb.date
            earningsMap[ticker].tradingDaysAway = days
          }
        }
      })
      Object.entries(FALLBACK_EARNINGS).forEach(([ticker, fb]) => {
        if (!earningsMap[ticker]) {
          const days = tradingDaysUntil(fb.date)
          if (days !== null && days >= 0) {
            earningsMap[ticker] = {
              ticker, date: fb.date, tradingDaysAway: days, epsEstimate: null,
              source: fb.note === 'confirmed' ? 'confirmed' : 'estimate',
            }
          }
        }
      })

      // VIX & sectors
      const vixPrice  = vixQ?.price ?? null
      const vixRegime = vixPrice ? (vixPrice > 25 ? 'HIGH_FEAR' : vixPrice > 18 ? 'ELEVATED' : 'CALM') : 'UNKNOWN'

      const mkSector = (sym, label) => {
        const q = sectorQ[sym]
        if (!q) return null
        return { label, changePct: q.changePct, direction: q.changePct >= 0 ? 'BULLISH' : 'BEARISH', change: `${q.changePct>=0?'+':''}${q.changePct.toFixed(2)}%` }
      }
      const sectors = [
        mkSector('XLK','Technology'), mkSector('XSD','Semiconductors'),
        mkSector('ITA','Defence'), mkSector('CIBR','Cybersecurity'), mkSector('XLE','Energy'),
      ].filter(Boolean)

      // Build stock objects with technicals
      const stocks = UNIVERSE
        .filter(sym => stockQuotes[sym])
        .map(sym => {
          const q  = stockQuotes[sym]
          const ec = earningsMap[sym] || null
          const tc = techResults[sym] || null
          return {
            ticker:      sym,
            name:        COMPANY_NAMES[sym] || sym,
            price:       q.price,
            priceFormatted: `$${q.price.toFixed(2)}`,
            changePct:   q.changePct,
            change1d:    `${q.changePct>=0?'+':''}${q.changePct.toFixed(2)}%`,
            direction:   q.changePct >= 0 ? 'up' : 'down',
            bigMoverToday: Math.abs(q.changePct) > 8,
            // Earnings
            earningsDate:            ec?.date ?? null,
            earningsTradingDaysAway: ec?.tradingDaysAway ?? null,
            epsEstimate:             ec?.epsEstimate ?? null,
            earningsSource:          ec?.source ?? null,
            hasVerifiedEarnings:     !!ec,
            // Technicals — the new part
            sma20:         tc?.sma20 ?? null,
            sma50:         tc?.sma50 ?? null,
            sma200:        tc?.sma200 ?? null,
            above200:      tc?.above200 ?? null,
            pctAbove50:    tc?.pctAbove50 ?? null,
            pctAbove200:   tc?.pctAbove200 ?? null,
            trend:         tc?.trend ?? null,
            setup:         tc?.setup ?? null,
            entryQuality:  tc?.entryQuality ?? null,
            nearestSupport:    tc?.nearestSupport ?? null,
            suggestedStopLoss: tc?.suggestedStopLoss ?? null,
            distToStopPct:     tc?.distToStopPct ?? null,
          }
        })
        .sort((a, b) => {
          const aD = a.earningsTradingDaysAway ?? 999
          const bD = b.earningsTradingDaysAway ?? 999
          if (aD !== bD) return aD - bD
          return Math.abs(b.changePct) - Math.abs(a.changePct)
        })

      const calendarItems = Object.values(earningsMap)
        .sort((a, b) => a.tradingDaysAway - b.tradingDaysAway)

      return resp({
        meta: {
          requestedType: type, fetchedAt: new Date().toISOString(),
          provider: 'finnhub+ninjas', stocksReturned: stocks.length,
          earningsFound: calendarItems.length,
        },
        vix: vixPrice, vixRegime, sectors, stocks,
        earningsCalendar: calendarItems,
        companyNews: newsMap,
      })
    }

    // ── GLOBAL MACRO ───────────────────────────────────────────────────────
    if (type === 'global') {
      const fxQuote = async (sym) => {
        try {
          const d = await fh(`/quote?symbol=${encodeURIComponent(sym)}`)
          if (!d || d.c === 0) return null
          return { price: d.c, changePct: d.dp ?? 0 }
        } catch { return null }
      }

      const [indices, comms, sectorQ, vixQ, gbpusd, eurusd, usdjpy] = await Promise.all([
        quotes(['SPY','QQQ','DIA','IWM','EWG','EWQ','EWJ']),
        quotes(['USO','GLD','CPER']),
        quotes(['XLK','ITA','XSD','CIBR','XLE','XLI']),
        quote('VIXY'),
        fxQuote('GBPUSD'),
        fxQuote('EURUSD'),
        fxQuote('USDJPY'),
      ])

      const vixPrice  = vixQ?.price ?? null
      const vixRegime = vixPrice ? (vixPrice > 25 ? 'HIGH_FEAR' : vixPrice > 18 ? 'ELEVATED' : 'CALM') : 'UNKNOWN'

      const fmtQ = (q, name) => {
        if (!q) return null
        const c = q.changePct ?? 0
        return { name, value: q.price.toLocaleString('en-US',{maximumFractionDigits:2}), change: `${c>=0?'+':''}${c.toFixed(2)}%`, direction: c>=0?'up':'down' }
      }
      const mkSector = (sym, label) => {
        const q = sectorQ[sym]; if (!q) return null
        return { label, changePct: q.changePct, direction: q.changePct>=0?'up':'down', change:`${q.changePct>=0?'+':''}${q.changePct.toFixed(2)}%` }
      }

      const usoQ = comms['USO'], gldQ = comms['GLD'], cperQ = comms['CPER']

      return resp({
        meta: { requestedType: type, fetchedAt: new Date().toISOString(), provider: 'finnhub' },
        vix: vixPrice, vixRegime,
        indices: [
          fmtQ(indices['SPY'],'S&P 500'), fmtQ(indices['QQQ'],'NASDAQ 100'),
          fmtQ(indices['DIA'],'Dow Jones'), fmtQ(indices['IWM'],'Russell 2000'),
          fmtQ(indices['EWG'],'DAX'), fmtQ(indices['EWQ'],'CAC 40'), fmtQ(indices['EWJ'],'Nikkei'),
        ].filter(Boolean),
        sectors: [
          mkSector('XLK','Technology'), mkSector('XSD','Semiconductors'),
          mkSector('ITA','Defence'), mkSector('CIBR','Cybersecurity'),
          mkSector('XLE','Energy'), mkSector('XLI','Industrials'),
        ].filter(Boolean),
        commodities: [
          usoQ  && usoQ.price  < 200 ? fmtQ(usoQ,  'WTI Oil (USO)') : null,
          gldQ  && gldQ.price  < 500 ? fmtQ(gldQ,  'Gold (GLD)')    : null,
          cperQ && cperQ.price < 100 ? fmtQ(cperQ, 'Copper (CPER)') : null,
        ].filter(Boolean),
        currencies: [
          gbpusd ? { pair:'GBP/USD', value:gbpusd.price.toFixed(4), change:`${gbpusd.changePct>=0?'+':''}${gbpusd.changePct.toFixed(2)}%` } : null,
          eurusd ? { pair:'EUR/USD', value:eurusd.price.toFixed(4), change:`${eurusd.changePct>=0?'+':''}${eurusd.changePct.toFixed(2)}%` } : null,
          usdjpy ? { pair:'USD/JPY', value:usdjpy.price.toFixed(2),  change:`${usdjpy.changePct>=0?'+':''}${usdjpy.changePct.toFixed(2)}%` } : null,
        ].filter(Boolean),
      })
    }

    return resp({ error: `Unknown type: ${type}` }, 400)

  } catch (err) {
    console.error('[market-route]', err)
    return resp({ error: `Market data error: ${err.message}` }, 500)
  }
}
