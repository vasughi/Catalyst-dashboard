/**
 * CATALYST v2 — src/app/api/claude/route.js
 *
 * Proxies to Anthropic API. Requires ANTHROPIC_API_KEY in Vercel env vars.
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

    // mode: 'json' (default) | 'deepdive' (free text) | 'cio' (full analysis)
    const isJson     = mode !== 'deepdive'
    const systemMap  = {
      json:    'You are a trading data API. Output ONLY raw JSON. No markdown. No explanation. No text before or after the JSON object.',
      deepdive:'You are a senior trading analyst. Be concise, specific and factual. Label each claim FACT, ANALYSIS or OPINION. Under 280 words.',
      cio:     `You are a Chief Investment Officer and master swing trader. Your job is to allocate capital, not summarise markets.

CRITICAL RULES you must follow every time:
1. Every stock you discuss must get an Action: STRONG BUY / BUY / WATCH / AVOID.
2. Every BUY/STRONG BUY must have a SPECIFIC DATED CATALYST within 40 trading days.
3. Apply the GAP-UP PENALTY: if a stock is up >8% today, maximum rating = WATCH unless a second catalyst exists.
4. Apply the POST-CATALYST CHASE RULE: if the primary catalyst already occurred and stock moved >15%, maximum rating = WATCH.
5. Apply the RETURN GATE: prove a credible 15%+ path before recommending BUY.
6. Apply the CASH CHALLENGE: if cash is a better risk/reward than the trade, say so.
7. Use VERIFIED EARNINGS DATES provided in the prompt — do not invent dates.
8. Missing data = INSUFFICIENT EVIDENCE, not a BUY recommendation.
9. Every entry needs: Entry Zone, Stop Loss (max 8% below entry), Take Profit, Risk/Reward ratio.
10. Producing zero BUY recommendations is a valid and correct outcome.

Output format: JSON only. No markdown.`,
    }

    const systemPrompt = systemMap[mode] || systemMap.json

    const messages = [{ role: 'user', content: prompt.trim() }]
    // Prefill assistant with { to force JSON output (not for deepdive/cio free text)
    if (isJson && mode !== 'cio') {
      messages.push({ role: 'assistant', content: '{' })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: mode === 'cio' ? 4000 : mode === 'deepdive' ? 600 : 2000,
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

    // Prepend the { we used for prefilling
    if (isJson && mode !== 'cio' && data.content?.[0]?.text) {
      data.content[0].text = '{' + data.content[0].text
    }

    return NextResponse.json(data)

  } catch (err) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 })
  }
}
