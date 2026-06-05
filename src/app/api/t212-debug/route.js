import { NextResponse } from 'next/server'
export const dynamic    = 'force-dynamic'
export const maxDuration = 30

const T212_KEY    = process.env.TRADING212_API_KEY
const T212_SECRET = process.env.TRADING212_API_SECRET
const T212_BASE   = 'https://live.trading212.com/api/v0'

export async function GET(request) {
  const what = new URL(request.url).searchParams.get('what') || 'portfolio'

  const res = await fetch(`${T212_BASE}/equity/${what}`, {
    headers: { 'Authorization': 'Basic ' + Buffer.from(T212_KEY + ':' + T212_SECRET).toString('base64') },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })

  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  })
}
