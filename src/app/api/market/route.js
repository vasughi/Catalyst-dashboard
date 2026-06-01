/**
 * CATALYST DASHBOARD — src/app/api/market/route.js
 *
 * FIXED VERSION: Uses Finnhub instead of scraping Yahoo Finance.
 *
 * Why: Yahoo Finance blocks all Vercel/cloud datacenter IPs.
 * Finnhub: truly free, no credit card, 60 calls/min, real-time US quotes.
 *
 * Setup:
 *   1. Sign up free at https://finnhub.io (no credit card)
 *   2. Copy your API key from the dashboard
 *   3. In Vercel → Settings → Environment Variables, add:
 *        FINNHUB_API_KEY = your_key_here
 *   4. Drop this file at src/app/api/market/route.js and redeploy
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const FH = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

function ok(body, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

function baseMeta(type) {
  return {
    requestedType: type,
    fetchedAt: new Date().toISOString(),
    provider: 'finnhub',
    fallbackUsed: false,
    partial: false,
    warnings: [],
  }
}

// Single Finnhub quote: GET /quote?symbol=AAPL&token=KEY
// Returns: { c: current, d: change, dp: changePct, h, l, o, pc: prevClose }
async function fhQuote(symbol) {
  const res = await fetch(`${FH}/quote?symbol=${encodeURIComponent(symbol)}&token=${KEY}`, {
    cache: 'no-store',
  })
  if (!res.ok) return null
  const d = await res.json()
  if (!d || d.c === 0) return null
  return { symbol, price: d.c, changePct: d.dp ?? 0, changeAmt: d.d ?? 0, prevClose: d.pc }
}

// Batch quotes — Finnhub free tier has no batch endpoint so we fan out.
// 60 calls/min free, so parallel is fine for our universe sizes.
async function fhQuotes(symbols) {
  const results = await Promise.allSettled(symbols.map(fhQuote))
  const map = {}
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) map[symbols[i]] = r.value
  })
  return map
}

function fmt(q, name) {
  if (!q) return null
  const c = q.changePct ?? 0
  return {
    name: name || q.symbol,
    value: q.price.toLocaleString('en-US', { maximumFractionDigits: 2 }),
    change: `${c >= 0 ? '+' : ''}${c.toFixed(2)}%`,
    direction: c >= 0 ? 'up' : 'down',
    sourceTimestamp: new Date().toISOString(),
    provider: 'finnhub',
  }
}

// ─── Finnhub uses different index symbols ────────────────────────────────────
// Indices on Finnhub free tier are via forexQuote or the ^GSPC format
// Most reliable: use ETF proxies (free, real-time) for indices
const INDEX_MAP = {
  // ETF proxies — track the index closely, available on Finnhub free tier
  'SP500':    { etf: 'SPY',  label: 'S&P 500' },
  'NASDAQ':   { etf: 'QQQ',  label: 'NASDAQ' },
  'DOW':      { etf: 'DIA',  label: 'Dow Jones' },
  'RUSSELL':  { etf: 'IWM',  label: 'Russell 2000' },
  'FTSE':     { etf: 'ISF.L', label: 'FTSE 100' },  // London-listed; fallback below
  'DAX':      { etf: 'EWG',  label: 'DAX' },
  'CAC':      { etf: 'EWQ',  label: 'CAC 40' },
  'NIKKEI':   { etf: 'EWJ',  label: 'Nikkei 225' },
}

// ─── route ───────────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (!type) return ok({ error: 'Missing type parameter' }, 400)
  if (!KEY)  return ok({ error: 'FINNHUB_API_KEY is not set in environment variables. Add it in Vercel → Settings → Environment Variables.' }, 500)

  try {
    // ── GLOBAL OVERVIEW ──────────────────────────────────────────────────────
    if (type === 'global') {
      const meta = baseMeta(type)

      // ETF proxies for indices (Finnhub free)
      const indexEtfs    = ['SPY', 'QQQ', 'DIA', 'IWM', 'EWG', 'EWQ', 'EWJ']
      // Forex via Finnhub /forex/rates or /quote with FX symbol
      const forexSymbols = ['OANDA:GBP_USD', 'OANDA:EUR_USD', 'OANDA:USD_JPY']
      // Commodities
      const commSymbols  = ['USO', 'GLD']  // ETF proxies for oil & gold

      const [indices, forex, comms] = await Promise.all([
        fhQuotes(indexEtfs),
        fhQuotes(forexSymbols),
        fhQuotes(commSymbols),
      ])

      const labels = {
        SPY: 'S&P 500 (SPY)',
        QQQ: 'NASDAQ (QQQ)',
        DIA: 'Dow Jones (DIA)',
        IWM: 'Russell 2000 (IWM)',
        EWG: 'DAX (EWG)',
        EWQ: 'CAC 40 (EWQ)',
        EWJ: 'Nikkei (EWJ)',
      }

      return ok({
        meta,
        markets: indexEtfs.map(s => fmt(indices[s], labels[s])).filter(Boolean),
        commodities: [
          fmt(comms['USO'], 'WTI Oil (USO)'),
          fmt(comms['GLD'], 'Gold (GLD)'),
        ].filter(Boolean),
        currencies: (() => {
          const pairs = [
            { sym: 'OANDA:GBP_USD', pair: 'GBP/USD', dp: 4 },
            { sym: 'OANDA:EUR_USD', pair: 'EUR/USD', dp: 4 },
            { sym: 'OANDA:USD_JPY', pair: 'USD/JPY', dp: 2 },
          ]
          return pairs
            .map(({ sym, pair, dp }) => {
              const q = forex[sym]
              if (!q) return null
              return {
                pair,
                value: q.price.toFixed(dp),
                change: `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`,
                sourceTimestamp: new Date().toISOString(),
                provider: 'finnhub',
              }
            })
            .filter(Boolean)
        })(),
        bonds: [],
      })
    }

    // ── US PRE-MARKET ─────────────────────────────────────────────────────────
    if (type === 'us') {
      const meta = baseMeta(type)

      // Futures ETFs
      const futureSymbols = ['SPY', 'QQQ', 'DIA', 'IWM']
      const futureNames   = {
        SPY: 'S&P 500 Futures (SPY)',
        QQQ: 'NASDAQ Futures (QQQ)',
        DIA: 'Dow Futures (DIA)',
        IWM: 'Russell 2000 (IWM)',
      }

      // Top gainers/losers: Finnhub doesn't have a movers screener on free tier,
      // so we query our swing-trade universe and sort by % change
      const universe = [
        'NVDA','AMD','AVGO','TSM','MRVL','ARM',
        'MSFT','GOOGL','META','PLTR',
        'DELL','SMCI','CRWD','PANW','ZS',
        'LMT','RTX','NOC','AXON',
        'VRT','ETN','CEG','FSLR','ANET','RKLB',
      ]

      const [futures, universeQuotes] = await Promise.all([
        fhQuotes(futureSymbols),
        fhQuotes(universe),
      ])

      const sorted = Object.values(universeQuotes).sort((a, b) => b.changePct - a.changePct)
      const gainers = sorted.slice(0, 5).map(q => ({
        ticker: q.symbol,
        company: q.symbol,
        price: `$${q.price.toFixed(2)}`,
        change: `+${q.changePct.toFixed(2)}%`,
        direction: 'up',
        sourceTimestamp: new Date().toISOString(),
        provider: 'finnhub',
      }))
      const losers = sorted.slice(-5).reverse().map(q => ({
        ticker: q.symbol,
        company: q.symbol,
        price: `$${q.price.toFixed(2)}`,
        change: `${q.changePct.toFixed(2)}%`,
        direction: 'down',
        sourceTimestamp: new Date().toISOString(),
        provider: 'finnhub',
      }))

      return ok({
        meta,
        futures: futureSymbols.map(s => {
          const q = futures[s]
          if (!q) return null
          return {
            index: futureNames[s],
            value: q.price.toLocaleString('en-US', { maximumFractionDigits: 2 }),
            change: `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`,
            direction: q.changePct >= 0 ? 'up' : 'down',
            sourceTimestamp: new Date().toISOString(),
            provider: 'finnhub',
          }
        }).filter(Boolean),
        gainers,
        losers,
      })
    }

    // ── EUROPE PRE-MARKET ─────────────────────────────────────────────────────
    if (type === 'europe') {
      const meta = baseMeta(type)
      const symbols = { EWG: 'DAX (EWG ETF)', EWQ: 'CAC 40 (EWQ ETF)', EWU: 'FTSE 100 (EWU ETF)' }
      const quotes  = await fhQuotes(Object.keys(symbols))

      return ok({
        meta,
        futures: Object.entries(symbols).map(([sym, label]) => {
          const q = quotes[sym]
          if (!q) return null
          return {
            index: label,
            value: q.price.toLocaleString('en-US', { maximumFractionDigits: 2 }),
            change: `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`,
            direction: q.changePct >= 0 ? 'up' : 'down',
            sourceTimestamp: new Date().toISOString(),
            provider: 'finnhub',
          }
        }).filter(Boolean),
      })
    }

    // ── TOP OPPORTUNITIES (swing-trade universe) ──────────────────────────────
    if (type === 'opportunities') {
      const meta = baseMeta(type)

      // Your universe — edit to taste
      const universe = [
        // Semis / AI infra
        'NVDA','AMD','AVGO','TSM','MRVL','ARM',
        // Big tech / cloud / AI software
        'MSFT','GOOGL','META','PLTR',
        // Servers / storage
        'DELL','SMCI',
        // Cybersecurity
        'CRWD','PANW','ZS',
        // Defence
        'LMT','RTX','NOC','AXON',
        // Power / energy
        'VRT','ETN','CEG','FSLR',
        // Networking / space
        'ANET','RKLB',
      ]

      const quotes = await fhQuotes(universe)

      const stocks = universe
        .filter(sym => quotes[sym])
        .map(sym => {
          const q = quotes[sym]
          return {
            ticker: sym,
            name: sym,
            price: `$${q.price.toFixed(2)}`,
            change1d: `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`,
            direction: q.changePct >= 0 ? 'up' : 'down',
            marketCap: 'N/A',
            sourceTimestamp: new Date().toISOString(),
            provider: 'finnhub',
          }
        })

      meta.partial = stocks.length < universe.length
      if (meta.partial) meta.warnings.push(`Got ${stocks.length}/${universe.length} quotes`)

      return ok({ meta, stocks })
    }

    return ok({ error: 'Unknown type' }, 400)

  } catch (err) {
    console.error('Market route error:', err)
    return ok(
      {
        error: `Market data error: ${err.message}`,
        meta: {
          requestedType: type || null,
          fetchedAt: new Date().toISOString(),
          provider: null,
          fallbackUsed: false,
          partial: true,
          warnings: [err.message],
        },
      },
      500
    )
  }
}
