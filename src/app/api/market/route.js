/**
 * CATALYST — src/app/api/market/route.js
 * Discovers earnings-driven opportunities, fetches prices and market context.
 * Primary price source: Twelve Data (batch, 1 credit). Fallback: Finnhub.
 */

import { NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

const FH  = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY
const TD_BASE = 'https://api.twelvedata.com'
const TD_KEY  = process.env.TWELVE_DATA_API_KEY

// ── Utilities ─────────────────────────────────────────────────────────────────

async function fhSafe(path, timeoutMs = 4000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(FH + path + '&token=' + KEY, {
      cache: 'no-store', signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return res.json()
  } catch { clearTimeout(timer); return null }
}

function fmtChange(pct) {
  const p = parseFloat(pct) || 0
  return (p >= 0 ? '+' : '') + p.toFixed(2) + '%'
}

// ── Twelve Data batch quote ───────────────────────────────────────────────────

function parseTdEntry(sym, d) {
  if (!d || d.status === 'error') return null
  const price = parseFloat(d.close)
  const prev  = parseFloat(d.previous_close)
  const pct   = parseFloat(d.percent_change || 0)
  if (!price || price <= 0 || price > 100000) return null
  if (prev > 0 && Math.abs(price - prev) / prev > 0.40) return null
  return {
    symbol:    sym,
    price,
    changePct: parseFloat(pct.toFixed(2)),
    change1d:  fmtChange(pct),
    direction: pct >= 0 ? 'up' : 'down',
    prevClose: prev,
    source:    'twelvedata',
  }
}

async function tdBatch(symbols) {
  if (!TD_KEY || !symbols.length) return {}
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const url = TD_BASE + '/quote?symbol=' + encodeURIComponent(symbols.join(',')) + '&apikey=' + TD_KEY
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return {}
    const data = await res.json()
    const result = {}
    if (symbols.length === 1) {
      const q = parseTdEntry(symbols[0], data)
      if (q) result[symbols[0]] = q
    } else {
      for (const sym of symbols) {
        if (data[sym]) {
          const q = parseTdEntry(sym, data[sym])
          if (q) result[sym] = q
        }
      }
    }
    return result
  } catch { return {} }
}

async function tdQuote(sym) {
  const r = await tdBatch([sym])
  return r[sym] || null
}

// ── Finnhub quote fallback ────────────────────────────────────────────────────

async function safeQuote(sym) {
  // Try Twelve Data first
  const td = await tdQuote(sym)
  if (td) return td

  // Finnhub fallback
  try {
    const d = await fhSafe('/quote?symbol=' + encodeURIComponent(sym))
    if (!d || d.c === 0 || d.c === null) return null
    const price = d.c
    const prev  = d.pc
    if (prev && prev > 0 && Math.abs(price - prev) / prev > 0.40) return null
    if (price < 0.001 || price > 100000) return null
    if (sym === 'NFLX' && (price < 50 || price > 150)) return null
    const pct = d.dp ?? 0
    return {
      symbol:    sym,
      price,
      changePct: parseFloat(pct.toFixed(2)),
      change1d:  fmtChange(pct),
      direction: pct >= 0 ? 'up' : 'down',
      prevClose: prev,
      source:    'finnhub',
    }
  } catch { return null }
}

// ── Fetch prices — TD batch first, Finnhub for misses ────────────────────────

async function fetchPrices(syms) {
  const map = {}
  if (TD_KEY && syms.length > 0) {
    const tdResults = await tdBatch(syms)
    Object.assign(map, tdResults)
  }
  const missed = syms.filter(s => !map[s])
  if (missed.length > 0) {
    const BATCH = 10, DELAY = 50
    for (let i = 0; i < missed.length; i += BATCH) {
      const batch = missed.slice(i, i + BATCH)
      const res   = await Promise.allSettled(batch.map(safeQuote))
      res.forEach((r, j) => {
        if (r.status === 'fulfilled' && r.value) map[batch[j]] = r.value
      })
      if (i + BATCH < missed.length) await new Promise(r => setTimeout(r, DELAY))
    }
  }
  return map
}

// ── Quality universe ──────────────────────────────────────────────────────────

const QUALITY_UNIVERSE = new Set([
  // AI & Semiconductors
  'NVDA','AMD','AVGO','TSM','MRVL','ARM','QCOM','INTC','MU','AMAT','LRCX','SMCI','CRDO','ANET',
  // Big Tech
  'MSFT','GOOGL','GOOG','META','AMZN','AAPL','TSLA','NFLX','PLTR',
  // Cloud / SaaS
  'ORCL','NOW','CRM','SNOW','DDOG','NET','ADBE','OKTA','FTNT','ZS','PANW','CRWD','S',
  // Defence
  'LMT','RTX','NOC','GD','BA','HII','AXON','KTOS','AVAV',
  // Space / drones
  'RKLB','LUNR','ACHR','JOBY','ASTS',
  // Quantum
  'IONQ','RGTI','QUBT','IBM','QMCO',
  // Power / energy
  'VRT','GEV','ETN','CEG','VST','NRG','FSLR','ENPH',
  // Commodities
  'FCX','CCJ','MP',
  // Additional
  'CRWV','AVAV','KTOS','ASTS','RKLB',
])

const FALLBACK_DATES = {
  NVDA:  { date: '2026-08-27', note: 'est' },
  META:  { date: '2026-07-29', note: 'confirmed' },
  MSFT:  { date: '2026-07-28', note: 'confirmed' },
  GOOGL: { date: '2026-07-22', note: 'confirmed' },
  AMZN:  { date: '2026-07-30', note: 'confirmed' },
  AAPL:  { date: '2026-07-31', note: 'est' },
  TSLA:  { date: '2026-07-22', note: 'confirmed' },
  ORCL:  { date: '2026-06-10', note: 'confirmed' },
  AVGO:  { date: '2026-09-03', note: 'est' },
  AMD:   { date: '2026-07-28', note: 'est' },
  MU:    { date: '2026-06-24', note: 'confirmed' },
  PLTR:  { date: '2026-08-04', note: 'confirmed' },
  ARM:   { date: '2026-07-29', note: 'confirmed' },
  NOW:   { date: '2026-07-23', note: 'confirmed' },
  GEV:   { date: '2026-07-23', note: 'est' },
  VRT:   { date: '2026-08-05', note: 'confirmed' },
  CRWD:  { date: '2026-08-26', note: 'est' },
  ADBE:  { date: '2026-06-11', note: 'confirmed' },
  MRVL:  { date: '2026-08-20', note: 'est' },
}

const ALWAYS_INCLUDE = new Set([
  'NVDA','AMD','AVGO','MRVL','META','MSFT','GOOGL','PLTR','CRWD','PANW',
  'ZS','NET','FTNT','S','IONQ','RGTI','QUBT','IBM','VRT','GEV','ETN',
  'CEG','LMT','AXON','CRDO','ANET','NOW','ARM','TSLA','AMZN','ORCL','MU',
])

const KNOWN_NAMES = {
  NVDA:'NVIDIA', AVGO:'Broadcom', AMD:'AMD', TSM:'TSMC', MRVL:'Marvell',
  ARM:'Arm', QCOM:'Qualcomm', INTC:'Intel', MU:'Micron', SMCI:'SuperMicro',
  MSFT:'Microsoft', GOOGL:'Alphabet', META:'Meta', AMZN:'Amazon', AAPL:'Apple',
  TSLA:'Tesla', NFLX:'Netflix', PLTR:'Palantir', ORCL:'Oracle', NOW:'ServiceNow',
  CRM:'Salesforce', SNOW:'Snowflake', DDOG:'Datadog', NET:'Cloudflare',
  ADBE:'Adobe', CRWD:'CrowdStrike', PANW:'Palo Alto', ZS:'Zscaler',
  FTNT:'Fortinet', OKTA:'Okta', LMT:'Lockheed', RTX:'RTX Corp',
  NOC:'Northrop', AXON:'Axon', GD:'Gen Dynamics', VRT:'Vertiv',
  ETN:'Eaton', GEV:'GE Vernova', CEG:'Constellation', VST:'Vistra',
  FSLR:'First Solar', ENPH:'Enphase', FCX:'Freeport', CCJ:'Cameco',
  RKLB:'RocketLab', ASTS:'AST SpaceMobile', IONQ:'IonQ', RGTI:'Rigetti',
  QUBT:'QuEra', IBM:'IBM', CRDO:'Credo', ANET:'Arista', KTOS:'Kratos',
  AVAV:'AeroVironment', CRWV:'CoreWeave', S:'SentinelOne',
}

// ── Trading days calculation ───────────────────────────────────────────────────

function tradingDaysAway(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const today  = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  if (target < today) return null
  let count = 0
  const d = new Date(today)
  while (d < target) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

// ── VIX & sectors ─────────────────────────────────────────────────────────────

async function fetchGlobal() {
  const [vixRes, sectorRes] = await Promise.allSettled([
    fhSafe('/quote?symbol=VIX'),
    Promise.all([
      fhSafe('/quote?symbol=XLK'),
      fhSafe('/quote?symbol=ITA'),
      fhSafe('/quote?symbol=XSD'),
      fhSafe('/quote?symbol=CIBR'),
      fhSafe('/quote?symbol=XLE'),
    ]),
  ])
  const vixData = vixRes.status === 'fulfilled' ? vixRes.value : null
  const vix     = vixData?.c ?? null
  const vixRegime = vix == null ? 'UNKNOWN' : vix > 25 ? 'HIGH_FEAR' : vix > 18 ? 'ELEVATED' : 'CALM'
  const sectorData = sectorRes.status === 'fulfilled' ? sectorRes.value : []
  const sectorLabels = ['Tech(XLK)', 'Defence(ITA)', 'Semis(XSD)', 'Cyber(CIBR)', 'Energy(XLE)']
  const sectors = sectorData.map((d, i) =>
    d ? { label: sectorLabels[i], change: fmtChange(d.dp) } : null
  ).filter(Boolean)
  return { vix, vixRegime, sectors }
}

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET(request) {
  if (!KEY) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const type  = searchParams.get('type') || 'opportunities'
  const extra = (searchParams.get('extra') || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)

  // Global macro mode
  if (type === 'global') {
    const global = await fetchGlobal()
    return NextResponse.json(global, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  // Opportunities mode
  const extendedUniverse = new Set([...QUALITY_UNIVERSE, ...extra])

  // Fetch earnings calendar
  const today    = new Date()
  const future   = new Date(today)
  future.setDate(future.getDate() + 45)
  const fromDate = today.toISOString().split('T')[0]
  const toDate   = future.toISOString().split('T')[0]

  const [calData, globalData] = await Promise.allSettled([
    fhSafe('/calendar/earnings?from=' + fromDate + '&to=' + toDate),
    fetchGlobal(),
  ])

  const global = globalData.status === 'fulfilled' ? globalData.value : { vix: null, vixRegime: 'UNKNOWN', sectors: [] }

  // Build stock list
  const discovered = new Map()

  // From calendar
  if (calData.status === 'fulfilled' && calData.value?.earningsCalendar) {
    for (const e of calData.value.earningsCalendar) {
      const sym = e.symbol
      if (!sym || !extendedUniverse.has(sym)) continue
      const days = tradingDaysAway(e.date)
      if (days === null) continue
      discovered.set(sym, {
        ticker: sym,
        name:   KNOWN_NAMES[sym] || sym,
        earningsDate: e.date,
        tradingDaysAway: days,
        earningsNote: 'confirmed',
        epsEstimate: e.epsEstimate,
        discoveredFromCalendar: true,
      })
    }
  }

  // Always-include stocks with fallback dates
  for (const sym of ALWAYS_INCLUDE) {
    if (!discovered.has(sym)) {
      const fb = FALLBACK_DATES[sym]
      if (fb) {
        const days = tradingDaysAway(fb.date)
        if (days !== null) {
          discovered.set(sym, {
            ticker: sym,
            name:   KNOWN_NAMES[sym] || sym,
            earningsDate: fb.date,
            tradingDaysAway: days,
            earningsNote: fb.note,
            discoveredFromCalendar: false,
          })
        }
      } else {
        discovered.set(sym, {
          ticker: sym,
          name:   KNOWN_NAMES[sym] || sym,
          earningsDate: null,
          tradingDaysAway: null,
          earningsNote: 'unknown',
          discoveredFromCalendar: false,
        })
      }
    }
  }

  // Extra user tickers
  for (const sym of extra) {
    if (!discovered.has(sym)) {
      discovered.set(sym, {
        ticker: sym,
        name:   KNOWN_NAMES[sym] || sym,
        earningsDate: null,
        tradingDaysAway: null,
        earningsNote: 'unknown',
        discoveredFromCalendar: false,
      })
    }
  }

  const stocks = Array.from(discovered.values())
  const tickers = stocks.map(s => s.ticker)

  // Fetch prices
  const priceMap = await fetchPrices(tickers)

  // Attach prices
  const result = stocks.map(s => ({
    ...s,
    price:          priceMap[s.ticker]?.price ?? null,
    priceFormatted: priceMap[s.ticker] ? '$' + priceMap[s.ticker].price.toFixed(2) : null,
    change1d:       priceMap[s.ticker]?.change1d ?? null,
    changePct:      priceMap[s.ticker]?.changePct ?? null,
    direction:      priceMap[s.ticker]?.direction ?? null,
    priceSource:    priceMap[s.ticker]?.source ?? null,
  })).filter(s => s.price !== null)

  return NextResponse.json({
    stocks:          result,
    earningsCalendar: result.filter(s => s.earningsDate).map(s => ({
      ticker: s.ticker,
      date:   s.earningsDate,
      tradingDaysAway: s.tradingDaysAway,
      note:   s.earningsNote,
    })),
    vix:       global.vix,
    vixRegime: global.vixRegime,
    sectors:   global.sectors,
    meta: {
      total:                 result.length,
      discoveredFromCalendar: result.filter(s => s.discoveredFromCalendar).length,
      calendarScanned:       calData.status === 'fulfilled' ? (calData.value?.earningsCalendar?.length ?? 0) : 0,
    },
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}
