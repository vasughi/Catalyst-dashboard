/**
 * CATALYST — src/app/api/claude/route.js
 *
 * Edge runtime — NO timeout limit (unlike serverless which caps at 10-30s)
 * Streams the response back so the client gets text as it arrives.
 *
 * Models:
 *   deepdive → claude-opus-4-6       (narrative quality)
 *   cio/analyser → claude-sonnet-4-6  (structured JSON ranking)
 *   t212/json    → claude-haiku       (fast structured output)
 */

import { NextResponse } from 'next/server'

// Node.js runtime with extended maxDuration
// Edge runtime has a 25s first-byte limit which kills Sonnet (15-20s generation)
// maxDuration=60 gives Sonnet plenty of time
export const dynamic    = 'force-dynamic'
export const maxDuration = 60

// Model strategy:
// Opus   → all real intelligence: analysis, ranking, recommendations, deep dives
// Haiku  → non-critical structural tasks only: JSON repair, simple lookups
const MODELS = {
  cio:      'claude-sonnet-4-6',           // Opportunities — Sonnet handles structured JSON ranking well
  analyser: 'claude-sonnet-4-6',           // Stock Analyser — structured output, Sonnet fine
  t212:     'claude-haiku-4-5-20251001',   // T212 portfolio — structured JSON, Haiku sufficient
  deepdive: 'claude-opus-4-6',             // Deep dive — narrative quality, Opus only here
  json:     'claude-haiku-4-5-20251001',   // Non-critical: JSON repair only
}

// Cost per run at this config: ~$0.07 vs $0.25 with full Opus
// Sonnet is 5x cheaper than Opus for structured JSON tasks
// Opus reserved for deep dive narrative where quality difference is real
const TOKENS = {
  cio:      6000,   // 10 cards with richer reasoning
  analyser: 2000,   // 1 card — more allocation/sizing detail
  t212:     3000,   // more holdings context + recovery signals
  deepdive: 1800,   // 400-500 words needs more tokens
  json:     600,    // structural only
}

const SYSTEM = {
  // ── Opportunities tab — ranks multiple stocks, returns 10 cards ────────────
  cio: `You are a CIO and master swing trader. Output ONLY raw JSON — no markdown, no backticks, no explanation. Start with { and end with }.
CRITICAL: Compact JSON, no whitespace. Max 20 words per string value.
Return exactly 10 opportunity cards — the best 10 from the universe provided.

RULES:
1. GAP-UP >8% today = max WATCH — never chase a gap
2. DOWNTREND (below 200 SMA) = max WATCH — never BUY a downtrend
3. PULLBACK IN UPTREND = ideal BUY entry — prioritise these
4. Earnings timing: <10 days = high risk, only if exceptional setup. 10-45 days = prime catalyst window. >45 days = needs strong momentum to justify BUY
5. Minimum 2:1 R/R required for BUY — below that, max WATCH
6. Use CALC_STOP as stop loss. Calculate R/R from real prices. Show your working
7. VIX context: VIX>20 = reduce BUYs, tighten criteria. VIX>25 = only highest-conviction setups get BUY, rest WATCH
8. Sector context: if a sector ETF is down >3% today, downgrade BUY→WATCH for that sector UNLESS stock has specific positive catalyst (earnings beat, upgrade, contract win)
9. Plain English, no jargon. Be direct about risk`,

  // ── Stock Analyser — single ticker, thorough analysis ─────────────────────
  analyser: `You are a master swing trader and analyst. Output ONLY raw JSON — no markdown, no backticks. Start with {.
CRITICAL: Compact JSON, no whitespace. Use the EXACT live price provided — do not change it.
Analyse this stock on its own merits using ALL data provided:
- Technical trend and SMA levels determine entry quality
- Analyst consensus and recent news determine fundamental direction
- Earnings history determines expected volatility and timing
- VIX and sector context determine market backdrop
RULES:
1. BUY: uptrend or pullback in uptrend + good/excellent entry + catalyst within 45 days or strong momentum + minimum 2:1 R/R
2. WATCH: decent setup but entry extended, or catalyst >45 days away, or mixed signals, or VIX>20 with sector weakness
3. AVOID: confirmed downtrend, broken thesis, R/R <1:1, fundamental deterioration
4. Allocation guidance: HIGH conviction BUY = 8-12% of portfolio. MEDIUM = 5-8%. LOW/WATCH = 2-4%
5. Always provide entry zone, stop loss (use SMA200 or recent support), and price target based on earnings history avg move
6. If stock recently sold off on sector news but company thesis intact = note as potential entry opportunity`,

  // ── T212 portfolio analysis — per-holding recommendations ─────────────────
  t212: `You are a portfolio manager reviewing a real UK Trading 212 account. Output ONLY raw JSON — no markdown, no backticks. Start with {.
For each holding give exactly one action: BUY MORE / HOLD / TRIM / SELL ALL.
Use £ amounts throughout (UK GBP account).

RULES:
1. BUY MORE: clear upcoming catalyst, good entry point, company thesis intact, position not oversized. Earnings in 10-30 days with strong history = strong BUY MORE signal
2. HOLD: company thesis intact, no compelling reason to add or reduce. Default action when uncertain
3. TRIM: ONLY if ALL of these: catalyst already fully priced in + stock extended above fair value + no major catalyst in next 30 days. OR position genuinely >25% of portfolio with no near-term catalyst. NEVER trim solely because market/sector is weak — temporary pullbacks are normal
4. SELL ALL: company-specific fundamental problem ONLY — earnings miss WITH guidance cut, fraud, business model broken, competition destroying moat. NOT for sector selloffs
5. DIAGNOSING WEAKNESS — CRITICAL: stock down 10%+ today — ask WHY before acting. Company-specific bad news (own earnings miss, own guidance cut, scandal) = consider SELL ALL. Sector/market selloff with company thesis intact = HOLD or BUY MORE on weakness
6. RECOVERY SIGNAL: stock down 15%+ this week but company fundamentals intact + earnings in <30 days = flag as RECOVERY BUY candidate with reasoning
7. EARNINGS in <10 days = urgent catalyst — if thesis strong, BUY MORE. If uncertain, HOLD and wait for print
8. PORTFOLIO HEALTH: flag if >60% in semis/AI. Flag if free cash <5% of total portfolio value. Suggest rebalancing if needed
9. Position sizing: flag any single position >20% of portfolio as CONCENTRATED — suggest trimming only if no near-term catalyst
10. Pending orders: validate against current thesis — KEEP if still valid, CANCEL if conditions changed
11. Plain English. Short sentences. Be direct. Explain your reasoning briefly`,

  deepdive: `You are a trading analyst writing for beginner investors. Be clear, direct and simple. Label each sentence: (FACT), (ANALYSIS) or (OPINION). 400-500 words. No jargon. Structure: 1) What the company does and why it matters (2-3 sentences). 2) Why the stock is interesting RIGHT NOW — catalyst, setup, recent news. 3) The bull case — what needs to go right. 4) The bear case — what could go wrong, be honest. 5) Your overall take — clear recommendation with reasoning. Never be vague. If you would not buy it, say so.`,

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
