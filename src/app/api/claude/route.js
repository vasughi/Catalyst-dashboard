import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
    }

    const text = await request.text()
    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 })
    }

    let body
    try {
      body = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 })
    }

    const prompt = body?.prompt
    const mode = body?.mode || 'section'

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: mode === 'deepdive' ? 600 : 1000,
        system: 'Return ONLY valid compact JSON. No markdown. No backticks. No explanation.',
        messages: [{ role: 'user', content: prompt.trim() }]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: `API error: ${data.error?.message || 'Unknown error'}` },
        { status: response.status }
      )
    }

    return NextResponse.json(data)

  } catch (err) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 })
  }
}
