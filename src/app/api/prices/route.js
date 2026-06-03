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

// Wide sanity ranges — just catches obvious glitches
const SANITY = {
  NVDA:[50,350], AMD:[50,350],  AVGO:[100,900], TSM:[50,350],   MRVL:[30,500],
  ARM:[50,700],  MSFT:[200,700],GOOGL:[80,600], META:[300,900], PLTR:[20,400],
  DELL:[50,300], SMCI:[10,200], CRWD:[100,700], PANW:[60,350],  ZS:[50,400],
  LMT:[300,900], RTX:[50,300],  NOC:[300,900],  AXON:[50,600],  VRT:[80,700],
  ETN:[100,600], CEG:[80,600],  FSLR:[50,600],  ANET:[30,250],  RKLB:[5,100],
  GEV:[100,1800],VST:[30,350],  NOW:[400,2000], CRDO:[50,600],  FCX:[20,200],
  CCJ:[20,150],  ENPH:[20,300], ASTS:[5,100],   CRWV:[50,400],  MXL:[5,150],
}

async function fetchQuote(sym) {
  try {
    const res = await fetch(`${FH}/quote?symbol=${encodeURIComponent(sym)}&token=${KEY}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const d = await res.json()
    if (!d || d.c === 0) return null
    // Sanity check
    const r = SANITY[sym]
    if (r && (d.c < r[0] || d.c > r[1])) return null
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
