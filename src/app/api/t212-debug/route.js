/**
 * CATALYST — src/app/api/t212-debug/route.js
 * Shows ALL raw ticker strings + pie instrument details
 */
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

export async function GET() {
  const piesRes = await get('/equity/pies')
  await delay(500)
  const portRes = await get('/equity/portfolio')
  await delay(300)

  const pieList  = piesRes.data || []
  const positions = portRes.data || []

  // Raw tickers exactly as T212 returns them — no cleaning
  const rawTickers = positions.map(p => ({
    raw: p.ticker,
    qty: p.quantity,
    pieQty: p.pieQuantity,
    frontend: p.frontend,
  }))

  // Fetch pie details sequentially
  const pieDetails = []
  for (const pie of pieList) {
    await delay(600)
    const d = await get(`/equity/pies/${pie.id}`)
    const name = d.data?.settings?.name || `Pie ${pie.id}`
    const instruments = (d.data?.instruments || []).map(i => ({
      rawTicker: i.ticker,
      ownedQty: i.ownedQuantity,
      expectedShare: i.expectedShare,
    }))
    pieDetails.push({ id: pie.id, name, status: d.status, instruments })
  }

  // Look specifically for NBIS and ASTS anywhere
  const allRawTickers = rawTickers.map(t => t.raw)
  const allPieTickers = pieDetails.flatMap(p => p.instruments.map(i => i.rawTicker))

  return NextResponse.json({
    portfolioCount: positions.length,
    pieCount: pieList.length,
    // Specific search
    nbisInPortfolio: allRawTickers.filter(t => t?.toUpperCase().includes('NBIS')),
    astsInPortfolio: allRawTickers.filter(t => t?.toUpperCase().includes('ASTS')),
    nbisInPies: allPieTickers.filter(t => t?.toUpperCase().includes('NBIS')),
    astsInPies: allPieTickers.filter(t => t?.toUpperCase().includes('ASTS')),
    // All raw portfolio tickers
    allPortfolioTickers: rawTickers,
    // Pie instrument details
    pieDetails,
  }, { headers: {'Cache-Control':'no-store'} })
}
