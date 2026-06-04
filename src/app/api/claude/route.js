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
  cio:      'claude-sonnet-4-6',  // Opportunities tab — multi-stock ranking
  analyser: 'claude-sonnet-4-6',  // Stock Analyser — single ticker deep analysis
  t212:     'claude-sonnet-4-6',  // T212 portfolio analysis
  deepdive: 'claude-sonnet-4-6',  // Deep dive narrative
  json:     'claude-haiku-4-5-20251001',  // Fast structured JSON
}

const TOKENS = {
  cio:      8000,   // 10 cards across many stocks
  analyser: 2000,   // 1 card for single ticker — much less needed
  t212:     6000,   // 34 positions × ~50 tokens each = ~1700 + prompt = ~4000 needed   // holdings array — moderate size
  deepdive: 900,
  json:     1500,
}

const SYSTEM = {
  // ── Opportunities tab — ranks multiple stocks, returns 10 cards ────────────
  cio: `You are a CIO and master swing trader. Output ONLY raw JSON — no markdown, no backticks, no explanation. Start your response with { and end with }.
CRITICAL: Compact JSON, no whitespace. Max 10 words per string value.
Start JSON with opportunities array FIRST, then header fields.
Return exactly 10 opportunity cards — the best 10 from the universe provided.
RULES:
1. GAP-UP >8% today = max WATCH
2. DOWNTREND (below 200 SMA) = max WATCH — never BUY a downtrend
3. PULLBACK IN UPTREND = ideal BUY entry — prioritise these
4. Earnings 10-45 days away = prime BUY window
5. Plain English, no jargon`,

  // ── Stock Analyser — single ticker, thorough analysis ─────────────────────
  analyser: `You are a master swing trader and analyst. You are given data for ONE specific stock and must give a thorough, honest assessment. Output ONLY raw JSON — no markdown, no backticks, no explanation. Start with {.
CRITICAL: Compact JSON, no whitespace. Use the EXACT live price provided — do not change it.
Analyse this stock on its own merits using all the data provided:
- Technical trend and SMA levels determine entry quality
- Analyst consensus and recent news determine fundamental direction
- Earnings history determines expected volatility
- VIX and sector context determine market backdrop
RULES:
1. BUY: uptrend + good/excellent entry + catalyst or strong momentum
2. WATCH: decent setup but extended, or no near-term catalyst, or mixed signals
3. AVOID: downtrend, broken thesis, post-gap, fundamental problem
4. DOWNTREND (below 200 SMA) = AVOID or WATCH — never BUY
5. PULLBACK IN UPTREND = best entry — prioritise for BUY
6. If earnings within 30 days: weight this heavily as catalyst
7. R/R must be at least 2:1 to recommend BUY
8. Be honest — if data is insufficient, say WATCH not BUY
9. Plain English only. Write for a beginner. Short sentences.`,

  // ── T212 portfolio analysis — per-holding recommendations ─────────────────
  t212: `You are a portfolio manager reviewing a real UK Trading 212 account. Output ONLY raw JSON — no markdown, no backticks. Start with {.
For each holding give exactly one action: BUY MORE / HOLD / TRIM / SELL ALL.
Use £ amounts throughout (UK GBP account).
RULES:
1. BUY MORE: only if clear catalyst, good entry, thesis intact
2. HOLD: thesis intact, no compelling reason to add or reduce
3. TRIM: up 30%+ with catalyst priced in, or position too concentrated
4. SELL ALL: thesis broken, fundamental problem, or capital better elsewhere
5. Consider portfolio balance — is cash allocation appropriate?
6. Validate pending orders: KEEP if still valid, CANCEL if no longer makes sense
7. Plain English. Short sentences. Be direct.`,

  deepdive: `You are a trading analyst writing for beginner investors. Be clear and simple. Label each sentence (FACT), (ANALYSIS) or (OPINION). Under 280 words. No jargon.`,

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
