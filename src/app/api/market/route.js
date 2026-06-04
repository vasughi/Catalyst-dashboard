/**
 * CATALYST v5 — src/app/api/market/route.js
 *
 * EVENT-DRIVEN DISCOVERY — no hardcoded stock list for opportunities.
 *
 * How it works:
 * 1. Pull Finnhub earnings calendar for next 45 days — ALL companies
 * 2. Filter to quality candidates (in our sector watchlist of ~160 tickers)
 * 3. Fetch live prices for the top 40 candidates
 * 4. Return ranked by days-to-earnings + sector strength
 *
 * This means PANW, CRWD, or any other stock with upcoming earnings
 * surfaces automatically — no manual list needed.
 *
 * Timeout safety:
 * - All Finnhub calls wrapped in 5s per-request timeout
 * - Max 3 parallel fetch batches
 * - Total budget: ~8s for market data phase
 *
 * Runtime: Node.js + maxDuration:60
 */

import { NextResponse } from 'next/server'

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

const FH  = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY

function resp(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control':'no-store' } })
}

// Per-request timeout wrapper — prevents any single Finnhub call hanging
async function fhSafe(path, timeoutMs = 4000) {
  try {
    const sep = path.includes('?') ? '&' : '?'
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const r = await fetch(`${FH}${path}${sep}token=${KEY}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!r.ok) return null
    return r.json()
  } catch { return null }
}

// ── Quality watchlist ─────────────────────────────────────────────────────────
// ~160 tickers across AI, semiconductors, cloud, cyber, defence, energy, power.
// This is a QUALITY FILTER not a display list — any stock with upcoming earnings
// that appears in this list gets surfaced automatically.
// Add/remove tickers here to change which sectors you follow.
// ── QUALITY UNIVERSE — your sector watchlist ─────────────────────────────────
// Two layers of coverage:
//
// Layer 1: QUALITY_UNIVERSE — named tickers you follow.
//   Any stock in this set with upcoming earnings surfaces automatically.
//   Add new tickers freely — the calendar scan catches them.
//
// Layer 2: SECTOR_KEYWORDS — catch-all for unknown stocks.
//   Any stock from the Finnhub earnings calendar whose company name
//   contains these keywords also gets included, even if not in Layer 1.
//   This catches new IPOs, renamed companies, and stocks not yet on your radar.

const QUALITY_UNIVERSE = new Set([
  // ── AI silicon & semiconductors ───────────────────────────────────────────
  'NVDA','AMD','AVGO','TSM','MRVL','ARM','QCOM','INTC','MU',
  'AMAT','LRCX','KLAC','SNPS','CDNS','TXN','ADI','MCHP','ON',
  'SWKS','QRVO','CRUS','SMCI','DELL','HPE','NTAP','STX','WDC',
  'CRDO','ANET','CIEN','INFN','LITE','COHR','VIAV','IIVI',
  'WOLF','ALGM','MPWR','DIOD','SITM','AMBA','SLAB','FORM',
  // ── Big tech / AI platforms ───────────────────────────────────────────────
  'MSFT','GOOGL','GOOG','META','AMZN','AAPL','TSLA','NFLX',
  'CRM','ORCL','SAP','NOW','SNOW','DDOG','NET','CFLT','MDB',
  'ESTC','GTLB','PATH','AI','PLTR','PEGA','BBAI','SOUN',
  'UBER','LYFT','SPOT','PINS','SNAP','RDDT','HOOD',
  // ── AI infrastructure / data centre ──────────────────────────────────────
  'EQIX','DLR','AMT','CCI','SBAC','CONE','QTS','SWITCH',
  // ── Cybersecurity ─────────────────────────────────────────────────────────
  'CRWD','PANW','ZS','FTNT','S','CYBR','TENB','RPD',
  'VRNT','RDWR','CHKP','SAIL','QLYS','OKTA','PING','JAMF',
  'NET','OSPN','SCWX','CFLT','SAIL','ZTNA','DDOG',
  // ── Quantum computing ──────────────────────────────────────────────────────
  'IONQ','RGTI','QUBT','QMCO','IBM','QTUM','ARQQ',
  'QBTS','BFLY','DEFN','SPIR','QUBT','ATOS','HON',
  // ── Defence & aerospace ───────────────────────────────────────────────────
  'LMT','RTX','NOC','GD','BA','HII','AXON','KTOS','AVAV',
  'HEI','TDG','TXT','LDOS','SAIC','CACI','BAH','MRCY',
  'VEC','L3H','FLIR','DRS','PARSONS','BWXT','CW','HEICO',
  'MOOG','DXC','CSPI','OSIS','VRSN',
  // ── Space, drones & autonomy ──────────────────────────────────────────────
  'RKLB','LUNR','ACHR','JOBY','ASTS','SPCE','MNTS','LLAP',
  'ASTR','IRDM','MAXR','BKSY','SATL','GSAT','SWIR',
  // ── Power grid, data centre power, energy transition ─────────────────────
  'VRT','ETN','EMR','GEV','CEG','VST','NRG','EXC','AEP',
  'NEE','PCG','EIX','XEL','FSLR','ENPH','RUN','ARRY',
  'CWEN','BE','PLUG','BLDP','NEP','ORA','AES','ELP',
  'AMRC','NOVA','SPWR','SHLS','REGI','GNRC','FLNC',
  // ── Nuclear ───────────────────────────────────────────────────────────────
  'CCJ','LEU','SMR','NNE','OKLO','BWX','BWXT','X-ENERGY',
  // ── Critical minerals, commodities & supply chain ─────────────────────────
  'FCX','NEM','GOLD','AEM','WPM','RIO','BHP','CLF',
  'AA','CENX','MP','UUUU','LTHM','LAC','PLL','SLI',
  'ALB','SGML','NOVS','CRAG',
  // ── Fintech, payments & crypto infrastructure ─────────────────────────────
  'V','MA','PYPL','SQ','AFRM','SOFI','NU','COIN',
  'MSTR','MARA','RIOT','CLSK','HIVE','HUT','BTBT',
  // ── Cloud / SaaS / enterprise software ───────────────────────────────────
  'ADBE','INTU','WDAY','TEAM','ZM','DOCU','COUP','HUBS',
  'MNDY','BILL','PCTY','PAYC','VEEV','SMAR','BOX','DBX',
  // ── Semiconductors equipment & materials ──────────────────────────────────
  'ONTO','COHU','ACLS','ICHR','UCTT','AEHR','MKSI','ENTG',
  // ── Healthcare / biotech (selective — high-move names) ────────────────────
  'UNH','LLY','ABBV','MRK','PFE','AMGN','GILD','REGN',
  'VRTX','MRNA','BNTX','NVAX','SGEN','ALNY','BMRN',
  // ── Industrial / automation / robotics ───────────────────────────────────
  'HON','ROP','IDEX','ITW','PH','AME','GNRC','ROK',
  'ABB','ISRG','IRBT','NVEI','MZOR','GRBX',
  // ── Your specific T212 holdings — always included ─────────────────────────
  'CRWV','ASTS','MXL','UMAC','RCAT','NBIS','KTOS','ONDS',
  'AMPX','AVAV','ARMG','TAKOF','ESLT',
])

// Note: SECTOR_KEYWORDS approach was considered but Finnhub free tier
// doesn't return company names in earnings calendar — so symbol-based
// matching via QUALITY_UNIVERSE is the reliable approach.

// Known company names — auto-extended from calendar data
const KNOWN_NAMES = {
  NVDA:'NVIDIA', AMD:'AMD', AVGO:'Broadcom', TSM:'TSMC', MRVL:'Marvell',
  ARM:'Arm', INTC:'Intel', QCOM:'Qualcomm', ANET:'Arista', CRDO:'Credo',
  CIEN:'Ciena', MSFT:'Microsoft', GOOGL:'Alphabet', GOOG:'Alphabet',
  META:'Meta', AMZN:'Amazon', AAPL:'Apple', PLTR:'Palantir',
  NOW:'ServiceNow', DELL:'Dell', SMCI:'SuperMicro', CRWD:'CrowdStrike',
  PANW:'Palo Alto', ZS:'Zscaler', S:'SentinelOne', FTNT:'Fortinet',
  LMT:'Lockheed', RTX:'RTX', NOC:'Northrop', AXON:'Axon', GD:'Gen Dynamics',
  RKLB:'RocketLab', ASTS:'AST SpaceMobile', VRT:'Vertiv', ETN:'Eaton',
  CEG:'Constellation', VST:'Vistra', GEV:'GE Vernova', NRG:'NRG Energy',
  FSLR:'First Solar', ENPH:'Enphase', FCX:'Freeport', CCJ:'Cameco',
  CRM:'Salesforce', ORCL:'Oracle', SNOW:'Snowflake', DDOG:'Datadog',
  NET:'Cloudflare', NFLX:'Netflix', TSLA:'Tesla', COIN:'Coinbase',
  KTOS:'Kratos Defense', AVAV:'AeroVironment', BA:'Boeing', HON:'Honeywell',
}

// ── Sanity price ranges — wide enough to not filter legitimate prices ─────────
// Only stocks we know well — unknown stocks skip sanity check

async function safeQuote(sym) {
  try {
    const d = await fhSafe(`/quote?symbol=${encodeURIComponent(sym)}`)
    if (!d || d.c === 0 || d.c === null) return null

    const price    = d.c
    const prevClose = d.pc

    // Validation 1: prevClose must be present and non-zero
    if (!prevClose || prevClose <= 0) return null

    // Validation 2: drift check — reject if price moved >40% from yesterday
    // This catches: split-adjusted prices (NFLX 1200% drift), stale cached data,
    // and Finnhub glitches. It ALLOWS genuine gap-ups (MRVL +33% is fine).
    const drift = Math.abs(price - prevClose) / prevClose
    if (drift > 0.40) return null

    // Validation 3: minimal post-split overrides for known Finnhub issues
    // Only needed when Finnhub's prevClose itself is stale/wrong
    const POST_SPLIT = {
      NFLX: [50, 150],   // 10-for-1 split Nov 2025. Real price ~$83-95
    }
    const splitRange = POST_SPLIT[sym]
    if (splitRange && (price < splitRange[0] || price > splitRange[1])) return null

    return {
      symbol:    sym,
      price,
      changePct: parseFloat((d.dp ?? 0).toFixed(2)),
      change1d:  `${(d.dp ?? 0) >= 0 ? '+' : ''}${(d.dp ?? 0).toFixed(2)}%`,
      direction: (d.dp ?? 0) >= 0 ? 'up' : 'down',
      prevClose,
    }
  } catch { return null }
}

// Fetch prices in batches — max 10 parallel, 100ms between batches
async function fetchPrices(syms) {
  const BATCH = 10, DELAY = 50
  const map = {}
  for (let i = 0; i < syms.length; i += BATCH) {
    const batch = syms.slice(i, i + BATCH)
    const res   = await Promise.allSettled(batch.map(safeQuote))
    res.forEach((r, j) => {
      if (r.status === 'fulfilled' && r.value) map[batch[j]] = r.value
    })
    if (i + BATCH < syms.length) await new Promise(r => setTimeout(r, DELAY))
  }
  return map
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function isoDate(d) { return d.toISOString().split('T')[0] }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function tradingDaysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr), now = new Date()
  if (target < now) return -1
  let days = 0, cur = new Date(now)
  while (cur < target) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) days++
  }
  return days
}

// ── Fallback earnings dates ───────────────────────────────────────────────────
// Used when Finnhub calendar misses a confirmed date
const FALLBACK_DATES = {
  META: { date:'2026-07-29', note:'confirmed' },
  VRT:  { date:'2026-08-05', note:'confirmed' },
  MRVL: { date:'2026-08-20', note:'confirmed' },
  ARM:  { date:'2026-07-29', note:'confirmed' },
  GEV:  { date:'2026-07-23', note:'est' },
  NOW:  { date:'2026-07-23', note:'est' },
  FCX:  { date:'2026-07-16', note:'est' },
  GOOGL:{ date:'2026-07-22', note:'est' },
  MSFT: { date:'2026-07-28', note:'est' },
  AMD:  { date:'2026-07-29', note:'est' },
  ANET: { date:'2026-07-29', note:'est' },
  PLTR: { date:'2026-08-04', note:'est' },
  SMCI: { date:'2026-08-05', note:'est' },
  VST:  { date:'2026-08-07', note:'est' },
  CEG:  { date:'2026-08-07', note:'est' },
  CCJ:  { date:'2026-08-07', note:'est' },
  NVDA: { date:'2026-08-27', note:'est' },
  CRWD: { date:'2026-08-26', note:'est' },
  ORCL: { date:'2026-06-10', note:'confirmed' },  // Confirmed Jun 10 2026
  ADBE: { date:'2026-06-17', note:'est' },
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  if (!KEY) return resp({ error: 'FINNHUB_API_KEY not set' }, 500)

  // ── OPPORTUNITIES — event-driven discovery ─────────────────────────────────
  if (type === 'opportunities') {
    const today = new Date()
    const in45  = addDays(today, 45)

    // Phase 1: Fetch everything in parallel
    // - Full earnings calendar (all stocks) for next 45 days
    // - Sector ETF prices for context
    // - VIX
    const [rawCalendar, sectorQ, vixQ] = await Promise.all([
      fhSafe(`/calendar/earnings?from=${isoDate(today)}&to=${isoDate(in45)}`).then(d => d?.earningsCalendar || []),
      fetchPrices(['XLK','ITA','XSD','CIBR','XLE']),
      safeQuote('VIXY'),
    ])

    // Phase 2: Filter calendar to quality universe
    // Build a map of upcoming earnings for quality stocks only
    const earningsMap = {}

    // From live calendar — filter to quality universe
    // Finnhub free tier doesn't return company names in calendar,
    // so we match on ticker symbol only (Layer 1 has 279 quality tickers)
    rawCalendar.forEach(e => {
      if (!e.symbol) return
      if (!QUALITY_UNIVERSE.has(e.symbol)) return  // not a stock we follow

      const days = tradingDaysUntil(e.date)
      if (days === null || days < 0 || days > 45) return

      // Keep the entry with the soonest date if duplicate
      if (!earningsMap[e.symbol] || days < earningsMap[e.symbol].tradingDaysAway) {
        earningsMap[e.symbol] = {
          ticker:          e.symbol,
          date:            e.date,
          tradingDaysAway: days,
          epsEstimate:     e.epsEstimate ?? null,
          source:          'finnhub',
          discoveryMethod: 'calendar',
        }
      }
    })

    // Fill gaps with fallback dates
    Object.entries(FALLBACK_DATES).forEach(([ticker, fb]) => {
      if (!earningsMap[ticker]) {
        const days = tradingDaysUntil(fb.date)
        if (days !== null && days >= 0 && days <= 45) {
          earningsMap[ticker] = {
            ticker, date: fb.date, tradingDaysAway: days,
            epsEstimate: null,
            source: fb.note === 'confirmed' ? 'confirmed' : 'estimate',
            discoveryMethod: 'fallback',
          }
        }
      }
    })

    // Phase 3: Also include quality stocks WITHOUT confirmed earnings
    // (so NVDA, MRVL etc still appear as WATCH candidates)
    // Add top watchlist stocks that aren't already in earningsMap
    // Core stocks — always appear regardless of earnings calendar
    // Split into: AI/semis core, cybersecurity core, quantum core, energy/defence core
    const ALWAYS_INCLUDE = [
      // AI & semiconductors — your core
      'NVDA','AMD','AVGO','MRVL','ARM','PLTR','META','MSFT','GOOGL','AMZN',
      // Cybersecurity — always visible
      'CRWD','PANW','ZS','NET','FTNT','S',
      // Quantum computing — always visible
      'IONQ','RGTI','QUBT','IBM','QMCO',
      // Power / energy / defence
      'VRT','GEV','ETN','CEG','LMT','AXON',
      // Other core holdings
      'CRDO','ANET','NOW','TSLA',
    ]
    ALWAYS_INCLUDE.forEach(ticker => {
      if (!earningsMap[ticker]) {
        // Check fallback for extended dates (45-90 days)
        const fb = FALLBACK_DATES[ticker]
        if (fb) {
          const days = tradingDaysUntil(fb.date)
          if (days !== null && days >= 0) {
            earningsMap[ticker] = {
              ticker, date: fb.date, tradingDaysAway: days,
              epsEstimate: null, source: fb.note === 'confirmed' ? 'confirmed' : 'estimate',
            }
          }
        } else {
          // Include as watchlist with no earnings date
          earningsMap[ticker] = {
            ticker, date: null, tradingDaysAway: null,
            epsEstimate: null, source: null,
            discoveryMethod: 'watchlist',
          }
        }
      }
    })

    // Phase 4: Fetch prices for all candidates (up to 50)
    const candidates = Object.keys(earningsMap)
    // Prioritise: earnings within 45 days first, then watches
    const prioritised = candidates.sort((a, b) => {
      const aD = earningsMap[a].tradingDaysAway ?? 999
      const bD = earningsMap[b].tradingDaysAway ?? 999
      return aD - bD
    }).slice(0, 45)  // cap at 45 — quality filter keeps this manageable

    const priceMap = await fetchPrices(prioritised)

    // Phase 5: Build stock objects
    const stocks = prioritised
      .filter(sym => priceMap[sym])  // only include stocks with valid prices
      .map(sym => {
        const q  = priceMap[sym]
        const ec = earningsMap[sym]
        return {
          ticker:       sym,
          name:         KNOWN_NAMES[sym] || sym,
          price:        q.price,
          priceFormatted: `$${q.price.toFixed(2)}`,
          changePct:    q.changePct,
          change1d:     `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`,
          direction:    q.changePct >= 0 ? 'up' : 'down',
          bigMoverToday: Math.abs(q.changePct) > 8,
          earningsDate:            ec.date ?? null,
          earningsTradingDaysAway: ec.tradingDaysAway ?? null,
          epsEstimate:             ec.epsEstimate ?? null,
          earningsSource:          ec.source ?? null,
          hasVerifiedEarnings:     !!ec.date,
          discoveredFromCalendar:  ec.source === 'finnhub',
          discoveryMethod:         ec.discoveryMethod || null,  // 'calendar' | 'fallback' | 'watchlist'
        }
      })
      .sort((a, b) => {
        const aD = a.earningsTradingDaysAway ?? 999
        const bD = b.earningsTradingDaysAway ?? 999
        if (aD !== bD) return aD - bD
        return Math.abs(b.changePct) - Math.abs(a.changePct)
      })

    // Build earnings calendar for UI display
    const calendarItems = Object.values(earningsMap)
      .filter(e => e.date)
      .sort((a, b) => (a.tradingDaysAway ?? 999) - (b.tradingDaysAway ?? 999))

    // VIX + sectors
    const vix    = vixQ?.price ?? null
    const regime = vix ? (vix > 25 ? 'HIGH_FEAR' : vix > 18 ? 'ELEVATED' : 'CALM') : 'UNKNOWN'

    const mkSector = (sym, label) => {
      const q = sectorQ[sym]; if (!q) return null
      return {
        label, changePct: q.changePct,
        direction: q.changePct >= 0 ? 'BULLISH' : 'BEARISH',
        change: `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`,
      }
    }
    const sectors = [
      mkSector('XLK','Technology'), mkSector('XSD','Semiconductors'),
      mkSector('ITA','Defence'),    mkSector('CIBR','Cybersecurity'),
      mkSector('XLE','Energy'),
    ].filter(Boolean)

    return resp({
      meta: {
        fetchedAt:        new Date().toISOString(),
        stocksReturned:   stocks.length,
        discoveredFromCalendar: stocks.filter(s => s.discoveredFromCalendar).length,
        calendarScanned:  rawCalendar.length,
      },
      vix, vixRegime: regime, sectors, stocks, companyNews: {},
      earningsCalendar: calendarItems,
    })
  }

  // ── GLOBAL MACRO ─────────────────────────────────────────────────────────────
  if (type === 'global') {
    const fxQ = async sym => {
      try {
        const d = await fhSafe(`/quote?symbol=${encodeURIComponent(sym)}`)
        if (!d || d.c === 0) return null
        return { price: d.c, changePct: d.dp ?? 0 }
      } catch { return null }
    }

    const [indices, comms, sectorQ, vixQ, gbpusd, eurusd, usdjpy] = await Promise.all([
      fetchPrices(['SPY','QQQ','DIA','IWM','EWG','EWQ','EWJ']),
      fetchPrices(['USO','GLD','CPER']),
      fetchPrices(['XLK','ITA','XSD','CIBR','XLE','XLI']),
      safeQuote('VIXY'),
      fxQ('GBPUSD'), fxQ('EURUSD'), fxQ('USDJPY'),
    ])

    const vix    = vixQ?.price ?? null
    const regime = vix ? (vix>25?'HIGH_FEAR':vix>18?'ELEVATED':'CALM') : 'UNKNOWN'
    const fmtQ   = (q, name) => !q ? null : {
      name, value: q.price.toLocaleString('en-US', { maximumFractionDigits:2 }),
      change: `${(q.changePct??0)>=0?'+':''}${(q.changePct??0).toFixed(2)}%`,
      direction: (q.changePct??0) >= 0 ? 'up' : 'down',
    }
    const mkS = (sym, label) => {
      const q = sectorQ[sym]; if (!q) return null
      return { label, changePct:q.changePct, direction:q.changePct>=0?'up':'down', change:`${q.changePct>=0?'+':''}${q.changePct.toFixed(2)}%` }
    }

    return resp({
      meta: { fetchedAt: new Date().toISOString() }, vix, vixRegime: regime,
      indices: [
        fmtQ(indices['SPY'],'S&P 500'),   fmtQ(indices['QQQ'],'NASDAQ 100'),
        fmtQ(indices['DIA'],'Dow Jones'),  fmtQ(indices['IWM'],'Russell 2000'),
        fmtQ(indices['EWG'],'DAX'),        fmtQ(indices['EWQ'],'CAC 40'),
        fmtQ(indices['EWJ'],'Nikkei'),
      ].filter(Boolean),
      sectors: [
        mkS('XLK','Technology'), mkS('XSD','Semiconductors'),
        mkS('ITA','Defence'),    mkS('CIBR','Cybersecurity'),
        mkS('XLE','Energy'),     mkS('XLI','Industrials'),
      ].filter(Boolean),
      commodities: [
        comms['USO']  && comms['USO'].price  < 200 ? fmtQ(comms['USO'], 'WTI Oil')  : null,
        comms['GLD']  && comms['GLD'].price  < 500 ? fmtQ(comms['GLD'], 'Gold')     : null,
        comms['CPER'] && comms['CPER'].price < 100 ? fmtQ(comms['CPER'],'Copper')   : null,
      ].filter(Boolean),
      currencies: [
        gbpusd ? { pair:'GBP/USD', value:gbpusd.price.toFixed(4), change:`${gbpusd.changePct>=0?'+':''}${gbpusd.changePct.toFixed(2)}%` } : null,
        eurusd ? { pair:'EUR/USD', value:eurusd.price.toFixed(4), change:`${eurusd.changePct>=0?'+':''}${eurusd.changePct.toFixed(2)}%` } : null,
        usdjpy ? { pair:'USD/JPY', value:usdjpy.price.toFixed(2),  change:`${usdjpy.changePct>=0?'+':''}${usdjpy.changePct.toFixed(2)}%` } : null,
      ].filter(Boolean),
    })
  }

  return resp({ error: `Unknown type: ${type}` }, 400)
}
