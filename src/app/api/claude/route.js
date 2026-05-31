import { NextResponse } from 'next/server'

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set' },
      { status: 500 }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { prompt, mode } = body
  if (!prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
  }

  const systemPrompt = mode === 'deepdive'
    ? 'You are a trading analyst. Give a brief analysis. Be concise. Mark facts as FACT, analysis as ANALYSIS.'
    : 'You are a trading analyst. Return ONLY valid JSON. No markdown. No backticks. No explanation. Be concise.'

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: mode === 'deepdive' ? 800 : 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return NextResponse.json(
        { error: `API error: ${data.error?.message || 'Unknown'}` },
        { status: response.status }
      )
    }

    return NextResponse.json(data)

  } catch (err) {
    console.error('Server error:', err)
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 })
  }
}
