'use client'

import { useState, useCallback } from 'react'

const SECTIONS = {
  opportunities: {
    label: '🔥 Top Opportunities',
    color: '#f59e0b',
    prompt: `Find 3-5 swing trade opportunities with 15%+ upside in 5-40 days. Return JSON only:
{"marketCondition":"BUY SELECTIVELY","opportunities":[{"rank":1,"ticker":"NVDA","company":"Nvidia","action":"BUY","currentPrice":"$950","entryZone":"$940-960","stopLoss":"$870","takeProfit":"$1100","expectedGain":"16%","confidence":7,"riskLevel":"MEDIUM","catalyst":"Earnings beat expected","catalystDate":"May 2025","riskReward":"3:1","allocation":"10%","buyNow":"YES","thesis":"Strong AI demand driving revenue growth","invalidation":"Earnings miss or guidance cut"}],"cashRecommendation":"Keep 40% cash","lastUpdated":"today"}`
  },
  global: {
    label: '🌍 Global Overview',
    color: '#00d4aa',
    prompt: `Give current global market snapshot. Return JSON only:
{"sentiment":"RISK ON","sentimentReason":"Markets rising on strong earnings","markets":[{"name":"S&P 500","value":"5,200","change":"+0.5%","direction":"up"},{"name":"NASDAQ","value":"16,400","change":"+0.8%","direction":"up"},{"name":"FTSE 100","value":"8,100","change":"+0.3%","direction":"up"},{"name":"DAX","value":"18,200","change":"+0.4%","direction":"up"},{"name":"Nikkei","value":"38,000","change":"-0.2%","direction":"down"}],"commodities":[{"name":"Oil WTI","value":"$78","change":"-0.5%","direction":"down"},{"name":"Gold","value":"$2,320","change":"+0.3%","direction":"up"}],"currencies":[{"pair":"DXY","value":"104.5","change":"-0.1%"},{"pair":"GBP/USD","value":"1.27","change":"+0.2%"}],"bonds":[{"name":"US 10Y","yield":"4.45%","change":"+2bps"}],"macroEvents":[{"date":"This week","event":"Fed meeting minutes","impact":"HIGH"}],"lastUpdated":"today"}`
  },
  us: {
    label: '🇺🇸 US Pre-Market',
    color: '#4f9eff',
    prompt: `Give US pre-market summary. Return JSON only:
{"outlook":"BULLISH","outlookReason":"Futures up on strong earnings","futures":[{"index":"S&P 500","value":"5,210","change":"+0.4%","direction":"up"},{"index":"NASDAQ","value":"16,450","change":"+0.6%","direction":"up"},{"index":"Dow","value":"39,100","change":"+0.2%","direction":"up"}],"preMarketMovers":[{"ticker":"NVDA","company":"Nvidia","change":"+3.2%","direction":"up","reason":"Strong earnings beat"},{"ticker":"AAPL","company":"Apple","change":"-1.1%","direction":"down","reason":"iPhone sales concern"}],"earningsThisWeek":[{"ticker":"MSFT","company":"Microsoft","date":"Wednesday","consensus":"$2.82 EPS","expectedReaction":"+5% if beat"}],"catalysts":[{"type":"Fed","detail":"FOMC minutes release","impact":"HIGH"}],"sectorLeaders":["Technology","Energy"],"sectorLaggards":["Utilities","Real Estate"],"lastUpdated":"today"}`
  },
  europe: {
    label: '🇪🇺 Europe Pre-Market',
    color: '#a78bfa',
    prompt: `Give Europe pre-market summary. Return JSON only:
{"outlook":"NEUTRAL","outlookReason":"Mixed signals from ECB","futures":[{"index":"FTSE 100","value":"8,120","change":"+0.2%","direction":"up"},{"index":"DAX","value":"18,250","change":"+0.3%","direction":"up"},{"index":"CAC 40","value":"8,050","change":"-0.1%","direction":"down"}],"preMarketMovers":[{"ticker":"ASML","company":"ASML Holding","change":"+2.1%","direction":"up","reason":"Strong order book"}],"earningsThisWeek":[{"ticker":"SAP","company":"SAP SE","date":"Tuesday","expectedReaction":"+3% if beat"}],"catalysts":[{"type":"ECB","detail":"ECB rate decision","impact":"HIGH"}],"sectorLeaders":["Semiconductors","Defence"],"sectorLaggards":["Banks","Retail"],"lastUpdated":"today"}`
  },
  catalysts: {
    label: '📅 Catalyst Calendar',
    color: '#34d399',
    prompt: `List key upcoming catalysts for swing traders. Return JSON only:
{"catalysts":[{"date":"This week","ticker":"NVDA","company":"Nvidia","type":"Earnings","detail":"Q1 earnings - consensus $5.50 EPS","expectedImpact":"HIGH","opportunity":"BUY BEFORE"},{"date":"This week","ticker":"MSFT","company":"Microsoft","type":"Earnings","detail":"Q3 earnings - Azure growth key","expectedImpact":"HIGH","opportunity":"WATCH"},{"date":"Next week","ticker":"AMD","company":"AMD","type":"Product Launch","detail":"New AI chip announcement","expectedImpact":"MEDIUM","opportunity":"BUY BEFORE"}],"lastUpdated":"today"}`
  },
  risk: {
    label: '⚠️ Risk Dashboard',
    color: '#f87171',
    prompt: `Give current market risk assessment. Return JSON only:
{"overallRisk":"MODERATE","macroRisks":[{"risk":"Fed rate uncertainty","detail":"Higher for longer narrative returning","severity":"HIGH"},{"risk":"Inflation sticky","detail":"CPI above 3% target","severity":"MEDIUM"}],"geopoliticalRisks":[{"risk":"Middle East tensions","detail":"Oil supply risk","severity":"MEDIUM"}],"sectorRisks":[{"sector":"Technology","risk":"High valuations","severity":"MEDIUM"},{"sector":"Banks","risk":"Commercial real estate exposure","severity":"HIGH"}],"hedgeIdeas":["Buy gold ETF as hedge","Reduce tech concentration","Keep 30%+ cash"],"lastUpdated":"today"}`
  }
}

const C = {
  bg: '#0a0e17', card: '#111827', border: '#1f2937',
  text: '#e2e8f0', muted: '#6b7280',
  up: '#10b981', down: '#ef4444', flat: '#6b7280', accent: '#00d4aa'
}

function Badge({ children, color }) {
  return (
    <span style={{
      background: color + '22', color, border: `1px solid ${color}55`,
      borderRadius: 4, padding: '2px 8px', fontSize: 11,
      fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap'
    }}>{children}</span>
  )
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: 20, ...style
    }}>{children}</div>
  )
}

function SectionHeader({ title }) {
  return <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>{title}</div>
}

function Divider({ index, total }) {
  return index < total - 1 ? <div style={{ borderBottom: `1px solid ${C.border}` }} /> : null
}

function LoadingState({ color }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 36, marginBottom: 12, display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</div>
      <div style={{ color, fontWeight: 600, marginBottom: 6 }}>Generating analysis…</div>
      <div style={{ color: C.muted, fontSize: 13 }}>Usually takes 5–10 seconds</div>
    </div>
  )
}

function ErrorState({ error, onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <div style={{ color: C.down, fontWeight: 600, marginBottom: 8 }}>Could not fetch data</div>
      <div style={{ color: C.muted, fontSize: 13, marginBottom: 20, maxWidth: 500, margin: '0 auto 20px' }}>{error}</div>
      <button onClick={onRetry} style={{
        background: C.down + '22', border: `1px solid ${C.down}55`, color: C.down,
        borderRadius: 6, padding: '8px 20px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit'
      }}>Try Again</button>
    </div>
  )
}

function EmptyState({ section, onLoad }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: 44, marginBottom: 16 }}>{section.label.split(' ')[0]}</div>
      <div style={{ color: C.text, fontWeight: 600, marginBottom: 8, fontSize: 16 }}>{section.label.replace(/^.\s/, '')}</div>
      <div style={{ color: C.muted, fontSize: 14, marginBottom: 28 }}>Click below to generate analysis</div>
      <button onClick={onLoad} style={{
        background: section.color + '22', border: `1px solid ${section.color}`,
        color: section.color, borderRadius: 8, padding: '12px 32px',
        cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit'
      }}>⟳ Load {section.label}</button>
    </div>
  )
}

function RefreshBtn({ onClick, loading }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      background: loading ? '#1f2937' : C.accent + '22',
      border: `1px solid ${C.accent}55`,
      color: loading ? C.muted : C.accent,
      borderRadius: 6, padding: '6px 14px', cursor: loading ? 'not-allowed' : 'pointer',
      fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit'
    }}>
      <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
      {loading ? 'Generating…' : 'Refresh'}
    </button>
  )
}

function GlobalView({ data }) {
  const sc = data.sentiment === 'RISK ON' ? C.up : data.sentiment === 'RISK OFF' ? C.down : C.flat
  const dir = d => d === 'up' ? C.up : d === 'down' ? C.down : C.flat
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge color={sc}>{data.sentiment}</Badge>
          <span style={{ color: C.muted, fontSize: 13 }}>{data.sentimentReason}</span>
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {[{ title: 'Equity Markets', items: data.markets }, { title: 'Commodities', items: data.commodities }].map(g => g.items?.length > 0 && (
          <Card key={g.title}>
            <SectionHeader title={g.title} />
            {g.items.map((it, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}>
                  <span style={{ color: C.text, fontSize: 13 }}>{it.name}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{it.value}</div>
                    <div style={{ color: dir(it.direction), fontSize: 11 }}>{it.change}</div>
                  </div>
                </div>
                <Divider index={i} total={g.items.length} />
              </div>
            ))}
          </Card>
        ))}
        <Card>
          <SectionHeader title="Currencies & Bonds" />
          {[...(data.currencies || []).map(c => ({ label: c.pair, value: c.value, sub: c.change })),
            ...(data.bonds || []).map(b => ({ label: b.name, value: b.yield, sub: b.change }))
          ].map((r, i, arr) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}>
                <span style={{ color: C.muted, fontSize: 12 }}>{r.label}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: C.text, fontWeight: 600, fontSize: 12 }}>{r.value}</span>
                  <span style={{ color: C.muted, fontSize: 11, marginLeft: 6 }}>{r.sub}</span>
                </div>
              </div>
              <Divider index={i} total={arr.length} />
            </div>
          ))}
        </Card>
      </div>
      {data.macroEvents?.length > 0 && (
        <Card>
          <SectionHeader title="Key Events This Week" />
          {data.macroEvents.map((e, i) => {
            const ic = e.impact === 'HIGH' ? C.down : e.impact === 'MEDIUM' ? '#f59e0b' : C.muted
            return (
              <div key={i}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
                  <span style={{ color: C.accent, fontSize: 12, minWidth: 90 }}>{e.date}</span>
                  <span style={{ color: C.text, fontSize: 13, flex: 1 }}>{e.event}</span>
                  <Badge color={ic}>{e.impact}</Badge>
                </div>
                <Divider index={i} total={data.macroEvents.length} />
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}

function MarketView({ data }) {
  const oc = data.outlook === 'BULLISH' ? C.up : data.outlook === 'BEARISH' ? C.down : C.flat
  const dir = d => d === 'up' ? C.up : d === 'down' ? C.down : C.flat
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge color={oc}>{data.outlook}</Badge>
          <span style={{ color: C.muted, fontSize: 13 }}>{data.outlookReason}</span>
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        <Card>
          <SectionHeader title="Futures" />
          {(data.futures || []).map((f, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}>
                <span style={{ color: C.text, fontSize: 13 }}>{f.index}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{f.value}</div>
                  <div style={{ color: dir(f.direction), fontSize: 11 }}>{f.change}</div>
                </div>
              </div>
              <Divider index={i} total={data.futures.length} />
            </div>
          ))}
        </Card>
        <Card>
          <SectionHeader title="Pre-Market Movers" />
          {(data.preMarketMovers || []).map((m, i) => (
            <div key={i}>
              <div style={{ padding: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{m.ticker}</span>
                  <span style={{ color: m.direction === 'up' ? C.up : C.down, fontWeight: 700 }}>{m.change}</span>
                </div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{m.reason}</div>
              </div>
              <Divider index={i} total={data.preMarketMovers.length} />
            </div>
          ))}
        </Card>
        <Card>
          <SectionHeader title="Earnings This Week" />
          {(data.earningsThisWeek || []).map((e, i) => (
            <div key={i}>
              <div style={{ padding: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{e.ticker}</span>
                  <span style={{ color: C.accent, fontSize: 12 }}>{e.date}</span>
                </div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{e.expectedReaction}</div>
              </div>
              <Divider index={i} total={data.earningsThisWeek.length} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

function OpportunityCard({ opp, onClick }) {
  const ac = opp.action === 'STRONG BUY' ? C.up : opp.action === 'BUY' ? '#4f9eff' : '#f59e0b'
  const rc = opp.riskLevel === 'HIGH' ? C.down : opp.riskLevel === 'MEDIUM' ? '#f59e0b' : C.up
  const bnc = opp.buyNow === 'YES' ? C.up : opp.buyNow === 'WAIT' ? '#f59e0b' : C.down
  return (
    <div onClick={() => onClick(opp)}
      onMouseEnter={e => e.currentTarget.style.background = '#1a2332'}
      onMouseLeave={e => e.currentTarget.style.background = C.card}
      style={{ background: C.card, border: `1px solid ${ac}33`, borderLeft: `3px solid ${ac}`, borderRadius: 10, padding: 18, cursor: 'pointer', transition: 'background 0.15s', position: 'relative' }}>
      <span style={{ position: 'absolute', top: 14, right: 14, color: C.muted, fontSize: 11 }}>Click for deep dive →</span>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <span style={{ color: C.muted, fontSize: 12, fontWeight: 700 }}>#{opp.rank}</span>
        <span style={{ color: C.text, fontWeight: 800, fontSize: 17 }}>{opp.ticker}</span>
        <span style={{ color: C.muted, fontSize: 12 }}>{opp.company}</span>
        <Badge color={ac}>{opp.action}</Badge>
        <Badge color={rc}>{opp.riskLevel} RISK</Badge>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Expected Gain', value: opp.expectedGain, color: C.up },
          { label: 'Confidence', value: `${opp.confidence}/10`, color: C.accent },
          { label: 'Risk/Reward', value: opp.riskReward, color: '#4f9eff' },
          { label: 'Buy Now?', value: opp.buyNow, color: bnc },
        ].map(s => (
          <div key={s.label} style={{ background: '#0a0e17', borderRadius: 6, padding: 10, textAlign: 'center' }}>
            <div style={{ color: C.muted, fontSize: 10, marginBottom: 3 }}>{s.label}</div>
            <div style={{ color: s.color, fontWeight: 700, fontSize: 13 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: C.accent }}>Catalyst: </span>{opp.catalyst}
        {opp.catalystDate && <span> · {opp.catalystDate}</span>}
      </div>
      <div style={{ color: C.text, fontSize: 12, lineHeight: 1.6 }}>{opp.thesis}</div>
    </div>
  )
}

function OpportunitiesView({ data, onStockClick }) {
  const mc = { 'BUY AGGRESSIVELY': C.up, 'BUY SELECTIVELY': '#4f9eff', WAIT: '#f59e0b', 'HOLD CASH': C.down }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>MARKET CONDITION</div>
            <Badge color={mc[data.marketCondition] || C.muted}>{data.marketCondition}</Badge>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>OPPORTUNITIES</div>
            <div style={{ color: C.accent, fontWeight: 800, fontSize: 28 }}>{(data.opportunities || []).length}</div>
          </div>
          <div style={{ maxWidth: 280 }}>
            <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>CASH RECOMMENDATION</div>
            <div style={{ color: C.text, fontSize: 13 }}>{data.cashRecommendation}</div>
          </div>
        </div>
      </Card>
      {(data.opportunities || []).length === 0
        ? <Card style={{ textAlign: 'center', padding: 40 }}><div style={{ color: '#f59e0b' }}>No opportunities passed all gates today. Consider holding cash.</div></Card>
        : (data.opportunities || []).map(opp => <OpportunityCard key={opp.rank} opp={opp} onClick={onStockClick} />)
      }
    </div>
  )
}

function CatalystsView({ data }) {
  const typeColor = { Earnings: '#4f9eff', Contract: C.up, 'Product Launch': '#a78bfa', Policy: '#f59e0b', 'M&A': C.accent, Government: '#f87171', Other: C.muted }
  return (
    <Card style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>{['Date', 'Ticker', 'Company', 'Type', 'Detail', 'Impact', 'Opportunity'].map(h => (
            <th key={h} style={{ color: C.muted, fontWeight: 600, fontSize: 11, textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${C.border}`, textTransform: 'uppercase' }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {(data.catalysts || []).map((c, i) => {
            const ic = c.expectedImpact === 'HIGH' ? C.down : c.expectedImpact === 'MEDIUM' ? '#f59e0b' : C.muted
            const oc = c.opportunity === 'BUY BEFORE' ? C.up : c.opportunity === 'WATCH' ? '#f59e0b' : C.muted
            return (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '10px 12px', color: C.accent, fontWeight: 600, whiteSpace: 'nowrap' }}>{c.date}</td>
                <td style={{ padding: '10px 12px', color: C.text, fontWeight: 700 }}>{c.ticker}</td>
                <td style={{ padding: '10px 12px', color: C.muted }}>{c.company}</td>
                <td style={{ padding: '10px 12px' }}><Badge color={typeColor[c.type] || C.muted}>{c.type}</Badge></td>
                <td style={{ padding: '10px 12px', color: C.text, maxWidth: 200 }}>{c.detail}</td>
                <td style={{ padding: '10px 12px' }}><Badge color={ic}>{c.expectedImpact}</Badge></td>
                <td style={{ padding: '10px 12px' }}><Badge color={oc}>{c.opportunity}</Badge></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

function RiskView({ data }) {
  const oc = { HIGH: C.down, ELEVATED: '#f59e0b', MODERATE: '#4f9eff', LOW: C.up }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>OVERALL RISK</div>
        <Badge color={oc[data.overallRisk] || C.muted}>{data.overallRisk}</Badge>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {[{ title: 'Macro Risks', items: data.macroRisks }, { title: 'Geopolitical Risks', items: data.geopoliticalRisks }, { title: 'Sector Risks', items: data.sectorRisks }]
          .filter(g => g.items?.length > 0).map(g => (
            <Card key={g.title}>
              <SectionHeader title={g.title} />
              {g.items.map((it, i) => {
                const sc = it.severity === 'HIGH' ? C.down : it.severity === 'MEDIUM' ? '#f59e0b' : C.muted
                return (
                  <div key={i}>
                    <div style={{ padding: '8px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{it.risk || it.sector}</span>
                        <Badge color={sc}>{it.severity}</Badge>
                      </div>
                      <div style={{ color: C.muted, fontSize: 12 }}>{it.detail || it.risk}</div>
                    </div>
                    <Divider index={i} total={g.items.length} />
                  </div>
                )
              })}
            </Card>
          ))}
      </div>
      {data.hedgeIdeas?.length > 0 && (
        <Card>
          <SectionHeader title="Hedge Ideas" />
          {data.hedgeIdeas.map((h, i) => (
            <div key={i} style={{ padding: '5px 0', color: C.text, fontSize: 13, borderBottom: i < data.hedgeIdeas.length - 1 ? `1px solid ${C.border}` : 'none' }}>· {h}</div>
          ))}
        </Card>
      )}
    </div>
  )
}

function DeepDiveModal({ opp, onClose, onRefresh, loading, content }) {
  const ac = opp.action === 'STRONG BUY' ? C.up : '#4f9eff'
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, width: '100%', maxWidth: 820, maxHeight: '90vh', overflow: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ color: C.text, fontWeight: 800, fontSize: 22 }}>{opp.ticker}</span>
            <span style={{ color: C.muted, fontSize: 14 }}>{opp.company}</span>
            <Badge color={ac}>{opp.action}</Badge>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Entry Zone', value: opp.entryZone, color: C.text },
            { label: 'Stop Loss', value: opp.stopLoss, color: C.down },
            { label: 'Take Profit', value: opp.takeProfit, color: C.up },
            { label: 'Allocation', value: opp.allocation, color: C.accent },
            { label: 'Risk/Reward', value: opp.riskReward, color: '#4f9eff' },
            { label: 'Confidence', value: `${opp.confidence}/10`, color: C.accent },
          ].map(s => (
            <div key={s.label} style={{ background: '#0a0e17', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              <div style={{ color: C.muted, fontSize: 10, marginBottom: 3 }}>{s.label}</div>
              <div style={{ color: s.color, fontWeight: 700, fontSize: 14 }}>{s.value}</div>
            </div>
          ))}
        </div>
        <Card style={{ marginBottom: 12 }}>
          <SectionHeader title="Investment Thesis" />
          <div style={{ color: C.text, fontSize: 14, lineHeight: 1.7 }}>{opp.thesis}</div>
        </Card>
        <Card style={{ marginBottom: 12 }}>
          <SectionHeader title="Catalyst" />
          <div style={{ color: C.accent, fontSize: 14, fontWeight: 600 }}>{opp.catalyst}</div>
          {opp.catalystDate && <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Expected: {opp.catalystDate}</div>}
        </Card>
        <Card style={{ marginBottom: 16, borderColor: C.down + '44' }}>
          <SectionHeader title="⚠ What Would Change My Mind" />
          <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>{opp.invalidation}</div>
        </Card>
        {loading ? <LoadingState color={C.accent} /> : content && (
          <Card>
            <SectionHeader title="Deep Dive Analysis" />
            <div style={{ color: C.text, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{content}</div>
          </Card>
        )}
        {!loading && <div style={{ marginTop: 16 }}><RefreshBtn onClick={onRefresh} loading={loading} /></div>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('opportunities')
  const [sectionData, setSectionData] = useState({})
  const [loading, setLoading] = useState({})
  const [errors, setErrors] = useState({})
  const [selectedStock, setSelectedStock] = useState(null)
  const [drillContent, setDrillContent] = useState(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState({})

  const callAPI = useCallback(async (prompt, mode = 'section') => {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, mode })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    return data
  }, [])

  const fetchSection = useCallback(async (key) => {
    setLoading(p => ({ ...p, [key]: true }))
    setErrors(p => ({ ...p, [key]: null }))
    try {
      const data = await callAPI(SECTIONS[key].prompt, 'section')
      const textBlock = data.content?.find(b => b.type === 'text')
      if (!textBlock) throw new Error('No response from AI')
      const clean = textBlock.text.replace(/```json|```/g, '').trim()
      let parsed
      try { parsed = JSON.parse(clean) }
      catch {
        const match = clean.match(/\{[\s\S]*\}/)
        if (match) parsed = JSON.parse(match[0])
        else throw new Error('Invalid JSON from AI')
      }
      setSectionData(p => ({ ...p, [key]: parsed }))
      setLastUpdated(p => ({ ...p, [key]: new Date().toLocaleTimeString() }))
    } catch (err) {
      setErrors(p => ({ ...p, [key]: err.message }))
    } finally {
      setLoading(p => ({ ...p, [key]: false }))
    }
  }, [callAPI])

  const fetchDeepDive = useCallback(async (opp) => {
    setDrillLoading(true)
    setDrillContent(null)
    try {
      const data = await callAPI(
        `Brief analysis of ${opp.ticker} (${opp.company}): key risks, recent news, technical setup, analyst view. Be concise. Mark each point FACT or ANALYSIS.`,
        'deepdive'
      )
      const textBlock = data.content?.find(b => b.type === 'text')
      setDrillContent(textBlock?.text || 'No data found.')
    } catch (err) {
      setDrillContent('Error: ' + err.message)
    } finally {
      setDrillLoading(false)
    }
  }, [callAPI])

  const handleStockClick = useCallback((opp) => {
    setSelectedStock(opp)
    setDrillContent(null)
    fetchDeepDive(opp)
  }, [fetchDeepDive])

  const renderContent = () => {
    const key = activeTab
    const data = sectionData[key]
    const err = errors[key]
    const isLoading = loading[key]
    if (isLoading) return <LoadingState color={SECTIONS[key].color} />
    if (err) return <ErrorState error={err} onRetry={() => fetchSection(key)} />
    if (!data) return <EmptyState section={SECTIONS[key]} onLoad={() => fetchSection(key)} />
    if (key === 'global') return <GlobalView data={data} />
    if (key === 'us' || key === 'europe') return <MarketView data={data} />
    if (key === 'opportunities') return <OpportunitiesView data={data} onStockClick={handleStockClick} />
    if (key === 'catalysts') return <CatalystsView data={data} />
    if (key === 'risk') return <RiskView data={data} />
    return null
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'IBM Plex Mono','Courier New',monospace", color: C.text }}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:#0a0e17}
        ::-webkit-scrollbar-thumb{background:#1f2937;border-radius:3px}
      `}</style>
      <div style={{ background: '#111827', borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: C.accent, fontWeight: 800, fontSize: 16, letterSpacing: 1 }}>⬡ CATALYST</span>
          <span style={{ color: C.muted, fontSize: 11 }}>TRADING INTELLIGENCE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {lastUpdated[activeTab] && <span style={{ color: C.muted, fontSize: 11 }}>Updated {lastUpdated[activeTab]}</span>}
          <RefreshBtn onClick={() => fetchSection(activeTab)} loading={!!loading[activeTab]} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 2, padding: '16px 24px 0', overflowX: 'auto' }}>
        {Object.entries(SECTIONS).map(([key, sec]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            background: activeTab === key ? sec.color + '22' : 'transparent',
            border: `1px solid ${activeTab === key ? sec.color + '88' : C.border}`,
            borderBottom: 'none', color: activeTab === key ? sec.color : C.muted,
            padding: '10px 18px', cursor: 'pointer', fontSize: 12,
            fontWeight: activeTab === key ? 700 : 500, borderRadius: '8px 8px 0 0',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
          }}>
            {sec.label}
            {loading[key] && <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block', fontSize: 10 }}>↻</span>}
            {sectionData[key] && !loading[key] && <span style={{ background: sec.color + '33', color: sec.color, borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>✓</span>}
          </button>
        ))}
      </div>
      <div style={{ padding: 24, borderTop: `1px solid ${C.border}` }}>
        {renderContent()}
      </div>
      {selectedStock && (
        <DeepDiveModal
          opp={selectedStock}
          onClose={() => { setSelectedStock(null); setDrillContent(null) }}
          onRefresh={() => fetchDeepDive(selectedStock)}
          loading={drillLoading}
          content={drillContent}
        />
      )}
    </div>
  )
}
