import { NextResponse } from 'next/server'

const PROMPTS = {
  opportunities: `Today is ${new Date().toDateString()}. Search the web for real current stock market data. Find 3-5 swing trade opportunities RIGHT NOW with genuine 15%+ upside potential in 5-40 days. Use actual current prices and real upcoming catalysts. Return ONLY this JSON structure with real data:
{"marketCondition":"BUY SELECTIVELY","opportunities":[{"rank":1,"ticker":"REAL_TICKER","company":"Real Company Name","action":"BUY","currentPrice":"$XXX","entryZone":"$XXX-XXX","stopLoss":"$XXX","takeProfit":"$XXX","expectedGain":"XX%","confidence":7,"riskLevel":"MEDIUM","catalyst":"Specific real catalyst","catalystDate":"Real date","riskReward":"3:1","allocation":"10%","buyNow":"YES","thesis":"Real thesis based on current data","invalidation":"What would invalidate this"}],"cashRecommendation":"Keep X% cash","lastUpdated":"${new Date().toLocaleDateString()}"}`,

  global: `Today is ${new Date().toDateString()}. Search the web for CURRENT real market prices right now. Return ONLY this JSON with actual current values:
{"sentiment":"RISK ON","sentimentReason":"Real current reason","markets":[{"name":"S&P 500 Futures","value":"REAL_VALUE","change":"REAL_%","direction":"up"},{"name":"NASDAQ Futures","value":"REAL","change":"REAL_%","direction":"up"},{"name":"FTSE 100","value":"REAL","change":"REAL_%","direction":"up"},{"name":"DAX","value":"REAL","change":"REAL_%","direction":"up"},{"name":"Nikkei","value":"REAL","change":"REAL_%","direction":"up"},{"name":"Hang Seng","value":"REAL","change":"REAL_%","direction":"down"}],"commodities":[{"name":"Oil WTI","value":"REAL","change":"REAL_%","direction":"down"},{"name":"Gold","value":"REAL","change":"REAL_%","direction":"up"},{"name":"Copper","value":"REAL","change":"REAL_%","direction":"up"}],"currencies":[{"pair":"DXY","value":"REAL","change":"REAL_%"},{"pair":"GBP/USD","value":"REAL","change":"REAL_%"},{"pair":"EUR/USD","value":"REAL","change":"REAL_%"}],"bonds":[{"name":"US 10Y","yield":"REAL%","change":"REALbps"},{"name":"UK 10Y","yield":"REAL%","change":"REALbps"}],"macroEvents":[{"date":"Real date","event":"Real upcoming event","impact":"HIGH"}],"lastUpdated":"${new Date().toLocaleDateString()}"}`,

  us: `Today is ${new Date().toDateString()}. Search the web for real current US pre-market data. Return ONLY this JSON with actual live values:
{"outlook":"BULLISH","outlookReason":"Real current reason","futures":[{"index":"S&P 500","value":"REAL","change":"REAL%","direction":"up"},{"index":"NASDAQ","value":"REAL","change":"REAL%","direction":"up"},{"index":"Dow","value":"REAL","change":"REAL%","direction":"up"},{"index":"Russell 2000","value":"REAL","change":"REAL%","direction":"up"}],"preMarketMovers":[{"ticker":"REAL","company":"Real name","change":"REAL%","direction":"up","reason":"Real reason from news today"}],"earningsThisWeek":[{"ticker":"REAL","company":"Real name","date":"Real day","consensus":"Real EPS estimate","expectedReaction":"Realistic reaction"}],"catalysts":[{"type":"Real type","detail":"Real current catalyst","impact":"HIGH"}],"sectorLeaders":["Real sector"],"sectorLaggards":["Real sector"],"lastUpdated":"${new Date().toLocaleDateString()}"}`,

  europe: `Today is ${new Date().toDateString()}. Search the web for real current European pre-market data. Return ONLY this JSON with actual live values:
{"outlook":"NEUTRAL","outlookReason":"Real current reason","futures":[{"index":"FTSE 100","value":"REAL","change":"REAL%","direction":"up"},{"index":"DAX","value":"REAL","change":"REAL%","direction":"up"},{"index":"CAC 40","value":"REAL","change":"REAL%","direction":"up"},{"index":"STOXX 600","value":"REAL","change":"REAL%","direction":"up"}],"preMarketMovers":[{"ticker":"REAL","company":"Real company","change":"REAL%","direction":"up","reason":"Real news reason"}],"earningsThisWeek":[{"ticker":"REAL","company":"Real name","date":"Real day","expectedReaction":"Realistic"}],"catalysts":[{"type":"Real","detail":"Real European catalyst today","impact":"HIGH"}],"sectorLeaders":["Real"],"sectorLaggards":["Real"],"lastUpdated":"${new Date().toLocaleDateString()}"}`,

  catalysts: `Today is ${new Date().toDateString()}. Search the web for REAL upcoming catalysts in the next 40 days for swing traders. Focus on AI, semiconductors, defence, cybersecurity stocks. Return ONLY this JSON:
{"catalysts":[{"date":"Real date","ticker":"REAL","company":"Real name","type":"Earnings","detail":"Real specific detail","expectedImpact":"HIGH","opportunity":"BUY BEFORE"}],"lastUpdated":"${new Date().toLocaleDateString()}"}`,

  risk: `Today is ${new Date().toDateString()}. Search the web for current real market risks. Return ONLY this JSON:
{"overallRisk":"MODERATE","macroRisks":[{"risk":"Real current risk","detail":"Real detail from current news","severity":"HIGH"}],"geopoliticalRisks":[{"risk":"Real current geopolitical risk","detail":"Real detail","severity":"MEDIUM"}],"sectorRisks":[{"sector":"Real sector","risk":"Real current risk","severity":"MEDIUM"}],"hedgeIdeas":["Real hedge idea based on current conditions"],"lastUpdated":"${new Date().toLocaleDateString()}"}`
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { mode, sectionKey } = body

  if (!mode) {
    return NextResponse.json({ error: 'Missing mode' }, { status: 400 })
  }

  const isDeepDive = mode === 'deepdive'
  const prompt = isDeepDive ? body.prompt : (PROMPTS[sectionKey] || body.prompt)

  if (!prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
  }

  const systemPrompt = isDeepDive
    ? 'You are a trading analyst. Search for current real data. Be concise and factual. Mark each point as FACT or ANALYSIS.'
    : 'You are a trading analyst with web search. Search for real current market data. Return ONLY valid JSON matching the exact structure requested. No markdown. No backticks. No extra text. Replace all placeholder values like REAL_VALUE or REAL with actual current data you find.'

  // Try with web search first
  const tryRequest = async (useWebSearch) => {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
    const reqBody = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: isDeepDive ? 600 : 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    }
    if (useWebSearch) {
      headers['anthropic-beta'] = 'web-search-2025-03-05'
      reqBody.tools = [{ type: 'web_search_20250305', name: 'web_search' }]
    }
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody)
    })
  }

  try {
    let response = await tryRequest(true)
    let data = await response.json()

    // Fall back to no web search if beta not available
    if (!response.ok && response.status === 400) {
      response = await tryRequest(false)
      data = await response.json()
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `API error: ${data.error?.message || 'Unknown error'}` },
        { status: response.status }
      )
    }

    return NextResponse.json(data)

  } catch (err) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 })
  }
}
