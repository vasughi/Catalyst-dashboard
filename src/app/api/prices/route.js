import { NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

const FH_BASE = 'https://finnhub.io/api/v1'
const FH_KEY  = process.env.FINNHUB_API_KEY
const TD_BASE = 'https://api.twelvedata.com'
const TD_KEY  = process.env.TWELVE_DATA_API_KEY

async function fetchJson(url, ms = 6000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    const res = await fetch(url, { cache: 'no-store', signal: c.signal })
    clearTimeout(t)
    if (!res.ok) return null
    return res.json()
  } catch { clearTimeout(t); return null }
}

function fmtChange(pct) {
  const p = parseFloat(pct) || 0
  return (p >= 0 ? '+' : '') + p.toFixed(2) + '%'
}

function parseTd(sym, d) {
  if (!d || d.status === 'error') return null
  const price = parseFloat(d.close)
  const prev  = parseFloat(d.previous_close)
  const pct   = parseFloat(d.percent_change || 0)
  if (!price || price <= 0 || price > 100000) return null
  if (prev > 0 && Math.abs(price - prev) / prev > 0.40) return null
  return { symbol: sym, price, changePct: parseFloat(pct.toFixed(2)), change1d: fmtChange(pct), direction: pct >= 0 ? 'up' : 'down', prevClose: prev, source: 'twelvedata' }
}

async function tdBatch(symbols) {
  if (!TD_KEY || !symbols.length) return {}
  const url  = TD_BASE + '/quote?symbol=' + encodeURIComponent(symbols.join(',')) + '&apikey=' + TD_KEY
  const data = await fetchJson(url, 10000)
  if (!data) return {}
  const result = {}
  if (symbols.length === 1) {
    const q = parseTd(symbols[0], data)
    if (q) result[symbols[0]] = q
  } else {
    for (const sym of symbols) {
      const q = parseTd(sym, data[sym])
      if (q) result[sym] = q
    }
  }
  return result
}

async function fhQuote(sym) {
  if (!FH_KEY) return null
  const d = await fetchJson(FH_BASE + '/quote?symbol=' + encodeURIComponent(sym) + '&token=' + FH_KEY)
  if (!d || !d.c || d.c === 0) return null
  const price = d.c, prev = d.pc, pct = d.dp ?? 0
  if (prev > 0 && Math.abs(price - prev) / prev > 0.40) return null
  if (price < 0.001 || price > 100000) return null
  if (sym === 'NFLX' && (price < 50 || price > 150)) return null
  return { symbol: sym, price, changePct: parseFloat(pct.toFixed(2)), change1d: fmtChange(pct), direction: pct >= 0 ? 'up' : 'down', prevClose: prev, source: 'finnhub' }
}

export async function GET(request) {
  if (!FH_KEY) return NextResponse.json({ error: 'FINNHUB_API_KEY not set' }, { status: 500 })
  const { searchParams } = new URL(request.url)
  const symbols = (searchParams.get('symbols') || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  if (!symbols.length) return NextResponse.json({ error: 'No symbols. Use ?symbols=NVDA,AVGO' }, { status: 400 })

  const prices = {}
  if (TD_KEY) Object.assign(prices, await tdBatch(symbols))
  const missed = symbols.filter(s => !prices[s])
  if (missed.length) {
    const res = await Promise.allSettled(missed.map(fhQuote))
    res.forEach((r, i) => { prices[missed[i]] = r.status === 'fulfilled' && r.value ? r.value : null })
  }
  symbols.forEach(s => { if (!(s in prices)) prices[s] = null })

  return NextResponse.json(
    { prices, fetchedAt: new Date().toISOString(), requested: symbols.length, returned: Object.values(prices).filter(Boolean).length },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
