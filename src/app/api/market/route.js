import { NextResponse } from 'next/server'

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
  'sec-ch-ua': '"Chromium";v="122"',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
}

// ── Step 1: get a crumb + cookie from Yahoo Finance ──────────────────────────
async function getYFCrumb() {
  try {
    // Hit consent page first (EU cookie law)
    const consent = await fetch('https://guce.yahoo.com/copyConsent?sessionId=3_cc-session_abc&lang=en-GB', {
      headers: BROWSER_HEADERS, redirect: 'follow'
    }).catch(() => null)

    // Get the main page to extract crumb
    const pageRes = await fetch('https://finance.yahoo.com/quote/AAPL/', {
      headers: BROWSER_HEADERS, redirect: 'follow'
    })
    const setCookie = pageRes.headers.get('set-cookie') || ''
    const cookies = setCookie.split(/,(?=[^;]+=[^;]+;)/).map(c => c.trim().split(';')[0]).join('; ')

    // Try the crumb endpoint
    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...BROWSER_HEADERS, Cookie: cookies }
    })
    const crumb = (await crumbRes.text()).trim()

    if (crumb && crumb.length < 20 && !crumb.includes('<') && !crumb.includes('{')) {
      return { crumb, cookies }
    }
  } catch(e) {
    console.log('Crumb fetch failed:', e.message)
  }
  return { crumb: null, cookies: '' }
}

// ── Stooq fallback — completely free, no auth needed ────────────────────────
const STOOQ_MAP = {
  '^GSPC':'^spx', '^IXIC':'^ndq', '^DJI':'^dji', '^RUT':'^rut',
  '^FTSE':'^ftx', '^GDAXI':'^dax', '^FCHI':'^cac', '^N225':'^nkx',
  'ES=F':'^spx', 'NQ=F':'^ndq', 'YM=F':'^dji',
  'CL=F':'cl.f', 'GC=F':'gc.f',
  'GBPUSD=X':'gbpusd', 'EURUSD=X':'eurusd', 'USDJPY=X':'usdjpy',
}

async function fetchStooq(sym) {
  const s = STOOQ_MAP[sym] || sym.toLowerCase().replace('=x','').replace('^','^') + '.us'
  try {
    const res = await fetch(`https://stooq.com/q/l/?s=${s}&f=sd2t2ohlcv&e=csv`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const text = await res.text()
    const lines = text.trim().split('\n')
    if (lines.length < 2) return null
    const cols = lines[1].split(',')
    const close = parseFloat(cols[4])
    const open = parseFloat(cols[2])
    if (isNaN(close)) return null
    const chgPct = open > 0 ? ((close - open) / open * 100) : 0
    return {
      symbol: sym,
      regularMarketPrice: close,
      regularMarketChangePercent: chgPct,
      regularMarketChange: close - open,
      shortName: sym
    }
  } catch { return null }
}

// ── Main quote fetcher with YF + Stooq fallback ──────────────────────────────
async function fetchQuotes(symbols) {
  // Try Yahoo Finance first
  try {
    const { crumb, cookies } = await getYFCrumb()
    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : ''
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}${crumbParam}&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent,regularMarketChange,marketCap,averageDailyVolume3Month,regularMarketVolume`

    const res = await fetch(url, {
      headers: { ...BROWSER_HEADERS, ...(cookies ? { Cookie: cookies } : {}) },
      cache: 'no-store'
    })

    if (res.ok) {
      const data = await res.json()
      const results = data.quoteResponse?.result || []
      if (results.length > 0) return results
    }
    console.log('YF returned', res.status, '— falling back to Stooq')
  } catch(e) {
    console.log('YF error:', e.message, '— falling back to Stooq')
  }

  // Stooq fallback — fetch individually (slower but reliable)
  const results = await Promise.allSettled(symbols.map(fetchStooq))
  return results.map(r => r.value).filter(Boolean)
}

// ── Movers via YF screener ────────────────────────────────────────────────────
async function fetchMovers(scrId) {
  try {
    const { crumb, cookies } = await getYFCrumb()
    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : ''
    const url = `https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${scrId}&count=5${crumbParam}`
    const res = await fetch(url, {
      headers: { ...BROWSER_HEADERS, ...(cookies ? { Cookie: cookies } : {}) }
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.finance?.result?.[0]?.quotes || []
  } catch { return [] }
}

// ── Format helpers ────────────────────────────────────────────────────────────
function pct(q) {
  const c = q?.regularMarketChangePercent || 0
  return { change: `${c >= 0 ? '+' : ''}${c.toFixed(2)}%`, direction: c >= 0 ? 'up' : 'down' }
}
function price(q) {
  return q?.regularMarketPrice?.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  try {
    // GLOBAL
    if (type === 'global') {
      const symbols = ['^GSPC','^IXIC','^DJI','^RUT','^FTSE','^GDAXI','^FCHI','^N225','CL=F','GC=F','GBPUSD=X','EURUSD=X','USDJPY=X','^TNX']
      const quotes = await fetchQuotes(symbols)
      const q = Object.fromEntries(quotes.map(x => [x.symbol, x]))

      const named = (sym, name) => {
        const x = q[sym]; if (!x?.regularMarketPrice) return null
        return { name, value: price(x), ...pct(x) }
      }

      return NextResponse.json({
        markets: [
          named('^GSPC','S&P 500'), named('^IXIC','NASDAQ'), named('^DJI','Dow Jones'),
          named('^RUT','Russell 2000'), named('^FTSE','FTSE 100'), named('^GDAXI','DAX'),
          named('^FCHI','CAC 40'), named('^N225','Nikkei 225'),
        ].filter(Boolean),
        commodities: [
          named('CL=F','WTI Oil'), named('GC=F','Gold'),
        ].filter(Boolean),
        currencies: [
          q['GBPUSD=X']?.regularMarketPrice && { pair:'GBP/USD', value: q['GBPUSD=X'].regularMarketPrice.toFixed(4), change: pct(q['GBPUSD=X']).change },
          q['EURUSD=X']?.regularMarketPrice && { pair:'EUR/USD', value: q['EURUSD=X'].regularMarketPrice.toFixed(4), change: pct(q['EURUSD=X']).change },
          q['USDJPY=X']?.regularMarketPrice && { pair:'USD/JPY', value: q['USDJPY=X'].regularMarketPrice.toFixed(2), change: pct(q['USDJPY=X']).change },
        ].filter(Boolean),
        bonds: [
          q['^TNX']?.regularMarketPrice && { name:'US 10Y Yield', yield: `${q['^TNX'].regularMarketPrice.toFixed(2)}%`, change: pct(q['^TNX']).change },
        ].filter(Boolean),
      })
    }

    // US PRE-MARKET
    if (type === 'us') {
      const [futureQuotes, gainers, losers] = await Promise.all([
        fetchQuotes(['ES=F','NQ=F','YM=F','^RUT']),
        fetchMovers('day_gainers'),
        fetchMovers('day_losers'),
      ])
      const names = { 'ES=F':'S&P 500 Futures','NQ=F':'NASDAQ Futures','YM=F':'Dow Futures','^RUT':'Russell 2000' }
      return NextResponse.json({
        futures: futureQuotes.map(q => ({ index: names[q.symbol]||q.symbol, value: price(q), ...pct(q) })),
        gainers: gainers.slice(0,5).map(q => ({ ticker:q.symbol, company:q.shortName||q.symbol, price:`$${q.regularMarketPrice?.toFixed(2)}`, change:`+${q.regularMarketChangePercent?.toFixed(2)}%`, direction:'up' })),
        losers: losers.slice(0,5).map(q => ({ ticker:q.symbol, company:q.shortName||q.symbol, price:`$${q.regularMarketPrice?.toFixed(2)}`, change:`${q.regularMarketChangePercent?.toFixed(2)}%`, direction:'down' })),
      })
    }

    // EUROPE PRE-MARKET
    if (type === 'europe') {
      const quotes = await fetchQuotes(['^FTSE','^GDAXI','^FCHI'])
      const names = { '^FTSE':'FTSE 100','^GDAXI':'DAX','^FCHI':'CAC 40' }
      return NextResponse.json({
        futures: quotes.map(q => ({ index:names[q.symbol]||q.symbol, value:price(q), ...pct(q) })),
      })
    }

    // OPPORTUNITIES — research universe live prices
    if (type === 'opportunities') {
      const universe = ['NVDA','AMD','AVGO','TSM','MRVL','ARM','MSFT','GOOGL','META','PLTR','DELL','SMCI','CRWD','PANW','ZS','LMT','RTX','NOC','AXON','VRT','ETN','CEG','FSLR','ANET','RKLB']
      const quotes = await fetchQuotes(universe)
      return NextResponse.json({
        stocks: quotes.filter(q=>q.regularMarketPrice).map(q => ({
          ticker: q.symbol,
          name: q.shortName||q.symbol,
          price: `$${q.regularMarketPrice?.toFixed(2)}`,
          change1d: pct(q).change,
          direction: pct(q).direction,
          marketCap: q.marketCap ? `$${(q.marketCap/1e9).toFixed(1)}B` : 'N/A',
        }))
      })
    }

    return NextResponse.json({ error:'Unknown type' }, { status:400 })

  } catch(err) {
    console.error('Market error:', err)
    return NextResponse.json({ error:`Market data error: ${err.message}` }, { status:500 })
  }
}
