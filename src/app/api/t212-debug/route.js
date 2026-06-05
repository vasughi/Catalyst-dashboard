import { NextResponse } from 'next/server'
export const dynamic    = 'force-dynamic'
export const maxDuration = 60

const T212_KEY    = process.env.TRADING212_API_KEY
const T212_SECRET = process.env.TRADING212_API_SECRET
const T212_BASE   = 'https://live.trading212.com/api/v0'

function auth() { return 'Basic ' + Buffer.from(T212_KEY + ':' + T212_SECRET).toString('base64') }
const delay = ms => new Promise(r => setTimeout(r, ms))

async function get(path) {
  try {
    const res = await fetch(`${T212_BASE}${path}`, {
      headers: { 'Authorization': auth() },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    const text = await res.text()
    try { return { status: res.status, data: JSON.parse(text) } }
    catch { return { status: res.status, raw: text.slice(0,200) } }
  } catch(e) {
    return { status: 0, error: e.message }
  }
}

export async function GET() {
  // Get portfolio first
  const portRes = await get('/equity/portfolio')
  await delay(800)
  const piesRes = await get('/equity/pies')

  const positions = portRes.data || []
  const pieList   = piesRes.data || []

  // Search portfolio for NBIS and ASTS — case insensitive, partial match
  const nbisPositions = positions.filter(p =>
    p.ticker?.toUpperCase().includes('NBIS')
  )
  const astsPositions = positions.filter(p =>
    p.ticker?.toUpperCase().includes('ASTS') ||
    p.ticker?.toUpperCase().includes('AST')
  )

  // Full portfolio with pieQuantity
  const portfolioSummary = positions.map(p => ({
    ticker:   p.ticker,
    qty:      p.quantity,
    pieQty:   p.pieQuantity,
    frontend: p.frontend,
    directQty: Math.max(0, (p.quantity||0) - (p.pieQuantity||0)),
  }))

  // Pie list with names
  const pieSummary = pieList.map(p => ({
    id:   p.id,
    name: p.settings?.name || `Pie ${p.id}`,
  }))

  return NextResponse.json({
    portfolioCount: positions.length,
    pieCount:       pieList.length,
    pieSummary,
    // Specific search
    nbisInPortfolio: nbisPositions,
    astsInPortfolio: astsPositions,
    // All positions with directQty > 0 (should include NBIS and ASTS if direct)
    directPositions: portfolioSummary.filter(p => p.directQty > 0),
    // All positions with pieQty > 0
    piePositions:    portfolioSummary.filter(p => p.pieQty > 0),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
