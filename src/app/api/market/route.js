import { NextResponse } from 'next/server'

const YF = 'https://query1.finance.yahoo.com'

// Headers to mimic browser - Yahoo Finance requires these server-side
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
}

async function fetchQuotes(symbols) {
  const url = `${YF}/v7/finance/quote?symbols=${symbols.join(',')}`
  const res = await fetch(url, { headers: HEADERS, cache: 'no-store' })
  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}`)
  const data = await res.json()
  return data.quoteResponse?.result || []
}

async function fetchMovers(scrId) {
  try {
    const url = `${YF}/v1/finance/screener/predefined/saved?scrIds=${scrId}&count=5&region=US&lang=en-US`
    const res = await fetch(url, { headers: HEADERS, cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.finance?.result?.[0]?.quotes || []
  } catch { return [] }
}

function pct(q) {
  const c = q?.regularMarketChangePercent || 0
  return { change: `${c >= 0 ? '+' : ''}${c.toFixed(2)}%`, direction: c >= 0 ? 'up' : 'down', raw: c }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  try {
    // --- GLOBAL OVERVIEW ---
    if (type === 'global') {
      const symbols = [
        '^GSPC','^IXIC','^DJI','^RUT',     // US indices
        '^FTSE','^GDAXI','^FCHI',           // Europe
        '^N225','^HSI',                      // Asia
        'CL=F','GC=F','HG=F','NG=F',        // Commodities
        'GBPUSD=X','EURUSD=X','USDJPY=X','DX-Y.NYB', // FX
        '^TNX','^TYX'                        // Bonds (10Y, 30Y yield)
      ]
      const quotes = await fetchQuotes(symbols)
      const q = Object.fromEntries(quotes.map(x => [x.symbol, x]))

      const named = (sym, name) => {
        const x = q[sym]; if (!x) return null
        return { name, value: x.regularMarketPrice?.toLocaleString('en-US', { maximumFractionDigits: 2 }), ...pct(x) }
      }

      return NextResponse.json({
        markets: [
          named('^GSPC','S&P 500'), named('^IXIC','NASDAQ'), named('^DJI','Dow Jones'),
          named('^RUT','Russell 2000'), named('^FTSE','FTSE 100'), named('^GDAXI','DAX'),
          named('^FCHI','CAC 40'), named('^N225','Nikkei 225'), named('^HSI','Hang Seng'),
        ].filter(Boolean),
        commodities: [
          named('CL=F','WTI Oil'), named('GC=F','Gold'),
          named('HG=F','Copper'), named('NG=F','Natural Gas'),
        ].filter(Boolean),
        currencies: [
          { pair:'DXY', value: q['DX-Y.NYB']?.regularMarketPrice?.toFixed(2), change: pct(q['DX-Y.NYB']).change },
          { pair:'GBP/USD', value: q['GBPUSD=X']?.regularMarketPrice?.toFixed(4), change: pct(q['GBPUSD=X']).change },
          { pair:'EUR/USD', value: q['EURUSD=X']?.regularMarketPrice?.toFixed(4), change: pct(q['EURUSD=X']).change },
          { pair:'USD/JPY', value: q['USDJPY=X']?.regularMarketPrice?.toFixed(2), change: pct(q['USDJPY=X']).change },
        ].filter(x => x.value),
        bonds: [
          { name:'US 10Y Yield', yield: q['^TNX'] ? `${q['^TNX'].regularMarketPrice?.toFixed(2)}%` : null, change: pct(q['^TNX']).change },
          { name:'US 30Y Yield', yield: q['^TYX'] ? `${q['^TYX'].regularMarketPrice?.toFixed(2)}%` : null, change: pct(q['^TYX']).change },
        ].filter(x => x.yield),
      })
    }

    // --- US PRE-MARKET ---
    if (type === 'us') {
      const [futureQuotes, gainers, losers] = await Promise.all([
        fetchQuotes(['ES=F','NQ=F','YM=F','RTY=F']),
        fetchMovers('day_gainers'),
        fetchMovers('day_losers'),
      ])
      const futureNames = { 'ES=F':'S&P 500 Futures','NQ=F':'NASDAQ Futures','YM=F':'Dow Futures','RTY=F':'Russell Futures' }
      return NextResponse.json({
        futures: futureQuotes.map(q => ({
          index: futureNames[q.symbol] || q.symbol,
          value: q.regularMarketPrice?.toLocaleString('en-US', { maximumFractionDigits: 0 }),
          ...pct(q)
        })),
        gainers: gainers.slice(0,5).map(q => ({
          ticker: q.symbol,
          company: q.shortName || q.symbol,
          price: `$${q.regularMarketPrice?.toFixed(2)}`,
          change: `+${q.regularMarketChangePercent?.toFixed(2)}%`,
          direction: 'up',
          volume: q.regularMarketVolume?.toLocaleString()
        })),
        losers: losers.slice(0,5).map(q => ({
          ticker: q.symbol,
          company: q.shortName || q.symbol,
          price: `$${q.regularMarketPrice?.toFixed(2)}`,
          change: `${q.regularMarketChangePercent?.toFixed(2)}%`,
          direction: 'down',
          volume: q.regularMarketVolume?.toLocaleString()
        })),
      })
    }

    // --- EUROPE PRE-MARKET ---
    if (type === 'europe') {
      const quotes = await fetchQuotes(['^FTSE','^GDAXI','^FCHI','^STOXX50E','^AEX'])
      const names = { '^FTSE':'FTSE 100','^GDAXI':'DAX','^FCHI':'CAC 40','^STOXX50E':'STOXX 50','^AEX':'AEX' }
      return NextResponse.json({
        futures: quotes.map(q => ({
          index: names[q.symbol] || q.symbol,
          value: q.regularMarketPrice?.toLocaleString('en-US', { maximumFractionDigits: 0 }),
          ...pct(q)
        })),
      })
    }

    // --- OPPORTUNITIES: fetch research universe prices ---
    if (type === 'opportunities') {
      const universe = [
        // AI / Semiconductors
        'NVDA','AMD','AVGO','TSM','MRVL','ARM','INTC','QCOM','SMCI','DELL',
        // Software / AI
        'MSFT','GOOGL','META','PLTR','NOW','SNOW',
        // Cybersecurity
        'CRWD','PANW','ZS','NET','S',
        // Defence / Aerospace
        'LMT','RTX','NOC','GD','AXON','SAIC','RKLB',
        // Power / Energy
        'VRT','ETN','CEG','GEV','NRG','FSLR',
        // Critical Minerals
        'MP','UUUU','NXE','ALB',
        // Data centres / Networking
        'ANET','CSCO','JNPR'
      ]
      const quotes = await fetchQuotes(universe)
      return NextResponse.json({
        stocks: quotes.map(q => ({
          ticker: q.symbol,
          name: q.shortName || q.symbol,
          price: `$${q.regularMarketPrice?.toFixed(2)}`,
          change1d: `${pct(q).change}`,
          direction: pct(q).direction,
          marketCap: q.marketCap ? `$${(q.marketCap/1e9).toFixed(1)}B` : 'N/A',
          volume: q.regularMarketVolume?.toLocaleString() || 'N/A',
          avgVolume: q.averageDailyVolume3Month?.toLocaleString() || 'N/A',
        })).filter(s => s.price !== '$undefined')
      })
    }

    return NextResponse.json({ error: 'Unknown type parameter' }, { status: 400 })

  } catch (err) {
    console.error('Market data error:', err)
    return NextResponse.json({ error: `Market data error: ${err.message}` }, { status: 500 })
  }
}
