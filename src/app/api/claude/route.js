/**
 * CATALYST — src/app/api/claude/route.js
 *
 * Edge runtime — NO timeout limit (unlike serverless which caps at 10-30s)
 * Streams the response back so the client gets text as it arrives.
 *
 * Models:
 *   cio/deepdive → claude-sonnet-4-6  (best reasoning)
 *   json         → claude-haiku-4-5-20251001  (fast + cheap)
 */

import { NextResponse } from 'next/server'

// Node.js runtime with extended maxDuration
// Edge runtime has a 25s first-byte limit which kills Sonnet (15-20s generation)
// maxDuration=60 gives Sonnet plenty of time
export const dynamic    = 'force-dynamic'
export const maxDuration = 60

const MODELS = {
  cio:      'claude-sonnet-4-6',
  deepdive: 'claude-sonnet-4-6',
  json:     'claude-haiku-4-5-20251001',
}

const TOKENS = {
  cio:      8000,
  deepdive: 900,
  json:     1500,
}

const SYSTEM = {
  cio: `You are a CIO and master swing trader. Output ONLY raw JSON — no markdown, no backticks, no explanation. Start your response with { and end with }.

CRITICAL: Output COMPACT JSON with NO whitespace, NO newlines, NO spaces between keys. Every field must be SHORT — max 12 words per string value. Return exactly 10 opportunity cards.
- Fill all 10 slots: BUY candidates first, then WATCH cards for quality stocks
- ALWAYS include WATCH cards for NVDA, MRVL, AVGO, CRDO even with no near-term earnings
- WATCH cards must still have entry zone, stop loss, and reason to watch

RULES:
1. BUY requires verified earnings date within 45 days AND strong setup
2. GAP-UP >8% today = max WATCH
3. DOWNTREND = max WATCH
4. PULLBACK IN UPTREND = ideal BUY entry
5. Plain English, no jargon`,

  deepdive: `You are a trading analyst writing for beginner investors. Be clear and simple. Label each sentence FACT, ANALYSIS or OPINION. Under 280 words.`,

  json: `Output ONLY raw JSON. No markdown, no backticks, no explanation. Start with {`,
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not set in Vercel environment variables' },
      { status: 500 }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { prompt, mode = 'json' } = body
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
  }

  const model     = MODELS[mode]  || MODELS.json
  const maxTokens = TOKENS[mode]  || 1500
  const system    = SYSTEM[mode]  || SYSTEM.json

  try {
    // Call Anthropic with stream: true
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        stream: true,
        messages: [{ role: 'user', content: prompt.trim() }],
      }),
    })

    if (!anthropicRes.ok) {
      const err = await anthropicRes.json().catch(() => ({}))
      return NextResponse.json(
        { error: `Anthropic API error: ${err.error?.message || anthropicRes.status}` },
        { status: anthropicRes.status }
      )
    }

    // Stream the response text back to the client
    // We collect all text_delta events and return the full text
    const reader  = anthropicRes.body.getReader()
    const decoder = new TextDecoder()
    let fullText  = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      // Parse SSE lines
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const evt = JSON.parse(data)
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            fullText += evt.delta.text
          }
        } catch {}
      }
    }

    // Return as plain text — client handles parsing
    return new Response(fullText, {
      status: 200,
      headers: {
        'Content-Type':  'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })

  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err.message}` },
      { status: 500 }
    )
  }
}
