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
async function getDailyCandles(sym, days = 220) {
  if (!TD_KEY) return null
  try {
    const url = `${TD}/time_series?symbol=${encodeURIComponent(sym)}&interval=1day&outputsize=${days}&apikey=${TD_KEY}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const d = await res.json()
    if (d.status === 'error' || !Array.isArray(d.values) || d.values.length < 20) return null
    // TwelveData returns newest first — reverse to oldest→newest for SMA
    const closes = d.values
      .map(v => parseFloat(v.close))
      .filter(n => !isNaN(n) && n > 0)
      .reverse()
    return closes.length >= 20 ? closes : null
  } catch {
    return null
  }
}

function sma(closes, n) {
  if (!closes || closes.length < n) return null
  return parseFloat((closes.slice(-n).reduce((a,b)=>a+b,0)/n).toFixed(2))
}

async function computeTechnicals(sym, price) {
  // Check cache first
  const cached = CACHE[sym]
  if (cached && Date.now() - cached.ts < TTL) return cached.data

  const closes = await getDailyCandles(sym)
  if (!closes) return null

  const p    = price || closes[closes.length - 1]
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

  CACHE[sym] = { data, ts: Date.now() }
  return data
}

export async function GET(request) {
  if (!TD_KEY) return NextResponse.json({ error: 'TWELVE_DATA_API_KEY not set', technicals: {} }, { status: 200 })

  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('symbols') || ''
  // Cap at 4 per call — TwelveData free tier rate-limited, candle fetch is one call each
  const symbols = [...new Set(raw.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean))].slice(0, 4)

  if (!symbols.length) return NextResponse.json({ error: 'No symbols. Use ?symbols=NVDA,AVGO', technicals: {} }, { status: 200 })

  const results = {}

  // Sequential with 1s gap — stays within TwelveData free-tier rate limit
  for (const sym of symbols) {
    try {
      const data = await computeTechnicals(sym)
      results[sym] = data || null
    } catch {
      results[sym] = null
    }
    if (symbols.indexOf(sym) < symbols.length - 1) await delay(1000)
  }

  return NextResponse.json({
    technicals: results,
    cached: Object.keys(results).filter(s => {
      const c = CACHE[s]; return c && Date.now()-c.ts < TTL
    }).length,
    fetchedAt: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}
