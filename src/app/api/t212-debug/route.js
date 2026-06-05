import { NextResponse } from 'next/server'
export const dynamic    = 'force-dynamic'
export const maxDuration = 60

const T212_KEY    = process.env.TRADING212_API_KEY
const T212_SECRET = process.env.TRADING212_API_SECRET
const T212_BASE   = 'https://live.trading212.com/api/v0'

function auth() { return 'Basic ' + Buffer.from(T212_KEY + ':' + T212_SECRET).toString('base64') }
const delay = ms => new Promise(r => setTimeout(r, ms))

async function get(path) {
  const res = await fetch(`${T212_BASE}${path}`, { headers:{'Authorization':auth()}, cache:'no-store' })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } }
  catch { return { status: res.status, raw: text.slice(0,200) } }
}

async function getWithRetry(path) {
  for (const wait of [0, 2000, 5000, 10000]) {
    if (wait) await delay(wait)
    const r = await get(path)
    if (r.status !== 429) return r
  }
  return { status: 429, data: null }
}

export async function GET() {
  // Wait 2s first to let any previous rate limit window clear
  await delay(2000)
  const piesRes = await get('/equity/pies')
  await delay(1000)
  const portRes = await get('/equity/portfolio')

  const pieList   = piesRes.data || []
  const positions = portRes.data || []

  const pieDetails = []
  for (const pie of pieList) {
    await delay(1000)  // 1s between each
    const d = await getWithRetry(`/equity/pies/${pie.id}`)
    pieDetails.push({
      id:          pie.id,
      name:        d.data?.settings?.name || `Pie ${pie.id}`,
      status:      d.status,
      instruments: (d.data?.instruments || []).map(i => i.ticker),
    })
  }

  const allPieTickers = pieDetails.flatMap(p => p.instruments)

  return NextResponse.json({
    portfolioCount:   positions.length,
    pieCount:         pieList.length,
    nbisInPortfolio:  positions.filter(p => p.ticker?.includes('NBIS')).map(p => p.ticker),
    astsInPortfolio:  positions.filter(p => p.ticker?.includes('ASTS')).map(p => p.ticker),
    nbisInPies:       allPieTickers.filter(t => t?.includes('NBIS')),
    astsInPies:       allPieTickers.filter(t => t?.includes('ASTS')),
    pieDetails,
    portfolioTickers: positions.map(p => p.ticker),
  }, { headers: {'Cache-Control':'no-store'} })
}
