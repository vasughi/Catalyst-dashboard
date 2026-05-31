import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })

    const text = await request.text()
    if (!text?.trim()) return NextResponse.json({ error: 'Empty request body' }, { status: 400 })

    let body
    try { body = JSON.parse(text) }
    catch { return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 }) }

    const { prompt, mode } = body
    if (!prompt?.trim()) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })

    // For JSON mode: prefill assistant response with { to force JSON output
    // This is the most reliable way to guarantee Claude returns valid JSON
    const messages = [{ role: 'user', content: prompt.trim() }]
    if (mode !== 'deepdive') {
      messages.push({ role: 'assistant', content: '{' })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: mode === 'deepdive' ? 600 : 1500,
        system: mode === 'deepdive'
          ? 'You are a trading analyst. Be concise and factual. Mark each point FACT or ANALYSIS.'
          : 'You are a trading data API. Output only raw JSON. No markdown. No explanation. No text before or after the JSON.',
        messages
      })
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: `API error: ${data.error?.message || 'Unknown'}` }, { status: res.status })
    }

    // When prefilling with { the response text is the continuation AFTER {
    // We need to prepend { so the full JSON is valid
    if (mode !== 'deepdive' && data.content?.[0]?.text) {
      data.content[0].text = '{' + data.content[0].text
    }

    return NextResponse.json(data)

  } catch (err) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 })
  }
}
