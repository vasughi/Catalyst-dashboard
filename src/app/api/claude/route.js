/**
 * CATALYST — src/app/api/claude/route.js
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

    const systemMap = {
      json: 'You are a trading data API. Output ONLY raw JSON. No markdown, no backticks, no explanation. Start your response with { and end with }.',
      deepdive: 'You are a senior trading analyst. Be concise, specific and factual. Label each claim FACT, ANALYSIS or OPINION. Under 280 words.',
      cio: `You are a CIO and master swing trader. Output ONLY raw JSON — no markdown, no backticks, no explanation. Start your response with { and end with }.

RULES:
1. Every BUY/STRONG BUY must have a VERIFIED DATED CATALYST from the data provided.
2. GAP-UP PENALTY: stock up >8% today → max rating = WATCH.
3. RETURN GATE: must prove credible 15%+ path within 40 trading days.
4. CASH CHALLENGE: justify vs holding cash.
5. Zero BUY recommendations is valid and correct if nothing qualifies.
6. Keep thesis to 1 sentence. Keep stopLoss to price only e.g. "$X".
7. Include WATCH setups for quality names without near-term catalyst (NVDA, MRVL, AVGO, CRDO).
8. Return up to 10 opportunities total — all qualifying BUYs plus top WATCHes.`,
    }

    const systemPrompt = systemMap[mode] || systemMap.json

    // NOTE: Sonnet 4 does NOT support assistant message prefilling.
    // Instead we instruct via system prompt to start with { and use repairJSON on the client.
    const messages = [{ role: 'user', content: prompt.trim() }]

    // Only use prefill for Haiku (json/deepdive modes) — NOT for Sonnet (cio mode)
    if (mode !== 'cio' && mode !== 'deepdive') {
      messages.push({ role: 'assistant', content: '{' })
    }

    const tokenMap = { cio: 8000, deepdive: 800, json: 2000 }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        // Sonnet for CIO analysis — richer reasoning across 44 stocks
        // Haiku for simple JSON transforms — faster and cheaper
        model: mode === 'cio' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001',
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

    // Prepend { for Haiku JSON prefill only
    if (mode !== 'cio' && mode !== 'deepdive' && data.content?.[0]?.text) {
      data.content[0].text = '{' + data.content[0].text
    }

    return NextResponse.json(data)

  } catch (err) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 })
  }
}
