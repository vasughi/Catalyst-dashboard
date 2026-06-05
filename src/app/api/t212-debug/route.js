/**
 * CATALYST — src/app/api/t212-debug/route.js
 * Diagnostic endpoint — dumps raw T212 API responses
 * Visit: /api/t212-debug to see exactly what T212 returns
 * Remove this file once diagnosis is complete
 */

import { NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

const T212_KEY    = process.env.TRADING212_API_KEY
const T212_SECRET = process.env.TRADING212_API_SECRET
const T212_BASE   = 'https://live.trading212.com/api/v0'

function buildAuthHeader() {
  return 'Basic ' + Buffer.from(T212_KEY + ':' + T212_SECRET).toString('base64')
}

async function t212fetch(path) {
  const res = await fetch(`${T212_BASE}${path}`, {
    headers: { 'Authorization': buildAuthHeader() },
    cache: 'no-store',
  })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } }
  catch { return { status: res.status, raw: text.slice(0, 500) } }
}

export async function GET() {
  const [portfolio, pies] = await Promise.allSettled([
    t212fetch('/equity/portfolio'),
    t212fetch('/equity/pies'),
  ])

  const portfolioData = portfolio.status === 'fulfilled' ? portfolio.value : { error: portfolio.reason?.message }
  const piesData      = pies.status      === 'fulfilled' ? pies.value      : { error: pies.reason?.message }

  // Fetch first 3 pie details to see structure
  const pieList = piesData?.data || []
  const pieDetails = await Promise.allSettled(
    pieList.slice(0, 5).map(async p => {
      const d = await t212fetch(`/equity/pies/${p.id}`)
      return { id: p.id, name: p.settings?.name, response: d }
    })
  )

  const positions = portfolioData?.data || []
  const tickers   = positions.map(p => p.ticker)

  return NextResponse.json({
    summary: {
      portfolioPositionCount: positions.length,
      tickers,
      hasNBIS: tickers.some(t => t.includes('NBIS')),
      hasASTS: tickers.some(t => t.includes('ASTS')),
      hasMU:   tickers.some(t => t.includes('MU')),
      pieCount: pieList.length,
    },
    rawPortfolioFirst5: positions.slice(0, 5),
    rawPortfolioFields: positions.length > 0 ? Object.keys(positions[0]) : [],
    rawPieList: pieList,
    pieDetails: pieDetails.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message }),
  }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}
