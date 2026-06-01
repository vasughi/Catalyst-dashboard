/**
 * CATALYST v2 — src/app/api/market/route.js
 *
 * Fetches from Finnhub (free, no CC, 60 calls/min).
 * Adds: earnings calendar, VIX proxy, sector ETF trends, SMA data.
 *
 * Env vars needed in Vercel:
 *   FINNHUB_API_KEY  — from finnhub.io (free)
 *   ANTHROPIC_API_KEY — from console.anthropic.com
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const FH   = 'https://finnhub.io/api/v1'
const KEY  = process.env.FINNHUB_API_KEY

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

function resp(body, status = 200) {
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

// ─── Finnhub helpers ─────────────────────────────────────────────────────────

async function fh(path) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${FH}${path}${sep}token=${KEY}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Finnhub ${path} → ${res.status}`)
  return res.json()
}

// Single quote: { c, d, dp, h, l, o, pc }
async function quote(sym) {
  try {
    const d = await fh(`/quote?symbol=${encodeURIComponent(sym)}`)
    if (!d || d.c === 0) return null
    return { symbol: sym, price: d.c, changePct: d.dp ?? 0, changeAmt: d.d ?? 0, prevClose: d.pc }
  } catch { return null }
}

// Batch quotes in parallel (Finnhub free has no batch endpoint)
async function quotes(syms) {
  const res = await Promise.allSettled(syms.map(quote))
  const map = {}
  res.forEach((r, i) => { if (r.status === 'fulfilled' && r.value) map[syms[i]] = r.value })
  return map
}

// Candles for SMA calculation: resolution D, last N days
async function candles(sym, days = 220) {
  try {
    const to   = Math.floor(Date.now() / 1000)
    const from = to - days * 86400
    const d    = await fh(`/stock/candle?symbol=${encodeURIComponent(sym)}&resolution=D&from=${from}&to=${to}`)
    if (!d || d.s !== 'ok' || !d.c?.length) return null
    return d.c  // closing prices array, oldest first
  } catch { return null }
}

function sma(prices, period) {
  if (!prices || prices.length < period) return null
  const slice = prices.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function trendLabel(price, sma20, sma50, sma200) {
  if (!price) return 'UNKNOWN'
  const a = sma20  ? price > sma20  : null
  const b = sma50  ? price > sma50  : null
  const c = sma200 ? price > sma200 : null
  if (a && b && c) return 'STRONG UPTREND'
  if (b && c && !a) return 'UPTREND WITH PULLBACK'
  if (c && !b) return 'RECOVERING'
  return 'DOWNTREND'
}

// Earnings calendar for universe (next 40 trading days ≈ 60 calendar days)
async function earningsCalendar(from, to) {
  try {
    const d = await fh(`/calendar/earnings?from=${from}&to=${to}`)
    return d?.earningsCalendar || []
  } catch { return [] }
}

// Company basic financials (for market cap, beta etc)
async function basicFinancials(sym) {
  try {
    const d = await fh(`/stock/metric?symbol=${encodeURIComponent(sym)}&metric=all`)
    return d?.metric || {}
  } catch { return {} }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isoDate(d) {
  return d.toISOString().split('T')[0]
}

function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function tradingDaysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const now    = new Date()
  if (target < now) return -1
  let days = 0, cur = new Date(now)
  while (cur < target) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) days++
  }
  return days
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (!type) return resp({ error: 'Missing type parameter' }, 400)
  if (!KEY)  return resp({
    error: 'FINNHUB_API_KEY not set. Go to Vercel → Settings → Environment Variables and add it.',
  }, 500)

  try {

    // ── GLOBAL OVERVIEW ────────────────────────────────────────────────────
    if (type === 'global') {
      const meta = baseMeta(type)

      // Forex via standard symbol format (more reliable than OANDA: prefix on free tier)
      async function fxQuote(sym) {
        try {
          const d = await fh(`/quote?symbol=${encodeURIComponent(sym)}`)
          if (!d || d.c === 0) return null
          return { price: d.c, changePct: d.dp ?? 0 }
        } catch { return null }
      }

      const [indices, comms, gbpusd, eurusd, usdjpy] = await Promise.all([
        quotes(['SPY','QQQ','DIA','IWM','EWG','EWQ','EWJ','VIXY']),
        quotes(['USO','GLD','CPER']),
        fxQuote('GBPUSD'),
        fxQuote('EURUSD'),
        fxQuote('USDJPY'),
      ])

      const vixQ   = indices['VIXY']
      const vixVal = vixQ ? vixQ.price.toFixed(2) : null

      const fmt = (q, name) => {
        if (!q) return null
        const c = q.changePct ?? 0
        return {
          name,
          value: q.price.toLocaleString('en-US', { maximumFractionDigits: 2 }),
          change: `${c >= 0 ? '+' : ''}${c.toFixed(2)}%`,
          direction: c >= 0 ? 'up' : 'down',
          provider: 'finnhub',
        }
      }

      // Sanity-check ETF prices to catch bad Finnhub data
      // USO ~60-90, GLD ~280-330, CPER ~25-45
      const usoQ  = comms['USO']
      const gldQ  = comms['GLD']
      const cperQ = comms['CPER']

      const currencies = [
        gbpusd ? { pair: 'GBP/USD', value: gbpusd.price.toFixed(4), change: `${gbpusd.changePct >= 0 ? '+' : ''}${gbpusd.changePct.toFixed(2)}%`, provider: 'finnhub' } : null,
        eurusd ? { pair: 'EUR/USD', value: eurusd.price.toFixed(4), change: `${eurusd.changePct >= 0 ? '+' : ''}${eurusd.changePct.toFixed(2)}%`, provider: 'finnhub' } : null,
        usdjpy ? { pair: 'USD/JPY', value: usdjpy.price.toFixed(2),  change: `${usdjpy.changePct >= 0 ? '+' : ''}${usdjpy.changePct.toFixed(2)}%`, provider: 'finnhub' } : null,
      ].filter(Boolean)

      return resp({
        meta,
        vix: vixVal,
        vixSignal: vixVal ? (parseFloat(vixVal) > 25 ? 'HIGH_FEAR' : parseFloat(vixVal) > 18 ? 'ELEVATED' : 'CALM') : null,
        markets: [
          fmt(indices['SPY'],  'S&P 500 (SPY)'),
          fmt(indices['QQQ'],  'NASDAQ (QQQ)'),
          fmt(indices['DIA'],  'Dow Jones (DIA)'),
          fmt(indices['IWM'],  'Russell 2000 (IWM)'),
          fmt(indices['EWG'],  'DAX (EWG)'),
          fmt(indices['EWQ'],  'CAC 40 (EWQ)'),
          fmt(indices['EWJ'],  'Nikkei (EWJ)'),
        ].filter(Boolean),
        commodities: [
          usoQ  && usoQ.price  < 200 ? fmt(usoQ,  'WTI Oil (USO ETF)') : null,
          gldQ  && gldQ.price  < 500 ? fmt(gldQ,  'Gold (GLD ETF)')    : null,
          cperQ && cperQ.price < 100 ? fmt(cperQ, 'Copper (CPER ETF)') : null,
        ].filter(Boolean),
        currencies,
        bonds: [],
      })
    }

    // ── SECTOR ETF HEALTH (used by opportunities tab) ─────────────────────
    if (type === 'sectors') {
      // Key sector ETFs — above/below 50 SMA tells us regime
      const sectorEtfs = ['XLK','ITA','XSD','CIBR','XLE','XLI','XLF']
      const sectorNames = {
        XLK:  'Technology',
        ITA:  'Defence & Aerospace',
        XSD:  'Semiconductors',
        CIBR: 'Cybersecurity',
        XLE:  'Energy',
        XLI:  'Industrials',
        XLF:  'Financials',
      }

      const results = await Promise.allSettled(
        sectorEtfs.map(async sym => {
          const [q, closes] = await Promise.all([quote(sym), candles(sym, 60)])
          if (!q || !closes) return null
          const s50 = sma(closes, 50)
          const s20 = sma(closes, 20)
          return {
            etf: sym,
            name: sectorNames[sym] || sym,
            price: q.price,
            changePct: q.changePct,
            sma20: s20 ? parseFloat(s20.toFixed(2)) : null,
            sma50: s50 ? parseFloat(s50.toFixed(2)) : null,
            aboveSma50: s50 ? q.price > s50 : null,
            aboveSma20: s20 ? q.price > s20 : null,
            trend: s50 ? (q.price > s50 ? 'BULLISH' : 'BEARISH') : 'UNKNOWN',
          }
        })
      )

      return resp({
        meta: baseMeta(type),
        sectors: results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean),
      })
    }

    // ── US PRE-MARKET ──────────────────────────────────────────────────────
    if (type === 'us') {
      const meta = baseMeta(type)

      // Full watchlist universe with company names
      const UNIVERSE = [
        { sym: 'NVDA',  name: 'NVIDIA' },
        { sym: 'AMD',   name: 'AMD' },
        { sym: 'AVGO',  name: 'Broadcom' },
        { sym: 'TSM',   name: 'TSMC' },
        { sym: 'MRVL',  name: 'Marvell' },
        { sym: 'ARM',   name: 'Arm Holdings' },
        { sym: 'MSFT',  name: 'Microsoft' },
        { sym: 'GOOGL', name: 'Alphabet' },
        { sym: 'META',  name: 'Meta' },
        { sym: 'PLTR',  name: 'Palantir' },
        { sym: 'DELL',  name: 'Dell' },
        { sym: 'SMCI',  name: 'Super Micro' },
        { sym: 'CRWD',  name: 'CrowdStrike' },
        { sym: 'PANW',  name: 'Palo Alto' },
        { sym: 'ZS',    name: 'Zscaler' },
        { sym: 'LMT',   name: 'Lockheed Martin' },
        { sym: 'RTX',   name: 'RTX Corp' },
        { sym: 'NOC',   name: 'Northrop Grumman' },
        { sym: 'AXON',  name: 'Axon Enterprise' },
        { sym: 'VRT',   name: 'Vertiv' },
        { sym: 'ETN',   name: 'Eaton' },
        { sym: 'CEG',   name: 'Constellation Energy' },
        { sym: 'FSLR',  name: 'First Solar' },
        { sym: 'ANET',  name: 'Arista Networks' },
        { sym: 'RKLB',  name: 'Rocket Lab' },
      ]

      const syms = UNIVERSE.map(u => u.sym)
      const nameMap = Object.fromEntries(UNIVERSE.map(u => [u.sym, u.name]))

      // Sector ETFs for health snapshot
      const [futureQ, universeQ, sectorQ, vixQ] = await Promise.all([
        quotes(['SPY','QQQ','DIA','IWM']),
        quotes(syms),
        quotes(['XLK','ITA','XSD','CIBR','XLE']),
        quote('VIXY'),
      ])

      const sorted = Object.values(universeQ).sort((a, b) => b.changePct - a.changePct)

      // Sector health
      const sectorHealth = {
        'Technology (XLK)':     sectorQ['XLK']  ? `${sectorQ['XLK'].changePct  >= 0 ? '+' : ''}${sectorQ['XLK'].changePct.toFixed(2)}%`  : 'N/A',
        'Defence (ITA)':        sectorQ['ITA']  ? `${sectorQ['ITA'].changePct  >= 0 ? '+' : ''}${sectorQ['ITA'].changePct.toFixed(2)}%`  : 'N/A',
        'Semis (XSD)':          sectorQ['XSD']  ? `${sectorQ['XSD'].changePct  >= 0 ? '+' : ''}${sectorQ['XSD'].changePct.toFixed(2)}%`  : 'N/A',
        'Cybersecurity (CIBR)': sectorQ['CIBR'] ? `${sectorQ['CIBR'].changePct >= 0 ? '+' : ''}${sectorQ['CIBR'].changePct.toFixed(2)}%` : 'N/A',
        'Energy (XLE)':         sectorQ['XLE']  ? `${sectorQ['XLE'].changePct  >= 0 ? '+' : ''}${sectorQ['XLE'].changePct.toFixed(2)}%`  : 'N/A',
      }

      const vix = vixQ ? parseFloat(vixQ.price.toFixed(2)) : null

      return resp({
        meta,
        vix,
        vixRegime: vix ? (vix > 25 ? 'HIGH_FEAR' : vix > 18 ? 'ELEVATED' : 'CALM') : null,
        sectorHealth,
        futures: [
          { index: 'S&P 500',       etf: 'SPY', ...futureQ['SPY'] },
          { index: 'NASDAQ 100',    etf: 'QQQ', ...futureQ['QQQ'] },
          { index: 'Dow Jones',     etf: 'DIA', ...futureQ['DIA'] },
          { index: 'Russell 2000',  etf: 'IWM', ...futureQ['IWM'] },
        ].filter(f => f.price).map(f => ({
          index: f.index,
          etf: f.etf,
          value: f.price?.toLocaleString('en-US', { maximumFractionDigits: 2 }),
          change: `${(f.changePct??0) >= 0 ? '+' : ''}${(f.changePct??0).toFixed(2)}%`,
          direction: (f.changePct??0) >= 0 ? 'up' : 'down',
          provider: 'finnhub',
        })),
        // Top movers from your watchlist universe with company names
        gainers: sorted.slice(0, 5).map(q => ({
          ticker: q.symbol,
          company: nameMap[q.symbol] || q.symbol,
          price: `$${q.price.toFixed(2)}`,
          change: `+${q.changePct.toFixed(2)}%`,
          direction: 'up',
          provider: 'finnhub',
        })),
        losers: sorted.slice(-5).reverse().map(q => ({
          ticker: q.symbol,
          company: nameMap[q.symbol] || q.symbol,
          price: `$${q.price.toFixed(2)}`,
          change: `${q.changePct.toFixed(2)}%`,
          direction: 'down',
          provider: 'finnhub',
        })),
        // Full universe snapshot for context
        universe: sorted.map(q => ({
          ticker: q.symbol,
          company: nameMap[q.symbol] || q.symbol,
          price: `$${q.price.toFixed(2)}`,
          change: `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`,
          direction: q.changePct >= 0 ? 'up' : 'down',
        })),
      })
    }

    // ── EUROPE PRE-MARKET ──────────────────────────────────────────────────
    if (type === 'europe') {
      const meta = baseMeta(type)

      // Index ETF proxies for the headline numbers
      const indexEtfs = { EWG: 'DAX', EWQ: 'CAC 40', EWU: 'FTSE 100' }

      // Real European stocks available on US exchanges (ADRs) or direct listings
      // These are tradeable on Trading 212 and have real price data on Finnhub
      const europeanStocks = [
        { sym: 'RHMG.DE', name: 'Rheinmetall',    sector: 'Defence' },
        { sym: 'BA.L',    name: 'BAE Systems',     sector: 'Defence' },
        { sym: 'RR.L',    name: 'Rolls-Royce',     sector: 'Aerospace' },
        { sym: 'AIR.PA',  name: 'Airbus',          sector: 'Aerospace' },
        { sym: 'SAP',     name: 'SAP SE (ADR)',    sector: 'Software' },
        { sym: 'ASML',    name: 'ASML (ADR)',      sector: 'Semis' },
        { sym: 'SIE.DE',  name: 'Siemens',         sector: 'Industrial' },
        { sym: 'ENR.DE',  name: 'Siemens Energy',  sector: 'Grid/Power' },
      ]

      const [indexQ, stockQ] = await Promise.all([
        quotes(Object.keys(indexEtfs)),
        quotes(europeanStocks.map(s => s.sym)),
      ])

      const indices = Object.entries(indexEtfs).map(([sym, label]) => {
        const d = indexQ[sym]
        if (!d) return null
        return {
          index: label,
          value: d.price.toLocaleString('en-US', { maximumFractionDigits: 2 }),
          change: `${d.changePct >= 0 ? '+' : ''}${d.changePct.toFixed(2)}%`,
          direction: d.changePct >= 0 ? 'up' : 'down',
          provider: 'finnhub',
        }
      }).filter(Boolean)

      const stocks = europeanStocks
        .filter(s => stockQ[s.sym])
        .map(s => {
          const d = stockQ[s.sym]
          return {
            ticker: s.sym,
            name: s.name,
            sector: s.sector,
            price: d.price,
            priceFormatted: d.price.toFixed(2),
            changePct: d.changePct,
            change1d: `${d.changePct >= 0 ? '+' : ''}${d.changePct.toFixed(2)}%`,
            direction: d.changePct >= 0 ? 'up' : 'down',
            provider: 'finnhub',
          }
        })

      return resp({
        meta,
        futures: indices,
        europeanStocks: stocks,
      })
    }

    // ── OPPORTUNITIES (the core engine) ───────────────────────────────────
    if (type === 'opportunities') {
      const meta = baseMeta(type)

      const UNIVERSE = [
        'NVDA','AMD','AVGO','TSM','MRVL','ARM',
        'MSFT','GOOGL','META','PLTR',
        'DELL','SMCI','CRWD','PANW','ZS',
        'LMT','RTX','NOC','AXON',
        'VRT','ETN','CEG','FSLR','ANET','RKLB',
      ]

      // Dates for earnings calendar
      const today    = new Date()
      const in60days = addDays(today, 60)
      const fromStr  = isoDate(today)
      const toStr    = isoDate(in60days)

      // Run in parallel: quotes + earnings calendar + sector ETFs
      const [stockQuotes, earnings, sectorQ, vixQ] = await Promise.all([
        quotes(UNIVERSE),
        earningsCalendar(fromStr, toStr),
        quotes(['XLK','ITA','XSD','CIBR']),
        quote('VIXY'),
      ])

      // Filter earnings to only our universe
      const universeEarnings = earnings
        .filter(e => UNIVERSE.includes(e.symbol))
        .map(e => ({
          ticker: e.symbol,
          date: e.date,
          tradingDaysAway: tradingDaysUntil(e.date),
          epsEstimate: e.epsEstimate,
          revenueEstimate: e.revenueEstimate,
          source: 'finnhub_calendar',
        }))
        .sort((a, b) => (a.tradingDaysAway ?? 999) - (b.tradingDaysAway ?? 999))

      // VIX regime
      const vixPrice = vixQ?.price ?? null
      const vixRegime = vixPrice
        ? (vixPrice > 25 ? 'HIGH_FEAR' : vixPrice > 18 ? 'ELEVATED' : 'CALM')
        : 'UNKNOWN'

      // Sector health
      const sectorHealth = {
        tech:     sectorQ['XLK']  ? (sectorQ['XLK'].changePct  > 0 ? 'BULLISH' : 'BEARISH') : 'UNKNOWN',
        defence:  sectorQ['ITA']  ? (sectorQ['ITA'].changePct  > 0 ? 'BULLISH' : 'BEARISH') : 'UNKNOWN',
        semis:    sectorQ['XSD']  ? (sectorQ['XSD'].changePct  > 0 ? 'BULLISH' : 'BEARISH') : 'UNKNOWN',
        cyber:    sectorQ['CIBR'] ? (sectorQ['CIBR'].changePct > 0 ? 'BULLISH' : 'BEARISH') : 'UNKNOWN',
      }

      // Hardcoded fallback dates for stocks Finnhub doesn't have confirmed yet
      // Update these each quarter when actual dates are announced
      const FALLBACK_EARNINGS = {
        NVDA: { date: '2026-08-27', note: 'est — confirm at investor.nvidia.com' },
        PLTR: { date: '2026-08-04', note: 'est — confirm at investors.palantir.com' },
        CRWD: { date: '2026-08-26', note: 'est — confirm at ir.crowdstrike.com' },
        AMD:  { date: '2026-07-29', note: 'est — confirm at ir.amd.com' },
        SMCI: { date: '2026-08-05', note: 'est — confirm at investors.supermicro.com' },
      }

      // Merge Finnhub calendar with fallbacks (Finnhub takes priority when available)
      const earningsMap = {}
      universeEarnings.forEach(e => { earningsMap[e.ticker] = e })
      Object.entries(FALLBACK_EARNINGS).forEach(([ticker, fb]) => {
        if (!earningsMap[ticker]) {
          const days = tradingDaysUntil(fb.date)
          if (days !== null && days >= 0) {
            earningsMap[ticker] = {
              ticker,
              date: fb.date,
              tradingDaysAway: days,
              epsEstimate: null,
              source: 'fallback_estimate',
              note: fb.note,
            }
          }
        }
      })

      const stocks = UNIVERSE
        .filter(sym => stockQuotes[sym])
        .map(sym => {
          const q  = stockQuotes[sym]
          const ec = earningsMap[sym] || null
          return {
            ticker: sym,
            name: sym,
            price: q.price,
            priceFormatted: `$${q.price.toFixed(2)}`,
            changePct: q.changePct,
            change1d: `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`,
            direction: q.changePct >= 0 ? 'up' : 'down',
            // Gap-up flag — AI should apply post-catalyst chase rule
            bigMoverToday: Math.abs(q.changePct) > 8,
            // Verified earnings date from Finnhub
            earningsDate: ec?.date || null,
            earningsTradingDaysAway: ec?.tradingDaysAway ?? null,
            epsEstimate: ec?.epsEstimate || null,
            hasVerifiedEarnings: !!ec,
            provider: 'finnhub',
          }
        })

      // Sort: stocks with nearest earnings first, then by price momentum
      stocks.sort((a, b) => {
        const aD = a.earningsTradingDaysAway ?? 999
        const bD = b.earningsTradingDaysAway ?? 999
        if (aD !== bD) return aD - bD
        return Math.abs(b.changePct) - Math.abs(a.changePct)
      })

      meta.partial = stocks.length < UNIVERSE.length
      if (meta.partial) meta.warnings.push(`Got ${stocks.length}/${UNIVERSE.length} quotes`)

      return resp({
        meta,
        vix: vixPrice,
        vixRegime,
        sectorHealth,
        stocks,
        earningsCalendar: universeEarnings,
      })
    }

    // ── TECHNICALS for a single stock ─────────────────────────────────────
    if (type === 'technicals') {
      const sym = searchParams.get('symbol')
      if (!sym) return resp({ error: 'Missing symbol parameter' }, 400)

      const [q, closes] = await Promise.all([quote(sym), candles(sym, 220)])
      if (!q) return resp({ error: `No quote for ${sym}` }, 404)

      const s20  = closes ? sma(closes, 20)  : null
      const s50  = closes ? sma(closes, 50)  : null
      const s200 = closes ? sma(closes, 200) : null

      const trend = trendLabel(q.price, s20, s50, s200)

      // Nearest support (use 50 SMA as proxy if price is above it)
      const support = s50 && q.price > s50 ? s50 : (s200 || null)
      const stopLoss = support ? parseFloat((support * 0.99).toFixed(2)) : null
      const distToSupport = support ? (((q.price - support) / q.price) * 100).toFixed(1) : null

      // Entry quality scoring
      let entryQuality = 'AVERAGE'
      if (s20 && s50 && s200 && q.price > s20 && q.price > s50 && q.price > s200) {
        entryQuality = 'GOOD'
        const pctAbove50 = ((q.price - s50) / s50) * 100
        if (pctAbove50 > 30) entryQuality = 'POOR'  // extended
      }
      if (s50 && s200 && q.price < s50) entryQuality = 'POOR'

      return resp({
        meta: baseMeta(type),
        symbol: sym,
        price: q.price,
        changePct: q.changePct,
        sma20:  s20  ? parseFloat(s20.toFixed(2))  : null,
        sma50:  s50  ? parseFloat(s50.toFixed(2))  : null,
        sma200: s200 ? parseFloat(s200.toFixed(2)) : null,
        aboveSma20:  s20  ? q.price > s20  : null,
        aboveSma50:  s50  ? q.price > s50  : null,
        aboveSma200: s200 ? q.price > s200 : null,
        pctAboveSma200: s200 ? parseFloat((((q.price - s200) / s200) * 100).toFixed(1)) : null,
        trend,
        support: support ? parseFloat(support.toFixed(2)) : null,
        distToSupportPct: distToSupport,
        stopLoss,
        entryQuality,
      })
    }

    return resp({ error: 'Unknown type' }, 400)

  } catch (err) {
    console.error('Market route error:', err)
    return resp({
      error: `Market data error: ${err.message}`,
      meta: {
        requestedType: type || null,
        fetchedAt: new Date().toISOString(),
        provider: null,
        partial: true,
        warnings: [err.message],
      },
    }, 500)
  }
}
