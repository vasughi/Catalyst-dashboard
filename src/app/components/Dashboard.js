'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'

const C = {
  bg: '#060b14',
  panel: '#0e1626',
  card: '#111827',
  border: '#22304a',
  text: '#e5edf7',
  muted: '#8da1bd',
  soft: '#131d30',
  up: '#14d796',
  down: '#ff5a67',
  flat: '#8da1bd',
  accent: '#00d4aa',
  blue: '#4f9eff',
  purple: '#a78bfa',
  amber: '#f59e0b',
  green: '#34d399',
  red: '#f87171',
}

const TABS = {
  opportunities: { label: '🔥 Top Opportunities', color: C.amber },
  global: { label: '🌍 Global Overview', color: C.accent },
  us: { label: '🇺🇸 US Pre-Market', color: C.blue },
  europe: { label: '🇪🇺 Europe Pre-Market', color: C.purple },
  catalysts: { label: '📅 Catalyst Calendar', color: C.green },
  risk: { label: '⚠️ Risk Dashboard', color: C.red },
}

function repairJSON(str) {
  if (!str || typeof str !== 'string') throw new Error('Empty response from AI')

  let s = str.replace(/```json|```/g, '').trim()

  const start = s.indexOf('{')
  if (start === -1) {
    throw new Error(`AI returned text instead of JSON: "${s.slice(0, 120)}"`)
  }

  s = s.slice(start)

  try {
    return JSON.parse(s)
  } catch {}

  const opens = []
  let inStr = false
  let esc = false

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (esc) {
      esc = false
      continue
    }
    if (c === '\\' && inStr) {
      esc = true
      continue
    }
    if (c === '"') {
      inStr = !inStr
      continue
    }
    if (inStr) continue
    if (c === '{') opens.push('}')
    if (c === '[') opens.push(']')
    if (c === '}' || c === ']') opens.pop()
  }

  const fixed = s.replace(/,\s*([}\]])/g, '$1').trimEnd() + opens.reverse().join('')

  try {
    return JSON.parse(fixed)
  } catch {
    throw new Error(`Could not parse AI response. Got: "${s.slice(0, 160)}"`)
  }
}

function fmtTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString()
  } catch {
    return String(iso)
  }
}

function badgeStyle(color, ghost = false) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px',
    borderRadius: 999,
    border: `1px solid ${color}33`,
    background: ghost ? 'transparent' : `${color}14`,
    color,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.2,
  }
}

function shellCardStyle(extra = {}) {
  return {
    background: `linear-gradient(180deg, ${C.panel} 0%, ${C.card} 100%)`,
    border: `1px solid ${C.border}`,
    borderRadius: 18,
    padding: 18,
    boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
    ...extra,
  }
}

function sectionTitleStyle() {
  return {
    margin: 0,
    marginBottom: 16,
    color: C.text,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.82,
  }
}

function miniStat(label, value, tone = 'neutral') {
  const color = tone === 'up' ? C.up : tone === 'down' ? C.down : C.text
  return (
    <div
      key={`${label}-${value}`}
      style={{
        ...shellCardStyle(),
        padding: 14,
        minHeight: 82,
      }}
    >
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>{label}</div>
      <div style={{ color, fontWeight: 800, fontSize: 24 }}>{value}</div>
    </div>
  )
}

function RowDivider() {
  return <div style={{ height: 1, background: `${C.border}`, margin: '14px 0' }} />
}

function LoadingBlock({ label }) {
  return (
    <div style={{ ...shellCardStyle(), minHeight: 200, display: 'grid', placeItems: 'center' }}>
      <div style={{ color: C.muted, fontSize: 15 }}>{label || 'Loading…'}</div>
    </div>
  )
}

function ErrorBlock({ message, onRetry }) {
  return (
    <div style={{ ...shellCardStyle(), borderColor: `${C.red}66` }}>
      <div style={{ color: C.red, fontWeight: 700, marginBottom: 8 }}>Load failed</div>
      <div style={{ color: C.text, marginBottom: 14, whiteSpace: 'pre-wrap' }}>{message}</div>
      <button onClick={onRetry} style={buttonStyle(C.red)}>
        Retry
      </button>
    </div>
  )
}

function buttonStyle(color, subtle = false) {
  return {
    appearance: 'none',
    border: `1px solid ${color}${subtle ? '33' : '66'}`,
    background: subtle ? 'transparent' : `${color}18`,
    color,
    borderRadius: 12,
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  }
}

function MetaBar({ meta, lastUpdated }) {
  if (!meta && !lastUpdated) return null

  return (
    <div
      style={{
        ...shellCardStyle(),
        marginBottom: 18,
        padding: 14,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={badgeStyle(C.accent)}>Source: {meta?.provider || 'claude-only'}</span>
        {meta?.fallbackUsed ? <span style={badgeStyle(C.amber)}>Fallback used</span> : null}
        {meta?.partial ? <span style={badgeStyle(C.red)}>Partial data</span> : null}
      </div>

      <div style={{ color: C.muted, fontSize: 13 }}>
        Updated: <span style={{ color: C.text }}>{fmtTime(lastUpdated || meta?.fetchedAt)}</span>
      </div>

      {meta?.warnings?.length ? (
        <div style={{ width: '100%', marginTop: 8, color: C.amber, fontSize: 13, lineHeight: 1.45 }}>
          {meta.warnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function OpportunityCard({ opp, active, onClick }) {
  const actionColor =
    opp.action === 'STRONG BUY'
      ? C.up
      : opp.action === 'BUY'
      ? C.accent
      : C.amber

  return (
    <button
      onClick={() => onClick(opp)}
      style={{
        ...shellCardStyle(),
        textAlign: 'left',
        cursor: 'pointer',
        borderColor: active ? `${C.accent}AA` : C.border,
        background: active
          ? `linear-gradient(180deg, rgba(0,212,170,0.12) 0%, ${C.card} 100%)`
          : `linear-gradient(180deg, ${C.panel} 0%, ${C.card} 100%)`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.text }}>{opp.ticker}</div>
          <div style={{ color: C.muted }}>{opp.company || '—'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...badgeStyle(actionColor), justifyContent: 'center' }}>{opp.action || 'WATCH'}</div>
          <div style={{ color: C.text, marginTop: 10, fontWeight: 800, fontSize: 22 }}>
            {opp.currentPrice || '—'}
          </div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{opp.expectedGain || ''}</div>
        </div>
      </div>

      <RowDivider />

      <div style={{ color: C.text, lineHeight: 1.55, marginBottom: 14 }}>{opp.thesis || 'No thesis returned.'}</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <div>
          <div style={{ color: C.muted, fontSize: 12 }}>Catalyst</div>
          <div style={{ color: C.text }}>{opp.catalyst || '—'}</div>
        </div>
        <div>
          <div style={{ color: C.muted, fontSize: 12 }}>Catalyst date</div>
          <div style={{ color: C.text }}>{opp.catalystDate || '—'}</div>
        </div>
        <div>
          <div style={{ color: C.muted, fontSize: 12 }}>Entry zone</div>
          <div style={{ color: C.text }}>{opp.entryZone || '—'}</div>
        </div>
        <div>
          <div style={{ color: C.muted, fontSize: 12 }}>Risk / reward</div>
          <div style={{ color: C.text }}>{opp.riskReward || '—'}</div>
        </div>
      </div>
    </button>
  )
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('opportunities')
  const [sectionData, setSectionData] = useState({})
  const [loadStep, setLoadStep] = useState({})
  const [errors, setErrors] = useState({})
  const [selectedStock, setSelectedStock] = useState(null)
  const [drillContent, setDrillContent] = useState(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState({})

  const callClaude = useCallback(async (prompt, mode = 'section') => {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, mode }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Claude error ${res.status}`)
    const tb = data.content?.find((b) => b.type === 'text')
    if (!tb) throw new Error('No response from AI')
    return tb.text
  }, [])

  const fetchMarket = useCallback(async (type) => {
    const res = await fetch(`/api/market?type=${type}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Market data error ${res.status}`)
    return data
  }, [])

  const setDone = useCallback((key) => {
    setLoadStep((p) => ({ ...p, [key]: -1 }))
  }, [])

  const loadGlobal = useCallback(async () => {
    setLoadStep((p) => ({ ...p, global: 0 }))
    setErrors((p) => ({ ...p, global: null }))

    try {
      const market = await fetchMarket('global')
      setLoadStep((p) => ({ ...p, global: 1 }))

      const summary = `Real market data right now:
Markets: ${market.markets?.map((m) => `${m.name} ${m.value} (${m.change})`).join(', ')}
Commodities: ${market.commodities?.map((c) => `${c.name} ${c.value} (${c.change})`).join(', ')}
FX: ${market.currencies?.map((c) => `${c.pair} ${c.value} ${c.change}`).join(', ')}
Bonds: ${market.bonds?.map((b) => `${b.name} ${b.yield} ${b.change}`).join(', ')}
Provider: ${market.meta?.provider || 'unknown'}
Fallback used: ${market.meta?.fallbackUsed ? 'yes' : 'no'}
Partial data: ${market.meta?.partial ? 'yes' : 'no'}

Based only on the real data above, return JSON:
{"sentiment":"RISK ON/OFF/NEUTRAL","sentimentReason":"one sentence","macroEvents":[{"date":"this week","event":"key event","impact":"HIGH/MEDIUM/LOW"}]}
Keep it concise. JSON only.`

      const aiText = await callClaude(summary)
      const ai = repairJSON(aiText)

      setSectionData((p) => ({
        ...p,
        global: { ...market, ...ai },
      }))

      setLastUpdated((p) => ({
        ...p,
        global: market.meta?.fetchedAt || new Date().toISOString(),
      }))
    } catch (err) {
      setErrors((p) => ({ ...p, global: err.message }))
    } finally {
      setDone('global')
    }
  }, [fetchMarket, callClaude, setDone])

  const loadUS = useCallback(async () => {
    setLoadStep((p) => ({ ...p, us: 0 }))
    setErrors((p) => ({ ...p, us: null }))

    try {
      const market = await fetchMarket('us')
      setLoadStep((p) => ({ ...p, us: 1 }))

      const summary = `Real US market data:
Futures: ${market.futures?.map((f) => `${f.index} ${f.value} (${f.change})`).join(', ')}
Top gainers: ${market.gainers?.map((g) => `${g.ticker} ${g.change}`).join(', ')}
Top losers: ${market.losers?.map((l) => `${l.ticker} ${l.change}`).join(', ')}
Provider: ${market.meta?.provider || 'unknown'}
Fallback used: ${market.meta?.fallbackUsed ? 'yes' : 'no'}
Partial data: ${market.meta?.partial ? 'yes' : 'no'}

Based only on the real data above, return JSON:
{"outlook":"BULLISH/BEARISH/NEUTRAL","outlookReason":"one sentence","earningsThisWeek":[{"ticker":"","company":"","date":"","expectedReaction":""}],"catalysts":[{"type":"","detail":"","impact":"HIGH/MEDIUM/LOW"}],"sectorLeaders":[],"sectorLaggards":[]}
List 3 earnings this week and 2 catalysts. Keep it concise. JSON only.`

      const aiText = await callClaude(summary)
      const ai = repairJSON(aiText)

      setSectionData((p) => ({
        ...p,
        us: { ...market, ...ai },
      }))

      setLastUpdated((p) => ({
        ...p,
        us: market.meta?.fetchedAt || new Date().toISOString(),
      }))
    } catch (err) {
      setErrors((p) => ({ ...p, us: err.message }))
    } finally {
      setDone('us')
    }
  }, [fetchMarket, callClaude, setDone])

  const loadEurope = useCallback(async () => {
    setLoadStep((p) => ({ ...p, europe: 0 }))
    setErrors((p) => ({ ...p, europe: null }))

    try {
      const market = await fetchMarket('europe')
      setLoadStep((p) => ({ ...p, europe: 1 }))

      const summary = `Real European market data:
Indices: ${market.futures?.map((f) => `${f.index} ${f.value} (${f.change})`).join(', ')}
Provider: ${market.meta?.provider || 'unknown'}
Fallback used: ${market.meta?.fallbackUsed ? 'yes' : 'no'}
Partial data: ${market.meta?.partial ? 'yes' : 'no'}

Based only on the real data above, return JSON:
{"outlook":"BULLISH/BEARISH/NEUTRAL","outlookReason":"one sentence","earningsThisWeek":[{"ticker":"","company":"","date":"","expectedReaction":""}],"catalysts":[{"type":"","detail":"","impact":"HIGH/MEDIUM/LOW"}]}
List 2 European earnings this week and 2 catalysts. Keep it concise. JSON only.`

      const aiText = await callClaude(summary)
      const ai = repairJSON(aiText)

      setSectionData((p) => ({
        ...p,
        europe: { ...market, ...ai },
      }))

      setLastUpdated((p) => ({
        ...p,
        europe: market.meta?.fetchedAt || new Date().toISOString(),
      }))
    } catch (err) {
      setErrors((p) => ({ ...p, europe: err.message }))
    } finally {
      setDone('europe')
    }
  }, [fetchMarket, callClaude, setDone])

  const loadOpportunities = useCallback(async () => {
    setLoadStep((p) => ({ ...p, opportunities: 0 }))
    setErrors((p) => ({ ...p, opportunities: null }))

    try {
      const market = await fetchMarket('opportunities')
      setLoadStep((p) => ({ ...p, opportunities: 1 }))

      const stockList = market.stocks
        ?.map((s) => `${s.ticker}: ${s.price} (${s.change1d} today, mktcap ${s.marketCap})`)
        .join('\n')

      const prompt = `Today's live prices from the research universe:
${stockList}

Provider: ${market.meta?.provider || 'unknown'}
Fallback used: ${market.meta?.fallbackUsed ? 'yes' : 'no'}
Partial data: ${market.meta?.partial ? 'yes' : 'no'}
Today's date: ${new Date().toDateString()}

Based only on these real current prices plus your own knowledge of upcoming earnings, contracts, product launches and catalysts, identify the top 3 stocks with the strongest catalyst setup for 15%+ gains in the next 40 days.

Return JSON only:
{"marketCondition":"BUY AGGRESSIVELY/BUY SELECTIVELY/WAIT/HOLD CASH","cashRecommendation":"","opportunities":[{"ticker":"","company":"","action":"STRONG BUY/BUY/WATCH","currentPrice":"use real price above","entryZone":"","stopLoss":"","takeProfit":"","expectedGain":"","confidence":7,"riskLevel":"LOW/MEDIUM/HIGH","catalyst":"specific named catalyst","catalystDate":"","riskReward":"3:1","allocation":"10%","buyNow":"YES/NO/WAIT","thesis":"1-2 sentences based on real price","invalidation":"what would change the thesis"}]}`

      const aiText = await callClaude(prompt)
      const ai = repairJSON(aiText)

      const stockMap = Object.fromEntries((market.stocks || []).map((s) => [s.ticker, s]))

      const groundedOpportunities = (ai.opportunities || []).map((opp) => {
        const live = stockMap[opp.ticker] || {}
        return {
          ...opp,
          company: live.name || opp.company || opp.ticker,
          currentPrice: live.price || opp.currentPrice || 'N/A',
          liveChange1d: live.change1d || null,
          liveMarketCap: live.marketCap || null,
          sourceTimestamp: live.sourceTimestamp || null,
          provider: live.provider || market.meta?.provider || null,
        }
      })

      setSectionData((p) => ({
        ...p,
        opportunities: {
          ...ai,
          opportunities: groundedOpportunities,
          meta: market.meta,
          liveStocks: market.stocks,
        },
      }))

      setLastUpdated((p) => ({
        ...p,
        opportunities: market.meta?.fetchedAt || new Date().toISOString(),
      }))

      if (groundedOpportunities[0]) {
        setSelectedStock(groundedOpportunities[0])
      }
    } catch (err) {
      setErrors((p) => ({ ...p, opportunities: err.message }))
    } finally {
      setDone('opportunities')
    }
  }, [fetchMarket, callClaude, setDone])

  const loadCatalysts = useCallback(async () => {
    setLoadStep((p) => ({ ...p, catalysts: 1 }))
    setErrors((p) => ({ ...p, catalysts: null }))

    try {
      const prompt = `Today is ${new Date().toDateString()}.
List 6 specific upcoming market catalysts in the next 40 days that swing traders should watch.
Focus on AI, semiconductors, defence and energy.
Return JSON only:
{"catalysts":[{"date":"exact date","ticker":"","company":"","type":"Earnings/Contract/Product Launch/Policy/M&A/Government","detail":"specific detail","expectedImpact":"HIGH/MEDIUM/LOW","opportunity":"BUY BEFORE/WATCH/AVOID"}]}`

      const aiText = await callClaude(prompt)
      const ai = repairJSON(aiText)

      setSectionData((p) => ({ ...p, catalysts: ai }))
      setLastUpdated((p) => ({ ...p, catalysts: new Date().toISOString() }))
    } catch (err) {
      setErrors((p) => ({ ...p, catalysts: err.message }))
    } finally {
      setDone('catalysts')
    }
  }, [callClaude, setDone])

  const loadRisk = useCallback(async () => {
    setLoadStep((p) => ({ ...p, risk: 1 }))
    setErrors((p) => ({ ...p, risk: null }))

    try {
      const prompt = `Today is ${new Date().toDateString()}.
Assess current market risks for a swing trader.
Return JSON only:
{"overallRisk":"HIGH/ELEVATED/MODERATE/LOW","macroRisks":[{"risk":"","detail":"","severity":"HIGH/MEDIUM/LOW"}],"geopoliticalRisks":[{"risk":"","detail":"","severity":"HIGH/MEDIUM/LOW"}],"sectorRisks":[{"sector":"","risk":"","severity":"HIGH/MEDIUM/LOW"}],"hedgeIdeas":[""]}`

      const aiText = await callClaude(prompt)
      const ai = repairJSON(aiText)

      setSectionData((p) => ({ ...p, risk: ai }))
      setLastUpdated((p) => ({ ...p, risk: new Date().toISOString() }))
    } catch (err) {
      setErrors((p) => ({ ...p, risk: err.message }))
    } finally {
      setDone('risk')
    }
  }, [callClaude, setDone])

  const loaders = useMemo(
    () => ({
      global: loadGlobal,
      us: loadUS,
      europe: loadEurope,
      opportunities: loadOpportunities,
      catalysts: loadCatalysts,
      risk: loadRisk,
    }),
    [loadGlobal, loadUS, loadEurope, loadOpportunities, loadCatalysts, loadRisk]
  )

  const fetchDeepDive = useCallback(
    async (opp) => {
      setDrillLoading(true)
      setDrillContent(null)
      try {
        const text = await callClaude(
          `Today is ${new Date().toDateString()}.
Analyse ${opp.ticker} (${opp.company}) currently priced at ${opp.currentPrice}.
Cover: recent news, upcoming catalyst (${opp.catalyst}), analyst consensus, key risks, technical setup.
Under 220 words.
Mark each point FACT or ANALYSIS.`,
          'deepdive'
        )
        setDrillContent(text)
      } catch (err) {
        setDrillContent(`Error: ${err.message}`)
      } finally {
        setDrillLoading(false)
      }
    },
    [callClaude]
  )

  const handleStockClick = useCallback(
    (opp) => {
      setSelectedStock(opp)
      setDrillContent(null)
      fetchDeepDive(opp)
    },
    [fetchDeepDive]
  )

  const refreshActive = useCallback(() => {
    loaders[activeTab]?.()
  }, [activeTab, loaders])

  const isLoading = useCallback(
    (key) => loadStep[key] === 0 || loadStep[key] === 1,
    [loadStep]
  )

  useEffect(() => {
    if (!sectionData[activeTab] && !isLoading(activeTab) && !errors[activeTab]) {
      loaders[activeTab]?.()
    }
  }, [activeTab, sectionData, isLoading, errors, loaders])

  function sourceBarFor(tabKey) {
    const data = sectionData[tabKey]
    return <MetaBar meta={data?.meta} lastUpdated={lastUpdated[tabKey]} />
  }

  function renderGlobal() {
    const data = sectionData.global
    if (!data) return null

    return (
      <>
        {sourceBarFor('global')}

        <div style={{ ...shellCardStyle(), marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}>
            <div style={badgeStyle(data.sentiment === 'RISK ON' ? C.up : data.sentiment === 'RISK OFF' ? C.down : C.flat)}>
              {data.sentiment || 'NEUTRAL'}
            </div>
            <div style={{ color: C.text, lineHeight: 1.5, flex: 1 }}>
              {data.sentimentReason || 'No AI summary returned.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 18 }}>
          {(data.markets || []).slice(0, 8).map((m) =>
            miniStat(m.name, `${m.value} (${m.change})`, m.direction === 'up' ? 'up' : m.direction === 'down' ? 'down' : 'neutral')
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          <div style={shellCardStyle()}>
            <h3 style={sectionTitleStyle()}>Macro events this week</h3>
            {(data.macroEvents || []).length ? (
              data.macroEvents.map((e, i) => (
                <div key={i}>
                  <div style={{ color: C.text, fontWeight: 700 }}>{e.event}</div>
                  <div style={{ color: C.muted, marginTop: 4 }}>
                    {e.date} · {e.impact}
                  </div>
                  {i < data.macroEvents.length - 1 ? <RowDivider /> : null}
                </div>
              ))
            ) : (
              <div style={{ color: C.muted }}>No macro events returned.</div>
            )}
          </div>

          <div style={shellCardStyle()}>
            <h3 style={sectionTitleStyle()}>Cross-asset snapshot</h3>
            <div style={{ color: C.muted, fontSize: 13, marginBottom: 10 }}>Commodities</div>
            {(data.commodities || []).map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: C.text, marginBottom: 8 }}>
                <span>{c.name}</span>
                <span>{c.value} ({c.change})</span>
              </div>
            ))}
            <RowDivider />
            <div style={{ color: C.muted, fontSize: 13, marginBottom: 10 }}>FX</div>
            {(data.currencies || []).map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: C.text, marginBottom: 8 }}>
                <span>{c.pair}</span>
                <span>{c.value} ({c.change})</span>
              </div>
            ))}
            <RowDivider />
            <div style={{ color: C.muted, fontSize: 13, marginBottom: 10 }}>Bonds</div>
            {(data.bonds || []).map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: C.text }}>
                <span>{b.name}</span>
                <span>{b.yield} ({b.change})</span>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  function renderUS() {
    const data = sectionData.us
    if (!data) return null

    return (
      <>
        {sourceBarFor('us')}

        <div style={{ ...shellCardStyle(), marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}>
            <div style={badgeStyle(data.outlook === 'BULLISH' ? C.up : data.outlook === 'BEARISH' ? C.down : C.flat)}>
              {data.outlook || 'NEUTRAL'}
            </div>
            <div style={{ color: C.text, lineHeight: 1.5, flex: 1 }}>
              {data.outlookReason || 'No AI outlook returned.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
          {(data.futures || []).map((f, i) =>
            miniStat(f.index, `${f.value} (${f.change})`, f.direction === 'up' ? 'up' : f.direction === 'down' ? 'down' : 'neutral')
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          <div style={shellCardStyle()}>
            <h3 style={sectionTitleStyle()}>Top gainers today</h3>
            {(data.gainers || []).length ? (
              data.gainers.map((g, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ color: C.text, fontWeight: 800 }}>{g.ticker}</div>
                      <div style={{ color: C.muted }}>{g.company}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: C.up, fontWeight: 800 }}>{g.change}</div>
                      <div style={{ color: C.muted }}>{g.price}</div>
                    </div>
                  </div>
                  {i < data.gainers.length - 1 ? <RowDivider /> : null}
                </div>
              ))
            ) : (
              <div style={{ color: C.muted }}>No gainers returned.</div>
            )}
          </div>

          <div style={shellCardStyle()}>
            <h3 style={sectionTitleStyle()}>Top losers today</h3>
            {(data.losers || []).length ? (
              data.losers.map((g, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ color: C.text, fontWeight: 800 }}>{g.ticker}</div>
                      <div style={{ color: C.muted }}>{g.company}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: C.down, fontWeight: 800 }}>{g.change}</div>
                      <div style={{ color: C.muted }}>{g.price}</div>
                    </div>
                  </div>
                  {i < data.losers.length - 1 ? <RowDivider /> : null}
                </div>
              ))
            ) : (
              <div style={{ color: C.muted }}>No losers returned.</div>
            )}
          </div>

          <div style={shellCardStyle()}>
            <h3 style={sectionTitleStyle()}>Earnings this week</h3>
            {(data.earningsThisWeek || []).length ? (
              data.earningsThisWeek.map((e, i) => (
                <div key={i}>
                  <div style={{ color: C.text, fontWeight: 800 }}>
                    {e.ticker} {e.company ? `· ${e.company}` : ''}
                  </div>
                  <div style={{ color: C.muted, marginTop: 4 }}>{e.date}</div>
                  <div style={{ color: C.text, marginTop: 8 }}>{e.expectedReaction}</div>
                  {i < data.earningsThisWeek.length - 1 ? <RowDivider /> : null}
                </div>
              ))
            ) : (
              <div style={{ color: C.muted }}>No earnings returned.</div>
            )}
          </div>

          <div style={shellCardStyle()}>
            <h3 style={sectionTitleStyle()}>Catalysts</h3>
            {(data.catalysts || []).length ? (
              data.catalysts.map((c, i) => (
                <div key={i}>
                  <div style={{ color: C.text, fontWeight: 700 }}>{c.type}</div>
                  <div style={{ color: C.text, marginTop: 6 }}>{c.detail}</div>
                  <div style={{ color: C.muted, marginTop: 6 }}>{c.impact}</div>
                  {i < data.catalysts.length - 1 ? <RowDivider /> : null}
                </div>
              ))
            ) : (
              <div style={{ color: C.muted }}>No catalysts returned.</div>
            )}
          </div>
        </div>
      </>
    )
  }

  function renderEurope() {
    const data = sectionData.europe
    if (!data) return null

    return (
      <>
        {sourceBarFor('europe')}

        <div style={{ ...shellCardStyle(), marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}>
            <div style={badgeStyle(data.outlook === 'BULLISH' ? C.up : data.outlook === 'BEARISH' ? C.down : C.flat)}>
              {data.outlook || 'NEUTRAL'}
            </div>
            <div style={{ color: C.text, lineHeight: 1.5, flex: 1 }}>
              {data.outlookReason || 'No AI outlook returned.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
          {(data.futures || []).map((f, i) =>
            miniStat(f.index, `${f.value} (${f.change})`, f.direction === 'up' ? 'up' : f.direction === 'down' ? 'down' : 'neutral')
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          <div style={shellCardStyle()}>
            <h3 style={sectionTitleStyle()}>European earnings this week</h3>
            {(data.earningsThisWeek || []).length ? (
              data.earningsThisWeek.map((e, i) => (
                <div key={i}>
                  <div style={{ color: C.text, fontWeight: 800 }}>
                    {e.ticker} {e.company ? `· ${e.company}` : ''}
                  </div>
                  <div style={{ color: C.muted, marginTop: 4 }}>{e.date}</div>
                  <div style={{ color: C.text, marginTop: 8 }}>{e.expectedReaction}</div>
                  {i < data.earningsThisWeek.length - 1 ? <RowDivider /> : null}
                </div>
              ))
            ) : (
              <div style={{ color: C.muted }}>No earnings returned.</div>
            )}
          </div>

          <div style={shellCardStyle()}>
            <h3 style={sectionTitleStyle()}>Catalysts</h3>
            {(data.catalysts || []).length ? (
              data.catalysts.map((c, i) => (
                <div key={i}>
                  <div style={{ color: C.text, fontWeight: 700 }}>{c.type}</div>
                  <div style={{ color: C.text, marginTop: 6 }}>{c.detail}</div>
                  <div style={{ color: C.muted, marginTop: 6 }}>{c.impact}</div>
                  {i < data.catalysts.length - 1 ? <RowDivider /> : null}
                </div>
              ))
            ) : (
              <div style={{ color: C.muted }}>No catalysts returned.</div>
            )}
          </div>
        </div>
      </>
    )
  }

  function renderOpportunities() {
    const data = sectionData.opportunities
    if (!data) return null

    const opps = data.opportunities || []

    return (
      <>
        {sourceBarFor('opportunities')}

        <div style={{ ...shellCardStyle(), marginBottom: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={badgeStyle(C.amber)}>{data.marketCondition || 'WAIT'}</div>
            <div style={{ color: C.text, flex: 1 }}>{data.cashRecommendation || ''}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.9fr)', gap: 18 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            {opps.length ? (
              opps.map((opp, i) => (
                <OpportunityCard
                  key={`${opp.ticker}-${i}`}
                  opp={opp}
                  active={selectedStock?.ticker === opp.ticker}
                  onClick={handleStockClick}
                />
              ))
            ) : (
              <div style={shellCardStyle()}>
                <div style={{ color: C.muted }}>No opportunities returned.</div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
            <div style={shellCardStyle()}>
              <h3 style={sectionTitleStyle()}>Selected setup</h3>
              {selectedStock ? (
                <>
                  <div style={{ fontSize: 28, fontWeight: 900, color: C.text }}>{selectedStock.ticker}</div>
                  <div style={{ color: C.muted, marginTop: 4 }}>{selectedStock.company}</div>

                  <RowDivider />

                  <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                      <div style={{ color: C.muted, fontSize: 12 }}>Live price</div>
                      <div style={{ color: C.text, fontWeight: 800, fontSize: 24 }}>{selectedStock.currentPrice || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: C.muted, fontSize: 12 }}>Catalyst</div>
                      <div style={{ color: C.text }}>{selectedStock.catalyst || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: C.muted, fontSize: 12 }}>Invalidation</div>
                      <div style={{ color: C.text }}>{selectedStock.invalidation || '—'}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ color: C.muted }}>Select an opportunity.</div>
              )}
            </div>

            <div style={shellCardStyle()}>
              <h3 style={sectionTitleStyle()}>Deep dive analysis</h3>
              {selectedStock ? (
                <>
                  {drillLoading ? (
                    <div style={{ color: C.muted }}>Analysing {selectedStock.ticker}…</div>
                  ) : drillContent ? (
                    <div style={{ color: C.text, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{drillContent}</div>
                  ) : (
                    <button onClick={() => fetchDeepDive(selectedStock)} style={buttonStyle(C.accent)}>
                      Run deep dive
                    </button>
                  )}
                </>
              ) : (
                <div style={{ color: C.muted }}>Select a stock to analyse.</div>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  function renderCatalysts() {
    const data = sectionData.catalysts
    if (!data) return null

    return (
      <>
        <MetaBar lastUpdated={lastUpdated.catalysts} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {(data.catalysts || []).length ? (
            data.catalysts.map((c, i) => (
              <div key={i} style={shellCardStyle()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ ...badgeStyle(C.green) }}>{c.type || 'Catalyst'}</div>
                  <div style={{ color: C.muted }}>{c.date || '—'}</div>
                </div>
                <div style={{ marginTop: 14, color: C.text, fontWeight: 800 }}>
                  {c.ticker} {c.company ? `· ${c.company}` : ''}
                </div>
                <div style={{ marginTop: 10, color: C.text, lineHeight: 1.55 }}>{c.detail}</div>
                <div style={{ marginTop: 12, color: C.muted }}>
                  Impact: {c.expectedImpact || '—'} · Opportunity: {c.opportunity || '—'}
                </div>
              </div>
            ))
          ) : (
            <div style={shellCardStyle()}>
              <div style={{ color: C.muted }}>No catalysts returned.</div>
            </div>
          )}
        </div>
      </>
    )
  }

  function renderRisk() {
    const data = sectionData.risk
    if (!data) return null

    const overallColor =
      data.overallRisk === 'LOW'
        ? C.up
        : data.overallRisk === 'MODERATE'
        ? C.amber
        : C.red

    return (
      <>
        <MetaBar lastUpdated={lastUpdated.risk} />

        <div style={{ ...shellCardStyle(), marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
            <div style={badgeStyle(overallColor)}>{data.overallRisk || 'MODERATE'}</div>
            <div style={{ color: C.text }}>Current overall swing-trading risk assessment.</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          <div style={shellCardStyle()}>
            <h3 style={sectionTitleStyle()}>Macro risks</h3>
            {(data.macroRisks || []).length ? (
              data.macroRisks.map((r, i) => (
                <div key={i}>
                  <div style={{ color: C.text, fontWeight: 800 }}>{r.risk}</div>
                  <div style={{ color: C.text, marginTop: 6 }}>{r.detail}</div>
                  <div style={{ color: C.muted, marginTop: 6 }}>{r.severity}</div>
                  {i < data.macroRisks.length - 1 ? <RowDivider /> : null}
                </div>
              ))
            ) : (
              <div style={{ color: C.muted }}>No macro risks returned.</div>
            )}
          </div>

          <div style={shellCardStyle()}>
            <h3 style={sectionTitleStyle()}>Geopolitical risks</h3>
            {(data.geopoliticalRisks || []).length ? (
              data.geopoliticalRisks.map((r, i) => (
                <div key={i}>
                  <div style={{ color: C.text, fontWeight: 800 }}>{r.risk}</div>
                  <div style={{ color: C.text, marginTop: 6 }}>{r.detail}</div>
                  <div style={{ color: C.muted, marginTop: 6 }}>{r.severity}</div>
                  {i < data.geopoliticalRisks.length - 1 ? <RowDivider /> : null}
                </div>
              ))
            ) : (
              <div style={{ color: C.muted }}>No geopolitical risks returned.</div>
            )}
          </div>

          <div style={shellCardStyle()}>
            <h3 style={sectionTitleStyle()}>Sector risks</h3>
            {(data.sectorRisks || []).length ? (
              data.sectorRisks.map((r, i) => (
                <div key={i}>
                  <div style={{ color: C.text, fontWeight: 800 }}>{r.sector}</div>
                  <div style={{ color: C.text, marginTop: 6 }}>{r.risk}</div>
                  <div style={{ color: C.muted, marginTop: 6 }}>{r.severity}</div>
                  {i < data.sectorRisks.length - 1 ? <RowDivider /> : null}
                </div>
              ))
            ) : (
              <div style={{ color: C.muted }}>No sector risks returned.</div>
            )}
          </div>

          <div style={shellCardStyle()}>
            <h3 style={sectionTitleStyle()}>Hedge ideas</h3>
            {(data.hedgeIdeas || []).length ? (
              <ul style={{ margin: 0, paddingLeft: 18, color: C.text, lineHeight: 1.8 }}>
                {data.hedgeIdeas.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            ) : (
              <div style={{ color: C.muted }}>No hedge ideas returned.</div>
            )}
          </div>
        </div>
      </>
    )
  }

  function renderContent() {
    const key = activeTab
    const err = errors[key]

    if (isLoading(key)) {
      return <LoadingBlock label={loadStep[key] === 0 ? 'Fetching market data…' : 'Analysing with Claude…'} />
    }

    if (err) {
      return <ErrorBlock message={err} onRetry={() => loaders[key]?.()} />
    }

    if (!sectionData[key]) {
      return <LoadingBlock label="Loading…" />
    }

    if (key === 'global') return renderGlobal()
    if (key === 'us') return renderUS()
    if (key === 'europe') return renderEurope()
    if (key === 'opportunities') return renderOpportunities()
    if (key === 'catalysts') return renderCatalysts()
    if (key === 'risk') return renderRisk()

    return null
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${C.bg} 0%, #07101f 100%)`,
        color: C.text,
        padding: 24,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            ...shellCardStyle(),
            marginBottom: 18,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 18,
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ color: C.accent, fontWeight: 900, fontSize: 28, letterSpacing: 0.6 }}>
              CATALYST
            </div>
            <div style={{ color: C.muted, marginTop: 5 }}>Trading intelligence · live data</div>
          </div>

          <button onClick={refreshActive} style={buttonStyle(C.accent)}>
            ↻ Refresh
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 18,
          }}
        >
          {Object.entries(TABS).map(([key, tab]) => {
            const active = activeTab === key
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  appearance: 'none',
                  border: `1px solid ${active ? `${tab.color}99` : C.border}`,
                  background: active ? `${tab.color}16` : 'transparent',
                  color: active ? tab.color : C.text,
                  borderRadius: 14,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {renderContent()}
      </div>
    </div>
  )
}
