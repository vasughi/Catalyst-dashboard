/**
 * CATALYST — src/app/api/prices/route.js
 *
 * Lightweight price fetcher — only fetches the tickers you pass in.
 * Used by portfolio tabs so they don't have to load all 44 universe stocks.
 *
 * Usage: GET /api/prices?symbols=NVDA,AVGO,CRDO
 *
 * Returns live prices + today's % change for each symbol.
 * Falls back gracefully if any symbol fails.
 */

import { NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

const FH  = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY

// Sanity ranges — updated Jun 4 2026 based on real prices
// Same ranges as market-route.js — keep in sync
const SANITY = {
  NVDA:[100,500],  AMD:[80,500],    AVGO:[200,1000], TSM:[100,500],
  MRVL:[100,700],  ARM:[150,900],   QCOM:[100,500],  INTC:[10,100],
  MU:[70,300],     SMCI:[15,200],   CRDO:[80,800],   ANET:[70,350],
  MSFT:[200,900],  GOOGL:[160,700], META:[280,1200], AMZN:[150,400],
  AAPL:[150,400],  TSLA:[100,600],  NFLX:[50,200],   PLTR:[50,600],
  ORCL:[160,500],  NOW:[400,2500],  CRM:[100,500],   SNOW:[50,300],
  DDOG:[50,350],   NET:[30,250],    ADBE:[150,500],
  CRWD:[150,900],  PANW:[120,550],  ZS:[60,450],     FTNT:[40,300],
  LMT:[350,1200],  RTX:[50,350],    NOC:[300,1200],  AXON:[80,800],
  GD:[150,600],    VRT:[100,1200],  ETN:[150,900],   GEV:[200,2500],
  CEG:[80,800],    VST:[30,500],    FSLR:[50,600],   ENPH:[10,300],
  FCX:[20,200],    CCJ:[15,180],    RKLB:[5,200],    ASTS:[2,100],
  ACHR:[1,60],     IONQ:[3,80],     RGTI:[1,50],
  CRWV:[50,400],   MXL:[5,150],     AVAV:[80,400],   DOCU:[25,120],
}

async function fetchQuote(sym) {
  try {
    const res = await fetch(`${FH}/quote?symbol=${encodeURIComponent(sym)}&token=${KEY}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const d = await res.json()
    if (!d || d.c === 0) return null
    // Sanity range check
    const r = SANITY[sym]
    if (r && (d.c < r[0] || d.c > r[1])) return null
    // Drift check: reject if price differs from prevClose by >40% (Finnhub glitch)
    if (d.pc > 0 && Math.abs(d.c - d.pc) / d.pc > 0.40) return null
    return {
      ticker:    sym,
      price:     d.c,
      changePct: parseFloat((d.dp ?? 0).toFixed(2)),
      change1d:  `${(d.dp ?? 0) >= 0 ? '+' : ''}${(d.dp ?? 0).toFixed(2)}%`,
      direction: (d.dp ?? 0) >= 0 ? 'up' : 'down',
      prevClose: d.pc,
    }
  } catch { return null }
}

export async function GET(request) {
  if (!KEY) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY not set' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const symbolsParam = searchParams.get('symbols') || ''
  const symbols = [...new Set(
    symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  )].slice(0, 30) // cap at 30 to prevent abuse

  if (!symbols.length) {
    return NextResponse.json({ error: 'No symbols provided. Use ?symbols=NVDA,AVGO,CRDO' }, { status: 400 })
  }

  // Fire all requests in parallel — for small portfolios this is fast
  // For 10-15 stocks this takes ~1-2 seconds vs ~5 seconds for the full universe
  const results = await Promise.allSettled(symbols.map(fetchQuote))

  const prices = {}
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      prices[symbols[i]] = r.value
    } else {
      // Return null entry so caller knows which ones failed
      prices[symbols[i]] = null
    }
  })

  return NextResponse.json({
    prices,
    fetchedAt:  new Date().toISOString(),
    requested:  symbols.length,
    returned:   Object.values(prices).filter(Boolean).length,
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
