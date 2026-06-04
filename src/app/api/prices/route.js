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



async function fetchQuote(sym) {
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
