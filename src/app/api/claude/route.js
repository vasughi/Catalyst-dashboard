/**
 * CATALYST v2 — src/app/api/claude/route.js
 */

import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not set. Add it in Vercel → Settings → Environment Variables.' },
        { status: 500 }
      )
    }

    const text = await request.text()
    if (!text?.trim()) return NextResponse.json({ error: 'Empty request body' }, { status: 400 })

    let body
    try { body = JSON.parse(text) }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

    const { prompt, mode } = body
    if (!prompt?.trim()) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })

    const isJson = mode !== 'deepdive'

    const systemMap = {
      json: 'You are a trading data API. Output ONLY raw JSON. No markdown. No explanation. No text before or after the JSON object.',
      deepdive: 'You are a senior trading analyst. Be concise, specific and factual. Label each claim FACT, ANALYSIS or OPINION. Under 280 words.',
      cio: `You are a CIO and master swing trader. Output ONLY raw JSON — no markdown, no explanation, no text outside the JSON.

RULES:
1. Every BUY/STRONG BUY must have a VERIFIED DATED CATALYST from the data provided.
2. GAP-UP PENALTY: stock up >8% today → max rating = WATCH.
3. RETURN GATE: must prove credible 15%+ path.
4. CASH CHALLENGE: justify vs holding cash.
5. Zero BUY recommendations is valid if nothing qualifies.
6. Keep thesis to 1 sentence. Keep stopLoss to price only e.g. "$X".
7. Return MAXIMUM 5 opportunities total to keep response short.`,
    }

    const systemPrompt = systemMap[mode] || systemMap.json

    const messages = [{ role: 'user', content: prompt.trim() }]
    // Prefill { for all JSON modes to force valid JSON output
    if (isJson) {
      messages.push({ role: 'assistant', content: '{' })
    }

    const tokenMap = { cio: 6000, deepdive: 700, json: 2000 }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',  // Haiku is faster + cheaper for JSON generation
        max_tokens: tokenMap[mode] || 2000,
        system: systemPrompt,
        messages,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { error: `Anthropic API error: ${data.error?.message || 'Unknown'}` },
        { status: res.status }
      )
    }

    // Prepend the { prefill
    if (isJson && data.content?.[0]?.text) {
      data.content[0].text = '{' + data.content[0].text
    }

    return NextResponse.json(data)

  } catch (err) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 })
  }
}
