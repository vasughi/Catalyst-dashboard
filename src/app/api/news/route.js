/**
 * CATALYST — src/app/api/news/route.js
 *
 * Fetches live news + analyst recommendations + recent earnings results
 * for a given set of tickers. Called async after main opportunities load.
 *
 * Sources (all free Finnhub):
 *   /company-news       — headlines last 5 days
 *   /stock/recommendation — analyst buy/hold/sell consensus
 *   /stock/earnings     — last 2 quarters actual vs estimate
 *
 * Edge runtime, no timeout issues.
 */

import { NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

const FH  = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY

async function fh(path) {
  try {
    const sep = path.includes('?') ? '&' : '?'
    const r   = await fetch(`${FH}${path}${sep}token=${KEY}`, { cache: 'no-store' })
    if (!r.ok) return null
    return r.json()
  } catch { return null }
}

// Fetch and summarise news for one ticker
async function getNews(ticker, days = 5) {
  const to   = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  const data = await fh(`/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}`)
  if (!Array.isArray(data) || !data.length) return []
  // Return top 3 most recent significant headlines
  return data
    .slice(0, 8)
    .filter(n => n.headline && n.headline.length > 20)
    .slice(0, 3)
    .map(n => ({
      headline: n.headline.slice(0, 120),
      date:     new Date(n.datetime * 1000).toISOString().split('T')[0],
      source:   n.source,
    }))
}

// Fetch analyst consensus (buy/hold/sell counts)
async function getRecommendation(ticker) {
  const data = await fh(`/stock/recommendation?symbol=${encodeURIComponent(ticker)}`)
  if (!Array.isArray(data) || !data.length) return null
  const latest = data[0]  // most recent month
  if (!latest) return null
  const total = (latest.buy||0) + (latest.hold||0) + (latest.sell||0) + (latest.strongBuy||0) + (latest.strongSell||0)
  if (!total) return null
  const bullish = (latest.buy||0) + (latest.strongBuy||0)
  const bearish = (latest.sell||0) + (latest.strongSell||0)
  const consensus = bullish > total*0.6 ? 'BUY' : bearish > total*0.3 ? 'SELL' : 'HOLD'
  return {
    consensus,
    buy:       latest.buy || 0,
    strongBuy: latest.strongBuy || 0,
    hold:      latest.hold || 0,
    sell:      (latest.sell||0) + (latest.strongSell||0),
    total,
    period:    latest.period,
  }
}

// Fetch most recent earnings result — did they beat or miss?
async function getLatestEarnings(ticker) {
  const data = await fh(`/stock/earnings?symbol=${encodeURIComponent(ticker)}&limit=2`)
  if (!Array.isArray(data) || !data.length) return null
  const latest = data[0]
  if (!latest || latest.actual === null) return null
  const beat   = latest.actual > latest.estimate
  const miss   = latest.actual < latest.estimate
  const pctDiff = latest.estimate
    ? ((latest.actual - latest.estimate) / Math.abs(latest.estimate) * 100).toFixed(1)
    : null
  return {
    period:      latest.period,
    actual:      latest.actual,
    estimate:    latest.estimate,
    beat,
    miss,
    pctDiff,
    surprise:    pctDiff ? `${beat?'+':''}${pctDiff}%` : null,
  }
}

export async function GET(request) {
  if (!KEY) return NextResponse.json({ error: 'FINNHUB_API_KEY not set' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const symbolsParam     = searchParams.get('symbols') || ''
  const symbols = [...new Set(
    symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  )].slice(0, 15)  // cap at 15 tickers per call

  if (!symbols.length) {
    return NextResponse.json({ error: 'No symbols. Use ?symbols=NVDA,AVGO' }, { status: 400 })
  }

  // Fetch news + recommendations + earnings for all tickers in parallel
  const results = {}
  await Promise.allSettled(symbols.map(async ticker => {
    const [news, rec, earnings] = await Promise.all([
      getNews(ticker),
      getRecommendation(ticker),
      getLatestEarnings(ticker),
    ])
    results[ticker] = {
      news:        news || [],
      analyst:     rec || null,
      lastEarnings: earnings || null,
    }
  }))

  // Build a plain-English summary for the AI prompt
  const summaries = Object.entries(results)
    .map(([ticker, d]) => {
      const parts = []

      // Analyst consensus
      if (d.analyst) {
        const { consensus, buy, strongBuy, hold, sell, total } = d.analyst
        parts.push(`Analysts: ${consensus} (${buy+strongBuy} buy, ${hold} hold, ${sell} sell of ${total})`)
      }

      // Recent earnings result
      if (d.lastEarnings) {
        const e = d.lastEarnings
        parts.push(`Last earnings (${e.period}): ${e.beat ? 'BEAT' : e.miss ? 'MISSED'  : 'IN-LINE'} by ${e.surprise||'0%'} (actual $${e.actual} vs est $${e.estimate})`)
      }

      // Top headlines
      if (d.news.length) {
        parts.push(...d.news.slice(0,2).map(n => `${n.date}: ${n.headline}`))
      }

      return parts.length ? `${ticker}: ${parts.join(' | ')}` : null
    })
    .filter(Boolean)
    .join('\n')

  return NextResponse.json({
    results,
    summary:    summaries,
    fetchedAt:  new Date().toISOString(),
    tickers:    symbols.length,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
