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




// ── Twelve Data — primary price source ──────────────────────────────────────
// Batch endpoint: fetch up to 120 symbols in ONE API credit
const TD_BASE = 'https://api.twelvedata.com'
const TD_KEY  = process.env.TWELVE_DATA_API_KEY

function parseTdQuote(sym, d) {
  if (!d || d.status === 'error' || !d.close) return null
  const price     = parseFloat(d.close)
  const prevClose = parseFloat(d.previous_close)
  const changePct = parseFloat(d.percent_change || 0)
  if (!price || price <= 0) return null
  if (prevClose > 0 && Math.abs(price - prevClose) / prevClose > 0.40) return null
  if (price < 0.001 || price > 100000) return null
  return {
    symbol:    sym,
    price,
    changePct: parseFloat(changePct.toFixed(2)),
    change1d:  `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`,
    direction: changePct >= 0 ? 'up' : 'down',
    prevClose,
    source:    'twelvedata',
  }
}

// Batch fetch — one API credit for all symbols
async function tdBatch(symbols) {
  if (!TD_KEY || !symbols.length) return {}
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const syms = symbols.join(',')
    const res = await fetch(
      `${TD_BASE}/quote?symbol=${encodeURIComponent(syms)}&apikey=${TD_KEY}`,
      { cache: 'no-store', signal: controller.signal }
    )
    clearTimeout(timer)
    if (!res.ok) return {}
    const data = await res.json()
    const result = {}
    // Single symbol returns object directly; multiple returns {SYM: {...}, ...}
    if (symbols.length === 1) {
      const q = parseTdQuote(symbols[0], data)
      if (q) result[symbols[0]] = q
    } else {
      for (const sym of symbols) {
        if (data[sym]) {
          const q = parseTdQuote(sym, data[sym])
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

async function fetchQuote(sym) {
  // Try Twelve Data first
  const td = await tdQuote(sym)
  if (td) return td

  // Fall back to Finnhub
  try {
    const d = await fhSafe(`/quote?symbol=${encodeURIComponent(sym)}`)
    if (!d || d.c === 0 || d.c === null) return null
    const price     = d.c
    const prevClose = d.pc
    if (prevClose && prevClose > 0) {
      if (Math.abs(price - prevClose) / prevClose > 0.40) return null
    }
    if (price < 0.001 || price > 100000) return null
    const POST_SPLIT = { NFLX: [50, 150] }
    const splitRange = POST_SPLIT[sym]
    if (splitRange && (price < splitRange[0] || price > splitRange[1])) return null
    return {
      symbol:    sym,
      price,
      changePct: parseFloat((d.dp ?? 0).toFixed(2)),
      change1d:  `${(d.dp ?? 0) >= 0 ? '+' : ''}${(d.dp ?? 0).toFixed(2)}%`,
      direction: (d.dp ?? 0) >= 0 ? 'up' : 'down',
      prevClose,
      source:    'finnhub',
    }
  } catch { return null }
}
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

  // Step 1: Twelve Data batch — all symbols in ONE API credit
  const prices = {}
  if (TD_KEY) {
    const tdResults = await tdBatch(symbols)
    Object.assign(prices, tdResults)
  }

  // Step 2: Finnhub fallback for any TD misses
  const missed = symbols.filter(s => !prices[s])
  if (missed.length > 0) {
    const results = await Promise.allSettled(missed.map(fetchQuote))
    results.forEach((r, i) => {
      prices[missed[i]] = r.status === 'fulfilled' && r.value ? r.value : null
    })
  }

  // Fill nulls for any completely missing symbols
  symbols.forEach(s => { if (!(s in prices)) prices[s] = null })

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
