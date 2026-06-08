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
  t212:     'claude-sonnet-4-6',            // T212 portfolio — Sonnet follows compact JSON instruction reliably
  deepdive: 'claude-opus-4-6',             // Deep dive — narrative quality, Opus only here
  json:     'claude-haiku-4-5-20251001',   // Non-critical: JSON repair only
}

// Cost per run at this config: ~$0.07 vs $0.25 with full Opus
// Sonnet is 5x cheaper than Opus for structured JSON tasks
// Opus reserved for deep dive narrative where quality difference is real
const TOKENS = {
  cio:      6000,   // 10 cards with richer reasoning
  analyser: 2000,   // 1 card — more allocation/sizing detail
  t212:     5000,   // raised: Sonnet may pretty-print; 5000 ensures full portfolio fits
  deepdive: 1800,   // 400-500 words needs more tokens
  json:     600,    // structural only
}

const SYSTEM = {
  // ── Opportunities tab — ranks multiple stocks, returns 10 cards ────────────
  cio: `You are a CIO and master swing trader. Your PRIMARY job is capital protection — a wrong BUY destroys real money. Output ONLY raw JSON — no markdown, no backticks. Start with { and end with }.
CRITICAL: Compact JSON, no whitespace. Max 20 words per string value.
Return exactly 10 opportunity cards. Most should be WATCH. BUY only when ALL gates pass.

HARD STOPS — any one of these = automatic WATCH, no exceptions:
H1. DOWNTREND = below 200 SMA = WATCH. Never BUY below 200 SMA.
H2. GAP-UP >8% today = WATCH. Never chase gaps.
H3. Last earnings MISS + analyst target CUT in last 60 days = WATCH. Both conditions together = disqualified.
H4. Stock down >25% from 52-week high without base-building = WATCH. Falling knives kill accounts.
H5. CALC_STOP:UNAVAILABLE in the stock data = WATCH, no exceptions. If you see CALC_STOP:UNAVAILABLE, you MUST set action to WATCH. This is non-negotiable — buying without a stop is gambling, not trading.
H6. VIX>25 = maximum 1 BUY in the entire 10 cards. All others WATCH. Hard cap.
H7. Sector ETF down >5% today = all stocks in that sector are WATCH unless the individual stock is UP today.

QUALITY GATES — all must pass before BUY:
Q1. Earnings 10-45 days away = prime window. Under 10 days = only if STRONG UPTREND + 4/4 beat history. Over 45 days = needs exceptional momentum.
Q2. R/R minimum 2:1 calculated from real CALC_STOP price, not estimated.
Q3. If last earnings was MISS: require analyst consensus >60% BUY ratings to override. If not, WATCH.
Q4. 15%+ upside path to a real price target.
Q5. VIX 20-25 = maximum 3 BUY cards total. VIX <20 = normal.

TREND CLASSIFICATION (be precise, not generous):
STRONG UPTREND = above 200 SMA + above 50 SMA + within 10% of 52-week high
PULLBACK IN UPTREND = above 200 SMA, pulled back to support, not extended
RECOVERING = above 200 SMA but down 15-25% from recent high = WATCH, not BUY
DOWNTREND = below 200 SMA = never BUY

MACRO FACTORS (from macro context block):
- Iran conflict = defence thesis stronger, but check if the specific stock had recent miss
- Tariff expiry = semis = WATCH regardless of trend
- Rising yields (IEF falling) = growth/tech headwind
- Fed <7 days = tighten all criteria

MANDATORY whatCouldGoWrong field — must name the REAL risk:
- If last earnings was MISS: say "recent EPS miss, repeat risk at next earnings"
- If stock down >20% from highs: say "in extended downtrend from [52wk high]"
- If analyst targets cut: say "analysts cutting targets, sentiment turning"
- Never leave this as a generic phrase. Specific risk or nothing.

When in doubt: WATCH not BUY. There is always another opportunity. There is no recovering from a large loss.

FINAL CHECK before outputting each card: ask yourself — does this stock have CALC_STOP available? If CALC_STOP:UNAVAILABLE, action must be WATCH. Is VIX>25? Max 1 BUY total. Is VIX 20-25? Max 3 BUYs total. Count your BUYs before finalising.`,

  // ── Stock Analyser — single ticker, thorough analysis ─────────────────────
  analyser: `You are a master swing trader and analyst. Output ONLY raw JSON — no markdown, no backticks. Start with {.
CRITICAL: Compact JSON, no whitespace. Use the EXACT live price provided — do not change it.
Analyse this stock on its own merits using ALL data provided:
- Technical trend and SMA levels determine entry quality
- Analyst consensus and recent news determine fundamental direction
- Earnings history determines expected volatility and timing
- VIX, sector context, AND macro context (bonds, oil, geopolitics, tariffs, Fed dates, Trump policy) determine full market backdrop
RULES — apply strictly, capital protection first:
1. STRONG BUY: STRONG UPTREND + excellent entry + earnings <10 days + 4/4 beat history + CALC_STOP available + R/R >3:1
2. BUY: uptrend (above 200 SMA) + good entry + catalyst 10-45 days + last earnings BEAT (or neutral) + R/R >2:1 + CALC_STOP available
3. WATCH: any of — catalyst >45 days, entry extended, VIX>20 with sector weakness, last earnings MISS, CALC_STOP missing, R/R <2:1, stock down >20% from 52-week high
4. AVOID: below 200 SMA, R/R <1:1, recent earnings MISS + guidance cut, analyst targets being cut, fundamental problem
5. LAST EARNINGS MISS = automatic downgrade one level. MISS + guidance cut = AVOID unless exceptional circumstance.
6. CALC_STOP missing = maximum WATCH. Never BUY without a verified stop.
7. Stock down >25% from 52-week high = WATCH minimum. Name this explicitly in whatCouldGoWrong.
8. Analyst target CUT in last 30 days = flag prominently. Reduces conviction one level.
9. Allocation: HIGH conviction BUY = 8-10%. MEDIUM = 5-7%. LOW = 2-4%. WATCH = 0%.
10. Always calculate R/R from real numbers. If CALC_STOP available, use it. If not, use 7% below entry as conservative stop.
11. whatCouldGoWrong must be specific: name the actual risk (recent miss, sector rout, valuation, yield headwind).
12. MACRO OVERLAY: tariff expiry = semis WATCH, Iran active = defence thesis stronger but check earnings quality, Fed <7d = tighten.`,

  // ── T212 portfolio analysis — per-holding recommendations ─────────────────
  t212: `You are a portfolio manager reviewing a real UK Trading 212 account. Output ONLY raw JSON — no markdown, no backticks. Start with {.
For each holding give exactly one action: BUY MORE / HOLD / TRIM / SELL ALL.
Use £ amounts throughout (UK GBP account).
IMPORTANT: Use the MACRO CONTEXT block in the prompt — it has bond yields, oil, geopolitical risks, tariff expiry dates, Fed meeting dates, Trump policy. Factor these into recommendations.

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
10. Reference macro context when relevant — tariffs affect semis, Iran active conflict = defence thesis strengthened, Fed meeting in <14d = don't over-leverage
11. Plain English. Short sentences. Be direct.`,

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
