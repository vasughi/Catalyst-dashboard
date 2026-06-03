/**
 * CATALYST — src/app/api/market/route.js
 *
 * Node.js runtime with maxDuration = 60s (Vercel Pro/Hobby extended)
 * Edge runtime has a 6-connection limit which breaks parallel Finnhub fetches.
 * Node.js has no connection limit and maxDuration extends the timeout.
 */

import { NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60  // seconds — requires Vercel Pro or Hobby with fluid compute

const FH  = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY

function resp(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

async function fh(path) {
  const sep = path.includes('?') ? '&' : '?'
  const r = await fetch(`${FH}${path}${sep}token=${KEY}`, { cache: 'no-store' })
  if (!r.ok) return null
  return r.json()
}

const SANITY = {
  NVDA:[80,350],  AMD:[80,350],   AVGO:[150,950], TSM:[100,350],  MRVL:[50,500],
  ARM:[80,750],   MSFT:[300,750], GOOGL:[100,650],META:[300,950], PLTR:[50,450],
  DELL:[80,300],  SMCI:[20,200],  CRWD:[200,700], PANW:[100,400], ZS:[100,400],
  LMT:[300,1000], RTX:[50,300],   NOC:[300,1000], AXON:[100,600], VRT:[100,800],
  ETN:[150,600],  CEG:[100,600],  FSLR:[50,600],  ANET:[50,250],  RKLB:[5,100],
  GEV:[200,2000], VST:[30,500],   NOW:[500,2200], CRDO:[50,700],  FCX:[20,200],
  CCJ:[20,150],   ENPH:[20,400],  QCOM:[100,400], GD:[150,500],
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

// Small batches to respect Finnhub 60 req/min free tier
async function quotesAll(syms) {
  const BATCH = 10
  const map   = {}
  for (let i = 0; i < syms.length; i += BATCH) {
    const batch = syms.slice(i, i + BATCH)
    const res   = await Promise.allSettled(batch.map(quote))
    res.forEach((r, j) => {
      if (r.status === 'fulfilled' && r.value) map[batch[j]] = r.value
    })
    if (i + BATCH < syms.length) await new Promise(r => setTimeout(r, 150))
  }
  return map
}

async function earningsCalendar(from, to) {
  try {
    const d = await fh(`/calendar/earnings?from=${from}&to=${to}`)
    return d?.earningsCalendar || []
  } catch { return [] }
}

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

const NAMES = {
  NVDA:'NVIDIA', AMD:'AMD', AVGO:'Broadcom', TSM:'TSMC', MRVL:'Marvell',
  ARM:'Arm', INTC:'Intel', QCOM:'Qualcomm', ANET:'Arista', CRDO:'Credo',
  MSFT:'Microsoft', GOOGL:'Alphabet', META:'Meta', PLTR:'Palantir',
  NOW:'ServiceNow', DELL:'Dell', SMCI:'SuperMicro', CRWD:'CrowdStrike',
  PANW:'Palo Alto', ZS:'Zscaler', LMT:'Lockheed', RTX:'RTX',
  NOC:'Northrop', AXON:'Axon', GD:'Gen Dynamics',
  RKLB:'RocketLab', VRT:'Vertiv', ETN:'Eaton',
  CEG:'Constellation', VST:'Vistra', GEV:'GE Vernova',
  FSLR:'FirstSolar', FCX:'Freeport', CCJ:'Cameco',
}

const FALLBACK = {
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
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  if (!KEY) return resp({ error: 'FINNHUB_API_KEY not set' }, 500)

  if (type === 'opportunities') {
    const UNIVERSE = [
      'NVDA','AMD','AVGO','TSM','MRVL','ARM','QCOM',
      'ANET','CRDO','MSFT','GOOGL','META','PLTR','NOW',
      'DELL','SMCI','CRWD','PANW','ZS',
      'LMT','RTX','NOC','AXON','GD','RKLB',
      'VRT','ETN','CEG','VST','GEV','FSLR','FCX','CCJ',
    ]

    const today = new Date()
    const in60  = addDays(today, 60)

    // Run in parallel — quotesAll handles batching internally
    const [stockQ, calendarRaw, sectorQ, vixQ] = await Promise.all([
      quotesAll(UNIVERSE),
      earningsCalendar(isoDate(today), isoDate(in60)),
      quotesAll(['XLK','ITA','XSD','CIBR','XLE']),
      quote('VIXY'),
    ])

    // Build earnings map
    const earningsMap = {}
    calendarRaw.filter(e => UNIVERSE.includes(e.symbol)).forEach(e => {
      const days = tradingDaysUntil(e.date)
      if (days !== null && days >= 0) {
        earningsMap[e.symbol] = { ticker:e.symbol, date:e.date, tradingDaysAway:days, epsEstimate:e.epsEstimate??null, source:'finnhub' }
      }
    })
    Object.entries(FALLBACK).forEach(([ticker, fb]) => {
      if (!earningsMap[ticker]) {
        const days = tradingDaysUntil(fb.date)
        if (days !== null && days >= 0) {
          earningsMap[ticker] = { ticker, date:fb.date, tradingDaysAway:days, epsEstimate:null, source:fb.note==='confirmed'?'confirmed':'estimate' }
        }
      }
    })

    const vix    = vixQ?.price ?? null
    const regime = vix ? (vix>25?'HIGH_FEAR':vix>18?'ELEVATED':'CALM') : 'UNKNOWN'

    const mkSector = (sym, label) => {
      const q = sectorQ[sym]; if (!q) return null
      return { label, changePct:q.changePct, direction:q.changePct>=0?'BULLISH':'BEARISH', change:`${q.changePct>=0?'+':''}${q.changePct.toFixed(2)}%` }
    }
    const sectors = [
      mkSector('XLK','Technology'), mkSector('XSD','Semiconductors'),
      mkSector('ITA','Defence'), mkSector('CIBR','Cybersecurity'), mkSector('XLE','Energy'),
    ].filter(Boolean)

    const stocks = UNIVERSE.filter(sym => stockQ[sym]).map(sym => {
      const q = stockQ[sym], ec = earningsMap[sym]||null
      return {
        ticker:sym, name:NAMES[sym]||sym,
        price:q.price, priceFormatted:`$${q.price.toFixed(2)}`,
        changePct:q.changePct, change1d:`${q.changePct>=0?'+':''}${q.changePct.toFixed(2)}%`,
        direction:q.changePct>=0?'up':'down', bigMoverToday:Math.abs(q.changePct)>8,
        earningsDate:ec?.date??null, earningsTradingDaysAway:ec?.tradingDaysAway??null,
        epsEstimate:ec?.epsEstimate??null, earningsSource:ec?.source??null, hasVerifiedEarnings:!!ec,
      }
    }).sort((a,b) => {
      const aD=a.earningsTradingDaysAway??999, bD=b.earningsTradingDaysAway??999
      if (aD!==bD) return aD-bD
      return Math.abs(b.changePct)-Math.abs(a.changePct)
    })

    return resp({
      meta:{ fetchedAt:new Date().toISOString(), stocksReturned:stocks.length },
      vix, vixRegime:regime, sectors, stocks, companyNews:{},
      earningsCalendar:Object.values(earningsMap).sort((a,b)=>a.tradingDaysAway-b.tradingDaysAway),
    })
  }

  if (type === 'global') {
    const fxQ = async sym => {
      try {
        const d = await fh(`/quote?symbol=${encodeURIComponent(sym)}`)
        if (!d||d.c===0) return null
        return { price:d.c, changePct:d.dp??0 }
      } catch { return null }
    }

    const [indices, comms, sectorQ, vixQ, gbpusd, eurusd, usdjpy] = await Promise.all([
      quotesAll(['SPY','QQQ','DIA','IWM','EWG','EWQ','EWJ']),
      quotesAll(['USO','GLD','CPER']),
      quotesAll(['XLK','ITA','XSD','CIBR','XLE','XLI']),
      quote('VIXY'),
      fxQ('GBPUSD'), fxQ('EURUSD'), fxQ('USDJPY'),
    ])

    const vix    = vixQ?.price??null
    const regime = vix?(vix>25?'HIGH_FEAR':vix>18?'ELEVATED':'CALM'):'UNKNOWN'
    const fmtQ   = (q,name) => !q?null:{ name, value:q.price.toLocaleString('en-US',{maximumFractionDigits:2}), change:`${(q.changePct??0)>=0?'+':''}${(q.changePct??0).toFixed(2)}%`, direction:(q.changePct??0)>=0?'up':'down' }
    const mkS    = (sym,label) => { const q=sectorQ[sym];if(!q)return null;return{label,changePct:q.changePct,direction:q.changePct>=0?'up':'down',change:`${q.changePct>=0?'+':''}${q.changePct.toFixed(2)}%`} }

    return resp({
      meta:{ fetchedAt:new Date().toISOString() }, vix, vixRegime:regime,
      indices:[fmtQ(indices['SPY'],'S&P 500'),fmtQ(indices['QQQ'],'NASDAQ 100'),fmtQ(indices['DIA'],'Dow Jones'),fmtQ(indices['IWM'],'Russell 2000'),fmtQ(indices['EWG'],'DAX'),fmtQ(indices['EWQ'],'CAC 40'),fmtQ(indices['EWJ'],'Nikkei')].filter(Boolean),
      sectors:[mkS('XLK','Technology'),mkS('XSD','Semiconductors'),mkS('ITA','Defence'),mkS('CIBR','Cybersecurity'),mkS('XLE','Energy'),mkS('XLI','Industrials')].filter(Boolean),
      commodities:[comms['USO']&&comms['USO'].price<200?fmtQ(comms['USO'],'WTI Oil'):null,comms['GLD']&&comms['GLD'].price<500?fmtQ(comms['GLD'],'Gold'):null,comms['CPER']&&comms['CPER'].price<100?fmtQ(comms['CPER'],'Copper'):null].filter(Boolean),
      currencies:[gbpusd?{pair:'GBP/USD',value:gbpusd.price.toFixed(4),change:`${gbpusd.changePct>=0?'+':''}${gbpusd.changePct.toFixed(2)}%`}:null,eurusd?{pair:'EUR/USD',value:eurusd.price.toFixed(4),change:`${eurusd.changePct>=0?'+':''}${eurusd.changePct.toFixed(2)}%`}:null,usdjpy?{pair:'USD/JPY',value:usdjpy.price.toFixed(2),change:`${usdjpy.changePct>=0?'+':''}${usdjpy.changePct.toFixed(2)}%`}:null].filter(Boolean),
    })
  }

  return resp({ error:`Unknown type: ${type}` }, 400)
}
