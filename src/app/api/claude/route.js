import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are an institutional-quality catalyst research analyst and swing trading advisor.
Platform: Trading 212. Target: minimum 15% returns in 5-40 trading days.
RULES:
- Return ONLY current verified data
- Never invent prices, analyst actions, insider activity, catalysts or returns
- If data cannot be verified mark as INSUFFICIENT EVIDENCE
- Every opportunity must pass: 15%+ upside path, Risk/Reward minimum 3:1, Catalyst within 40 days
- Classify all information as FACT, ANALYSIS, or OPINION
RESEARCH UNIVERSE: AI Infrastructure, Semiconductors, Data Centres, Networking, Power Generation, Defence, Aerospace, Space Technology, Critical Minerals, Cybersecurity, Industrial Automation.
Return ONLY valid JSON. No markdown. No backticks. No explanation.`

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set in environment variables' },
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

  // Try with web search first, fall back without if not available
  const makeRequest = async (useWebSearch) => {
    const requestBody = {
      model: 'claude-sonnet-4-6',
      max_tokens: mode === 'deepdive' ? 2000 : 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }

    if (useWebSearch) {
      headers['anthropic-beta'] = 'web-search-2025-03-05'
      requestBody.tools = [{ type: 'web_search_20250305', name: 'web_search' }]
    }

    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })
  }

  try {
    // First attempt: with web search
    let response = await makeRequest(true)
    let data = await response.json()

    // If web search fails, retry without it
    if (!response.ok && (data.error?.type === 'invalid_request_error' || response.status === 400)) {
      console.log('Web search not available, retrying without...')
      response = await makeRequest(false)
      data = await response.json()
    }

    if (!response.ok) {
      console.error('Anthropic API error:', JSON.stringify(data))
      return NextResponse.json(
        {
          error: `Anthropic API error: ${data.error?.message || 'Unknown error'}`,
          type: data.error?.type,
          status: response.status
        },
        { status: response.status }
      )
    }

    return NextResponse.json(data)

  } catch (err) {
    console.error('Server error:', err)
    return NextResponse.json(
      { error: `Server error: ${err.message}` },
      { status: 500 }
    )
  }
}
