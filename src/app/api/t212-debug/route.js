import { NextResponse } from 'next/server'
export const dynamic    = 'force-dynamic'
export const maxDuration = 60

const T212_KEY    = process.env.TRADING212_API_KEY
const T212_SECRET = process.env.TRADING212_API_SECRET
const T212_BASE   = 'https://live.trading212.com/api/v0'

function auth() { return 'Basic ' + Buffer.from(T212_KEY + ':' + T212_SECRET).toString('base64') }

async function get(path) {
  try {
    const res = await fetch(`${T212_BASE}${path}`, {
      headers: { 'Authorization': auth() },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    const text = await res.text()
    try { return { status: res.status, data: JSON.parse(text) } }
    catch { return { status: res.status, raw: text.slice(0, 100) } }
  } catch(e) {
    return { status: 0, error: e.message }
  }
}

export async function GET() {
  // Step 1: just get the pies list
  const piesRes = await get('/equity/pies')
  const pieList = piesRes.data || []

  // Step 2: fetch each pie detail with 1s gap, no retries
  const pieDetails = []
  for (const pie of pieList) {
    await new Promise(r => setTimeout(r, 1000))
    const d = await get(`/equity/pies/${pie.id}`)
    pieDetails.push({
      id:     pie.id,
      name:   d.data?.settings?.name || `Pie ${pie.id}`,
      status: d.status,
      tickers: (d.data?.instruments || []).map(i => i.ticker),
    })
  }

  return NextResponse.json({
    pieListStatus:  piesRes.status,
    pieCount:       pieList.length,
    pieIds:         pieList.map(p => p.id),
    pieDetails,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
