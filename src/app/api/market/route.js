import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: 'https://finance.yahoo.com/',
  Origin: 'https://finance.yahoo.com',
  'sec-ch-ua': '"Chromium";v="122"',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

const STOOQ_MAP = {
  '^GSPC': '^spx',
  '^IXIC': '^ndq',
  '^DJI': '^dji',
  '^RUT': '^rut',
  '^FTSE': '^ftx',
  '^GDAXI': '^dax',
  '^FCHI': '^cac',
  '^N225': '^nkx',
  '^TNX': '^tnx',
  'ES=F': '^spx',
  'NQ=F': '^ndq',
  'YM=F': '^dji',
  'CL=F': 'cl.f',
  'GC=F': 'gc.f',
  'GBPUSD=X': 'gbpusd',
  'EURUSD=X': 'eurusd',
  'USDJPY=X': 'usdjpy',
}

function jsonNoStore(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  })
}

function pct(q) {
  const c = Number(q?.regularMarketChangePercent ?? 0)
  return {
    change: `${c >= 0 ? '+' : ''}${c.toFixed(2)}%`,
    direction: c >= 0 ? 'up' : 'down',
  }
}

function price(q) {
  const p = Number(q?.regularMarketPrice)
  if (!Number.isFinite(p)) return null
  return p.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function cleanWarnings(warnings = []) {
  return [...new Set(warnings.filter(Boolean))]
}

function baseMeta(type) {
  return {
    requestedType: type,
    fetchedAt: new Date().toISOString(),
    provider: null,
    fallbackUsed: false,
    partial: false,
    warnings: [],
  }
}

async function getYFCrumb() {
  try {
    await fetch('https://guce.yahoo.com/copyConsent?sessionId=3_cc-session_abc&lang=en-GB', {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      cache: 'no-store',
    }).catch(() => null)

    const pageRes = await fetch('https://finance.yahoo.com/quote/AAPL/', {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      cache: 'no-store',
    })

    const setCookie = pageRes.headers.get('set-cookie') || ''
    const cookies = setCookie
      .split(/,(?=\s*[^;=]+=[^;]+)/)
      .map((c) => c.trim().split(';')[0])
      .filter(Boolean)
      .join('; ')

    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...BROWSER_HEADERS, ...(cookies ? { Cookie: cookies } : {}) },
      cache: 'no-store',
    })

    const crumb = (await crumbRes.text()).trim()

    if (crumb && crumb.length < 32 && !crumb.includes('<') && !crumb.includes('{')) {
      return { crumb, cookies, ok: true }
    }

    return { crumb: null, cookies, ok: false }
  } catch (e) {
    return { crumb: null, cookies: '', ok: false, error: e.message }
  }
}

async function fetchStooq(sym) {
  const mapped =
    STOOQ_MAP[sym] ||
    `${sym.toLowerCase().replace('=x', '').replace('^', '')}.us`

  try {
    const res = await fetch(`https://stooq.com/q/l/?s=${mapped}&f=sd2t2ohlcv&e=csv`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    })

    if (!res.ok) return null

    const text = await res.text()
    const lines = text.trim().split('\n')
    if (lines.length < 2) return null

    const cols = lines[1].split(',')
    const open = parseFloat(cols[2])
    const close = parseFloat(cols[6]) || parseFloat(cols[4])

    if (!Number.isFinite(close)) return null

    const chgPct = Number.isFinite(open) && open > 0 ? ((close - open) / open) * 100 : 0

    return {
      symbol: sym,
      shortName: sym,
      regularMarketPrice: close,
      regularMarketChangePercent: chgPct,
      regularMarketChange: Number.isFinite(open) ? close - open : 0,
      regularMarketTime: null,
      _provider: 'stooq',
    }
  } catch {
    return null
  }
}

async function fetchQuotes(symbols) {
  const warnings = []

  try {
    const { crumb, cookies, ok, error } = await getYFCrumb()
    if (!ok && error) warnings.push(`Yahoo crumb step failed: ${error}`)

    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : ''
    const fields = [
      'symbol',
      'shortName',
      'regularMarketPrice',
      'regularMarketChangePercent',
      'regularMarketChange',
      'regularMarketTime',
      'marketCap',
      'averageDailyVolume3Month',
      'regularMarketVolume',
    ].join(',')

    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}${crumbParam}&fields=${fields}`

    const res = await fetch(url, {
      headers: { ...BROWSER_HEADERS, ...(cookies ? { Cookie: cookies } : {}) },
      cache: 'no-store',
    })

    if (res.ok) {
      const data = await res.json()
      const results = data?.quoteResponse?.result || []

      if (results.length > 0) {
        return {
          provider: 'yahoo',
          fallbackUsed: false,
          partial: results.length < symbols.length,
          warnings: cleanWarnings([
            ...warnings,
            results.length < symbols.length
              ? `Yahoo returned ${results.length}/${symbols.length} quotes`
              : null,
          ]),
          quotes: results.map((q) => ({ ...q, _provider: 'yahoo' })),
        }
      }

      warnings.push('Yahoo returned no quote results')
    } else {
      warnings.push(`Yahoo quote endpoint returned ${res.status}`)
    }
  } catch (e) {
    warnings.push(`Yahoo quote fetch failed: ${e.message}`)
  }

  const settled = await Promise.allSettled(symbols.map(fetchStooq))
  const quotes = settled
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter(Boolean)

  return {
    provider: 'stooq',
    fallbackUsed: true,
    partial: quotes.length < symbols.length,
    warnings: cleanWarnings([
      ...warnings,
      quotes.length < symbols.length ? `Stooq returned ${quotes.length}/${symbols.length} quotes` : null,
      'Yahoo failed or returned no usable quote data; used Stooq fallback',
    ]),
    quotes,
  }
}

async function fetchMovers(scrId) {
  const warnings = []

  try {
    const { crumb, cookies, ok, error } = await getYFCrumb()
    if (!ok && error) warnings.push(`Yahoo crumb step failed for movers: ${error}`)

    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : ''
    const url = `https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${scrId}&count=5${crumbParam}`

    const res = await fetch(url, {
      headers: { ...BROWSER_HEADERS, ...(cookies ? { Cookie: cookies } : {}) },
      cache: 'no-store',
    })

    if (!res.ok) {
      return {
        provider: 'yahoo',
        ok: false,
        warnings: cleanWarnings([...warnings, `Yahoo movers endpoint returned ${res.status} for ${scrId}`]),
        quotes: [],
      }
    }

    const data = await res.json()
    const quotes = data?.finance?.result?.[0]?.quotes || []

    return {
      provider: 'yahoo',
      ok: quotes.length > 0,
      warnings: cleanWarnings([
        ...warnings,
        quotes.length === 0 ? `Yahoo movers returned no quotes for ${scrId}` : null,
      ]),
      quotes,
    }
  } catch (e) {
    return {
      provider: 'yahoo',
      ok: false,
      warnings: cleanWarnings([`Yahoo movers fetch failed for ${scrId}: ${e.message}`]),
      quotes: [],
    }
  }
}

function named(qMap, sym, name) {
  const x = qMap[sym]
  if (!x || !Number.isFinite(Number(x.regularMarketPrice))) return null

  return {
    name,
    value: price(x),
    sourceTimestamp: x?.regularMarketTime
      ? new Date(x.regularMarketTime * 1000).toISOString()
      : null,
    provider: x?._provider || null,
    ...pct(x),
  }
}

function quoteMap(quotes) {
  return Object.fromEntries(quotes.map((q) => [q.symbol, q]))
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  try {
    if (!type) {
      return jsonNoStore({ error: 'Missing type parameter' }, 400)
    }

    if (type === 'global') {
      const meta = baseMeta(type)
      const symbols = [
        '^GSPC',
        '^IXIC',
        '^DJI',
        '^RUT',
        '^FTSE',
        '^GDAXI',
        '^FCHI',
        '^N225',
        'CL=F',
        'GC=F',
        'GBPUSD=X',
        'EURUSD=X',
        'USDJPY=X',
        '^TNX',
      ]

      const quoteResult = await fetchQuotes(symbols)
      const q = quoteMap(quoteResult.quotes)

      meta.provider = quoteResult.provider
      meta.fallbackUsed = quoteResult.fallbackUsed
      meta.partial = quoteResult.partial
      meta.warnings = quoteResult.warnings

      return jsonNoStore({
        meta,
        markets: [
          named(q, '^GSPC', 'S&P 500'),
          named(q, '^IXIC', 'NASDAQ'),
          named(q, '^DJI', 'Dow Jones'),
          named(q, '^RUT', 'Russell 2000'),
          named(q, '^FTSE', 'FTSE 100'),
          named(q, '^GDAXI', 'DAX'),
          named(q, '^FCHI', 'CAC 40'),
          named(q, '^N225', 'Nikkei 225'),
        ].filter(Boolean),
        commodities: [
          named(q, 'CL=F', 'WTI Oil'),
          named(q, 'GC=F', 'Gold'),
        ].filter(Boolean),
        currencies: [
          q['GBPUSD=X']?.regularMarketPrice
            ? {
                pair: 'GBP/USD',
                value: Number(q['GBPUSD=X'].regularMarketPrice).toFixed(4),
                change: pct(q['GBPUSD=X']).change,
                sourceTimestamp: q['GBPUSD=X']?.regularMarketTime
                  ? new Date(q['GBPUSD=X'].regularMarketTime * 1000).toISOString()
                  : null,
                provider: q['GBPUSD=X']?._provider || null,
              }
            : null,
          q['EURUSD=X']?.regularMarketPrice
            ? {
                pair: 'EUR/USD',
                value: Number(q['EURUSD=X'].regularMarketPrice).toFixed(4),
                change: pct(q['EURUSD=X']).change,
                sourceTimestamp: q['EURUSD=X']?.regularMarketTime
                  ? new Date(q['EURUSD=X'].regularMarketTime * 1000).toISOString()
                  : null,
                provider: q['EURUSD=X']?._provider || null,
              }
            : null,
          q['USDJPY=X']?.regularMarketPrice
            ? {
                pair: 'USD/JPY',
                value: Number(q['USDJPY=X'].regularMarketPrice).toFixed(2),
                change: pct(q['USDJPY=X']).change,
                sourceTimestamp: q['USDJPY=X']?.regularMarketTime
                  ? new Date(q['USDJPY=X'].regularMarketTime * 1000).toISOString()
                  : null,
                provider: q['USDJPY=X']?._provider || null,
              }
            : null,
        ].filter(Boolean),
        bonds: [
          q['^TNX']?.regularMarketPrice
            ? {
                name: 'US 10Y Yield',
                yield: `${Number(q['^TNX'].regularMarketPrice).toFixed(2)}%`,
                change: pct(q['^TNX']).change,
                sourceTimestamp: q['^TNX']?.regularMarketTime
                  ? new Date(q['^TNX'].regularMarketTime * 1000).toISOString()
                  : null,
                provider: q['^TNX']?._provider || null,
              }
            : null,
        ].filter(Boolean),
      })
    }

    if (type === 'us') {
      const meta = baseMeta(type)

      const [futureResult, gainersResult, losersResult] = await Promise.all([
        fetchQuotes(['ES=F', 'NQ=F', 'YM=F', '^RUT']),
        fetchMovers('day_gainers'),
        fetchMovers('day_losers'),
      ])

      meta.provider = futureResult.provider
      meta.fallbackUsed = futureResult.fallbackUsed
      meta.partial = futureResult.partial || !gainersResult.ok || !losersResult.ok
      meta.warnings = cleanWarnings([
        ...futureResult.warnings,
        ...gainersResult.warnings,
        ...losersResult.warnings,
        !gainersResult.ok ? 'Top gainers unavailable from Yahoo movers feed' : null,
        !losersResult.ok ? 'Top losers unavailable from Yahoo movers feed' : null,
      ])

      const names = {
        'ES=F': 'S&P 500 Futures',
        'NQ=F': 'NASDAQ Futures',
        'YM=F': 'Dow Futures',
        '^RUT': 'Russell 2000',
      }

      return jsonNoStore({
        meta,
        futures: futureResult.quotes.map((q) => ({
          index: names[q.symbol] || q.symbol,
          value: price(q),
          sourceTimestamp: q?.regularMarketTime
            ? new Date(q.regularMarketTime * 1000).toISOString()
            : null,
          provider: q?._provider || null,
          ...pct(q),
        })),
        gainers: gainersResult.quotes.slice(0, 5).map((q) => ({
          ticker: q.symbol,
          company: q.shortName || q.symbol,
          price: Number.isFinite(Number(q.regularMarketPrice))
            ? `$${Number(q.regularMarketPrice).toFixed(2)}`
            : 'N/A',
          change: Number.isFinite(Number(q.regularMarketChangePercent))
            ? `+${Number(q.regularMarketChangePercent).toFixed(2)}%`
            : 'N/A',
          direction: 'up',
          sourceTimestamp: q?.regularMarketTime
            ? new Date(q.regularMarketTime * 1000).toISOString()
            : null,
          provider: 'yahoo',
        })),
        losers: losersResult.quotes.slice(0, 5).map((q) => ({
          ticker: q.symbol,
          company: q.shortName || q.symbol,
          price: Number.isFinite(Number(q.regularMarketPrice))
            ? `$${Number(q.regularMarketPrice).toFixed(2)}`
            : 'N/A',
          change: Number.isFinite(Number(q.regularMarketChangePercent))
            ? `${Number(q.regularMarketChangePercent).toFixed(2)}%`
            : 'N/A',
          direction: 'down',
          sourceTimestamp: q?.regularMarketTime
            ? new Date(q.regularMarketTime * 1000).toISOString()
            : null,
          provider: 'yahoo',
        })),
      })
    }

    if (type === 'europe') {
      const meta = baseMeta(type)
      const result = await fetchQuotes(['^FTSE', '^GDAXI', '^FCHI'])

      meta.provider = result.provider
      meta.fallbackUsed = result.fallbackUsed
      meta.partial = result.partial
      meta.warnings = result.warnings

      const names = {
        '^FTSE': 'FTSE 100',
        '^GDAXI': 'DAX',
        '^FCHI': 'CAC 40',
      }

      return jsonNoStore({
        meta,
        futures: result.quotes.map((q) => ({
          index: names[q.symbol] || q.symbol,
          value: price(q),
          sourceTimestamp: q?.regularMarketTime
            ? new Date(q.regularMarketTime * 1000).toISOString()
            : null,
          provider: q?._provider || null,
          ...pct(q),
        })),
      })
    }

    if (type === 'opportunities') {
      const meta = baseMeta(type)
      const universe = [
        'NVDA',
        'AMD',
        'AVGO',
        'TSM',
        'MRVL',
        'ARM',
        'MSFT',
        'GOOGL',
        'META',
        'PLTR',
        'DELL',
        'SMCI',
        'CRWD',
        'PANW',
        'ZS',
        'LMT',
        'RTX',
        'NOC',
        'AXON',
        'VRT',
        'ETN',
        'CEG',
        'FSLR',
        'ANET',
        'RKLB',
      ]

      const result = await fetchQuotes(universe)

      meta.provider = result.provider
      meta.fallbackUsed = result.fallbackUsed
      meta.partial = result.partial
      meta.warnings = result.warnings

      return jsonNoStore({
        meta,
        stocks: result.quotes
          .filter((q) => Number.isFinite(Number(q.regularMarketPrice)))
          .map((q) => ({
            ticker: q.symbol,
            name: q.shortName || q.symbol,
            price: `$${Number(q.regularMarketPrice).toFixed(2)}`,
            change1d: pct(q).change,
            direction: pct(q).direction,
            marketCap: q.marketCap ? `$${(Number(q.marketCap) / 1e9).toFixed(1)}B` : 'N/A',
            sourceTimestamp: q?.regularMarketTime
              ? new Date(q.regularMarketTime * 1000).toISOString()
              : null,
            provider: q?._provider || null,
          })),
      })
    }

    return jsonNoStore({ error: 'Unknown type' }, 400)
  } catch (err) {
    console.error('Market error:', err)
    return jsonNoStore(
      {
        error: `Market data error: ${err.message}`,
        meta: {
          requestedType: type || null,
          fetchedAt: new Date().toISOString(),
          provider: null,
          fallbackUsed: false,
          partial: true,
          warnings: ['Unhandled server error in market route'],
        },
      },
      500
    )
  }
}
