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

    // Validation 1: drift check — only if prevClose is available and valid
    // If prevClose missing, accept price (can't validate drift without it)
    if (prevClose && prevClose > 0) {
      const drift = Math.abs(price - prevClose) / prevClose
      // Reject if moved >40% in one day (catches split-price glitches)
      if (drift > 0.40) return null
    }
    // Reject if price is implausibly low (< $0.001) or high (> $100000)
    if (price < 0.001 || price > 100000) return null

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
