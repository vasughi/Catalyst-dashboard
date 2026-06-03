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

export const runtime = "edge"


const FH  = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY

// ── Module-level cache ────────────────────────────────────────────────────────
const CACHE = {}
const TTL   = 6 * 60 * 60 * 1000  // 6 hours

async function fh(path) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${FH}${path}${sep}token=${KEY}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

async function getDailyCandles(sym, days = 220) {
  const to   = Math.floor(Date.now() / 1000)
  const from = to - days * 86400
  const d    = await fh(`/stock/candle?symbol=${encodeURIComponent(sym)}&resolution=D&from=${from}&to=${to}`)
  if (!d || d.s !== 'ok' || !Array.isArray(d.c) || d.c.length < 20) return null
  return d.c
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
  if (!KEY) return NextResponse.json({ error: 'FINNHUB_API_KEY not set' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('symbols') || ''
  const symbols = [...new Set(raw.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean))].slice(0, 5)

  if (!symbols.length) return NextResponse.json({ error: 'No symbols. Use ?symbols=NVDA,AVGO' }, { status: 400 })

  const results = {}
  await Promise.allSettled(symbols.map(async sym => {
    try {
      const data = await computeTechnicals(sym)
      results[sym] = data || null
    } catch {
      results[sym] = null
    }
  }))

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
