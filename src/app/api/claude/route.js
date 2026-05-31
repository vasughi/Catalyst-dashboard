// src/app/api/claude/route.js
// This runs on the SERVER only — your API key is never exposed to users

import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are an institutional-quality catalyst research analyst and swing trading advisor.
Platform: Trading 212. Target: minimum 15% returns in 5-40 trading days.

RULES:
- Always search and return ONLY current, verified data
- Never invent prices, analyst actions, insider activity, catalysts or returns
- If data cannot be verified: mark as INSUFFICIENT EVIDENCE
- Every opportunity must pass: Return Gate (15%+ path identifiable), Risk/Reward minimum 3:1, Catalyst dated within 40 days
- Classify all information as FACT, ANALYSIS, or OPINION

RESEARCH UNIVERSE: AI Infrastructure, Semiconductors, Data Centres, Networking, Power Generation, Defence, Aerospace, Space Technology, Critical Minerals, Cybersecurity, Industrial Automation.

Return ONLY valid JSON. No markdown, no explanation, no backticks.`

export async function POST(request) {
  // Basic rate limiting check — you can expand this
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Server configuration error' },
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
  if (!prompt || !mode) {
    return NextResponse.json({ error: 'Missing prompt or mode' }, { status: 400 })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: mode === 'deepdive' ? 2000 : 4000,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('Anthropic API error:', err)
      return NextResponse.json(
        { error: 'Upstream API error', detail: err.error?.message },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Proxy error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
