/**
 * CATALYST — src/app/api/earnings-history/route.js
 *
 * Computes live earnings reaction history (avg % move, beat rate) per stock.
 * Replaces the hardcoded EH object in Dashboard.js.
 *
 * Method:
 *   1. Fetch last 6 quarters of EPS data from Finnhub /stock/earnings
 *   2. For each past earnings date, fetch daily candles around that date
 *   3. Calculate the 1-day price move (close day-after / close day-before - 1)
 *   4. Average the last 4 moves and count beats
 *
 * Cached for 24 hours — runs once per day, not on every refresh.
 * Falls back gracefully to null if any fetch fails.
 *
 * Env: FINNHUB_API_KEY
 */

import { NextResponse } from 'next/server'

// Cache for 24 hours — earnings history doesn't change intraday
export const revalidate = 86400

const FH  = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY

async function fh(path) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${FH}${path}${sep}token=${KEY}`, {
    next: { revalidate: 86400 },  // Vercel edge cache 24h
  })
  if (!res.ok) throw new Error(`Finnhub ${path} → ${res.status}`)
  return res.json()
}

// Fetch EPS history for a symbol — returns last N quarters
async function epsHistory(sym, limit = 6) {
  try {
    const d = await fh(`/stock/earnings?symbol=${encodeURIComponent(sym)}&limit=${limit}`)
    if (!Array.isArray(d)) return []
    return d
      .filter(e => e.period && e.actual !== null)
      .map(e => ({
        period:          e.period,           // e.g. "2026-01-31"
        actual:          e.actual,
        estimate:        e.estimate,
        beat:            e.actual > e.estimate,
        surprisePct:     e.estimate ? ((e.actual - e.estimate) / Math.abs(e.estimate)) * 100 : null,
      }))
  } catch { return [] }
}

// Get the 1-day stock price reaction around an earnings date
// Returns % change from day-before close to day-after close
async function earningsReaction(sym, dateStr) {
  try {
    const earningsDate = new Date(dateStr)
    // Fetch candles for a 5-day window around the date
    const from = Math.floor((earningsDate.getTime() - 4 * 86400000) / 1000)
    const to   = Math.floor((earningsDate.getTime() + 4 * 86400000) / 1000)

    const d = await fh(
      `/stock/candle?symbol=${encodeURIComponent(sym)}&resolution=D&from=${from}&to=${to}`
    )

    if (!d || d.s !== 'ok' || !d.t || d.t.length < 2) return null

    // Find the index of the earnings date (or closest trading day)
    const earningsTs = earningsDate.getTime() / 1000
    let idx = -1
    let minDiff = Infinity
    d.t.forEach((ts, i) => {
      const diff = Math.abs(ts - earningsTs)
      if (diff < minDiff) { minDiff = diff; idx = i }
    })

    if (idx < 1 || idx >= d.c.length) return null

    // 1-day reaction: close on day-after vs close on day-before
    const closeBefore = d.c[idx - 1]
    const closeAfter  = idx + 1 < d.c.length ? d.c[idx + 1] : d.c[idx]

    if (!closeBefore || closeBefore === 0) return null

    return ((closeAfter - closeBefore) / closeBefore) * 100
  } catch { return null }
}

// Process one ticker — fetch history + compute reactions
async function processStock(sym) {
  try {
    const history = await epsHistory(sym, 6)
    if (!history.length) return null

    // Get reactions for last 4 quarters that have dates
    const withReactions = []
    for (const q of history.slice(0, 4)) {
      if (!q.period) continue
      const reaction = await earningsReaction(sym, q.period)
      withReactions.push({
        period:      q.period,
        beat:        q.beat,
        surprisePct: q.surprisePct,
        reaction:    reaction !== null ? parseFloat(Math.abs(reaction).toFixed(1)) : null,
        direction:   reaction !== null ? (reaction >= 0 ? 'up' : 'down') : null,
      })
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 150))
    }

    const validReactions = withReactions.filter(q => q.reaction !== null)
    if (!validReactions.length) return null

    const avgMove   = validReactions.reduce((s, q) => s + q.reaction, 0) / validReactions.length
    const beatCount = withReactions.filter(q => q.beat).length
    const total     = withReactions.filter(q => q.beat !== undefined).length

    return {
      ticker:     sym,
      avgMove:    parseFloat(avgMove.toFixed(1)),
      beatCount,
      totalQuarters: total,
      label:      `${avgMove.toFixed(1)}% avg · ${beatCount}/${total} beats`,
      quarters:   withReactions,
      source:     'finnhub_live',
      fetchedAt:  new Date().toISOString(),
    }
  } catch { return null }
}

export async function GET(request) {
  if (!KEY) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY not set' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const symbolsParam = searchParams.get('symbols')

  // Default priority stocks — the ones most important for Return Gate
  const DEFAULT_SYMBOLS = [
    'NVDA','AMD','AVGO','MRVL','ARM','PLTR','CRDO',
    'META','MSFT','GOOGL','NOW',
    'VRT','GEV','CRWD','ZS','PANW',
    'AXON','RKLB','DELL','SMCI',
  ]

  const symbols = symbolsParam
    ? symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_SYMBOLS

  // Process in small batches to respect rate limits
  const BATCH = 3
  const results = {}

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH)
    const batchResults = await Promise.allSettled(batch.map(processStock))
    batchResults.forEach((r, j) => {
      if (r.status === 'fulfilled' && r.value) {
        results[batch[j]] = r.value
      }
    })
    // Pause between batches
    if (i + BATCH < symbols.length) {
      await new Promise(r => setTimeout(r, 600))
    }
  }

  return NextResponse.json({
    history: results,
    symbolsProcessed: Object.keys(results).length,
    symbolsRequested: symbols.length,
    cachedFor: '24 hours',
    fetchedAt: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
    },
  })
}
