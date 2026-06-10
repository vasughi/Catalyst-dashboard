/**
 * CATALYST — src/app/api/technicals/route.js
 *
 * Computes SMA 20/50/200, trend, setup, entry quality for a list of tickers.
 * Called separately from the main opportunities load — never blocks it.
 *
 * Usage: GET /api/technicals?symbols=NVDA,AVGO,MRVL
 *
 * Results cached in module memory for 6 hours — fast after first call.
 * Vercel max function duration: 60s on Pro, 10s on Hobby.
 * We process max 5 stocks per call to stay well within limits.
 * Dashboard calls this in small batches spread over time.
 */

import { NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

// TwelveData provides daily candles on the free tier (Finnhub /stock/candle is premium-only now)
const TD     = 'https://api.twelvedata.com'
const TD_KEY = process.env.TWELVE_DATA_API_KEY
// Finnhub kept as fallback for quote only
const FH     = 'https://finnhub.io/api/v1'
const FH_KEY = process.env.FINNHUB_API_KEY

// ── Module-level cache ────────────────────────────────────────────────────────
// Vercel serverless functions may cold-start — cache helps within warm instances.
// TTL set to 4h so intraday refreshes are fast after first load.
const CACHE = {}
const TTL   = 4 * 60 * 60 * 1000

// Delay helper — stay within TwelveData free-tier rate limits (8 calls/min)
const delay = ms => new Promise(r => setTimeout(r, ms))

// Fetch daily closes from TwelveData /time_series (works on free tier)
// Returns array of closing prices oldest→newest, or null
// Fetch daily closes for MULTIPLE symbols in ONE call using TwelveData batch.
// TwelveData allows comma-separated symbols — this means 1 rate-limit hit for all
// 4 stocks instead of 4 separate hits (critical on the 8-calls/min free tier).
// Returns { SYM: [closes oldest→newest], ... } and a rateLimited flag.
async function getBatchCandles(symbols, days = 220) {
  if (!TD_KEY || !symbols.length) return { data: {}, rateLimited: false }
  const out = {}
  let rateLimited = false
  try {
    const syms = symbols.join(',')
    const url  = `${TD}/time_series?symbol=${encodeURIComponent(syms)}&interval=1day&outputsize=${days}&apikey=${TD_KEY}`
    const res  = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      if (res.status === 429) rateLimited = true
      return { data: {}, rateLimited }
    }
    const json = await res.json()

    // TwelveData returns different shapes for single vs multi symbol:
    // - single symbol: { values: [...], status: 'ok' }
    // - multi symbol:  { 'AAPL': { values: [...] }, 'MSFT': { values: [...] } }
    const extract = obj => {
      if (!obj) return null
      // 429 / error comes back as { code: 429, status: 'error', message: '...' }
      if (obj.status === 'error') {
        if (obj.code === 429 || /rate limit|api credits/i.test(obj.message || '')) rateLimited = true
        return null
      }
      if (!Array.isArray(obj.values) || obj.values.length < 20) return null
      const closes = obj.values.map(v => parseFloat(v.close)).filter(n => !isNaN(n) && n > 0).reverse()
      return closes.length >= 20 ? closes : null
    }

    if (symbols.length === 1) {
      out[symbols[0]] = extract(json)
    } else {
      for (const sym of symbols) out[sym] = extract(json[sym])
    }
  } catch {
    // network error — leave out empty
  }
  return { data: out, rateLimited }
}

function sma(closes, n) {
  if (!closes || closes.length < n) return null
  return parseFloat((closes.slice(-n).reduce((a,b)=>a+b,0)/n).toFixed(2))
}

// Compute technicals from already-fetched closes (no fetching here)
function computeTechnicals(sym, closes) {
  if (!closes || closes.length < 20) return null

  const p    = closes[closes.length - 1]
  const s20  = sma(closes, 20)
  const s50  = sma(closes, Math.min(50,  closes.length))
  const s200 = sma(closes, Math.min(200, closes.length))

  const pctAbove50  = s50  ? parseFloat(((p-s50) /s50 *100).toFixed(1)) : null
  const pctAbove200 = s200 ? parseFloat(((p-s200)/s200*100).toFixed(1)) : null

  // Trend
  let trend = 'UNKNOWN'
  if (s200 && s50 && s20) {
    if      (p>s200 && p>s50 && p>s20)  trend = 'STRONG UPTREND'
    else if (p>s200 && p>s50 && p<s20)  trend = 'PULLBACK IN UPTREND'
    else if (p>s200 && p<s50)           trend = 'RECOVERING'
    else if (p<s200)                    trend = 'DOWNTREND'
  }

  // Setup & entry quality
  let setup = 'NEUTRAL', entryQuality = 'AVERAGE'
  if (trend === 'STRONG UPTREND') {
    if (pctAbove50 !== null && pctAbove50 > -3 && pctAbove50 < 5) {
      setup = 'PULLBACK'; entryQuality = 'EXCELLENT'
    } else if (pctAbove50 !== null && pctAbove50 > 20) {
      setup = 'EXTENDED'; entryQuality = 'POOR'
    } else {
      setup = 'TRENDING'; entryQuality = 'GOOD'
    }
  } else if (trend === 'PULLBACK IN UPTREND') {
    setup = 'PULLBACK'; entryQuality = 'EXCELLENT'
  } else if (trend === 'RECOVERING') {
    setup = 'RECOVERY'; entryQuality = 'AVERAGE'
  } else if (trend === 'DOWNTREND') {
    setup = 'DOWNTREND'; entryQuality = 'POOR'
  }

  // Support & stop
  const smas = [{l:'20 SMA',v:s20},{l:'50 SMA',v:s50},{l:'200 SMA',v:s200}]
    .filter(s => s.v && s.v < p)
  const support = smas.length
    ? smas.reduce((a,b) => Math.abs(p-b.v)<Math.abs(p-a.v)?b:a)
    : null
  const stopLoss = support
    ? parseFloat((support.v*0.98).toFixed(2))
    : s200 ? parseFloat((s200*0.97).toFixed(2)) : null
  const distToStop = stopLoss
    ? parseFloat(((p-stopLoss)/p*100).toFixed(1)) : null

  const data = {
    sma20: s20, sma50: s50, sma200: s200,
    above200: s200 ? p > s200 : null,
    above50:  s50  ? p > s50  : null,
    pctAbove50, pctAbove200,
    trend, setup, entryQuality,
    nearestSupport:    support ? `${support.l} at $${support.v}` : null,
    suggestedStopLoss: stopLoss,
    distToStopPct:     distToStop,
    computedAt:        new Date().toISOString(),
  }

  return data
}

export async function GET(request) {
  if (!TD_KEY) return NextResponse.json({ error: 'TWELVE_DATA_API_KEY not set', technicals: {} }, { status: 200 })

  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('symbols') || ''
  // Up to 8 symbols — but they're fetched in ONE batch call, so only 1 rate-limit hit
  const symbols = [...new Set(raw.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean))].slice(0, 8)

  if (!symbols.length) return NextResponse.json({ error: 'No symbols. Use ?symbols=NVDA,AVGO', technicals: {} }, { status: 200 })

  const results = {}

  // 1. Serve from cache where fresh — these don't count against rate limit
  const needFetch = []
  for (const sym of symbols) {
    const c = CACHE[sym]
    if (c && Date.now() - c.ts < TTL) results[sym] = c.data
    else needFetch.push(sym)
  }

  // 2. Batch-fetch the rest in ONE TwelveData call (1 rate-limit hit for all)
  let rateLimited = false
  if (needFetch.length) {
    const { data: candlesBySym, rateLimited: rl } = await getBatchCandles(needFetch)
    rateLimited = rl
    for (const sym of needFetch) {
      const closes = candlesBySym[sym]
      const computed = closes ? computeTechnicals(sym, closes) : null
      results[sym] = computed
      if (computed) CACHE[sym] = { data: computed, ts: Date.now() }
    }
  }

  return NextResponse.json({
    technicals: results,
    cached: symbols.filter(s => { const c = CACHE[s]; return c && Date.now()-c.ts < TTL }).length,
    rateLimited,
    fetchedAt: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}
