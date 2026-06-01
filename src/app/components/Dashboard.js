'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:      '#04080f',
  panel:   '#090f1a',
  card:    '#0d1525',
  border:  '#1a2640',
  text:    '#dde8f5',
  muted:   '#5a7a9a',
  soft:    '#101c2e',
  up:      '#00e5a0',
  down:    '#ff4560',
  flat:    '#7a90a8',
  accent:  '#00c8ff',
  amber:   '#ffb700',
  green:   '#00d68f',
  red:     '#ff4560',
  purple:  '#9b7dff',
  gold:    '#f5c842',
}

const FONT = `'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', monospace`

// ─── Universe (edit to add/remove stocks) ────────────────────────────────────
const UNIVERSE = [
  // Semis / AI silicon
  'NVDA','AMD','AVGO','TSM','MRVL','ARM',
  // Big tech / AI software
  'MSFT','GOOGL','META','PLTR',
  // Servers / storage
  'DELL','SMCI',
  // Cybersecurity
  'CRWD','PANW','ZS',
  // Defence
  'LMT','RTX','NOC','AXON',
  // Power / grid
  'VRT','ETN','CEG','FSLR',
  // Networking / space
  'ANET','RKLB',
]

// Historical 1-day earnings reaction averages (last 4 quarters)
// Update these periodically — they're your Return Gate evidence
const EARNINGS_HISTORY = {
  NVDA:  { avg1d: 14.2, beats: 4, label: 'Avg 14.2% · 4/4 beats' },
  AMD:   { avg1d: 9.8,  beats: 3, label: 'Avg 9.8% · 3/4 beats' },
  AVGO:  { avg1d: 11.4, beats: 4, label: 'Avg 11.4% · 4/4 beats' },
  MRVL:  { avg1d: 16.2, beats: 4, label: 'Avg 16.2% · 4/4 beats' },
  ARM:   { avg1d: 12.8, beats: 3, label: 'Avg 12.8% · 3/4 beats' },
  PLTR:  { avg1d: 18.4, beats: 4, label: 'Avg 18.4% · 4/4 beats' },
  CRWD:  { avg1d: 13.1, beats: 4, label: 'Avg 13.1% · 4/4 beats' },
  PANW:  { avg1d: 8.6,  beats: 3, label: 'Avg 8.6% · 3/4 beats' },
  META:  { avg1d: 11.2, beats: 4, label: 'Avg 11.2% · 4/4 beats' },
  MSFT:  { avg1d: 4.8,  beats: 4, label: 'Avg 4.8% · 4/4 beats' },
  GOOGL: { avg1d: 7.2,  beats: 3, label: 'Avg 7.2% · 3/4 beats' },
  RKLB:  { avg1d: 22.0, beats: 3, label: 'Avg 22.0% · 3/4 beats' },
  VRT:   { avg1d: 15.8, beats: 4, label: 'Avg 15.8% · 4/4 beats' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function repairJSON(str) {
  if (!str || typeof str !== 'string') throw new Error('Empty AI response')
  let s = str.replace(/```json|```/g, '').trim()
  const start = s.indexOf('{')
  if (start === -1) throw new Error(`AI returned text: "${s.slice(0, 80)}"`)
  s = s.slice(start)
  try { return JSON.parse(s) } catch {}
  const opens = []
  let inStr = false, esc = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (esc) { esc = false; continue }
    if (c === '\\' && inStr) { esc = true; continue }
    if (c === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (c === '{') opens.push('}')
    if (c === '[') opens.push(']')
    if (c === '}' || c === ']') opens.pop()
  }
  const fixed = s.replace(/,\s*([}\]])/g, '$1').trimEnd() + opens.reverse().join('')
  try { return JSON.parse(fixed) } catch {
    throw new Error(`Cannot parse AI response: "${s.slice(0, 120)}"`)
  }
}

function fmt(n, decimals = 2) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: decimals })
}

function timeStr(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString() } catch { return '—' }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const card = (extra = {}) => ({
  background: `linear-gradient(160deg, ${C.panel} 0%, ${C.card} 100%)`,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 20,
  ...extra,
})

const badge = (color, size = 'sm') => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: size === 'lg' ? '6px 14px' : '4px 10px',
  borderRadius: 6,
  border: `1px solid ${color}44`,
  background: `${color}14`,
  color,
  fontSize: size === 'lg' ? 13 : 11,
  fontWeight: 700,
  fontFamily: FONT,
  letterSpacing: 0.5,
})

const btn = (color) => ({
  appearance: 'none',
  border: `1px solid ${color}55`,
  background: `${color}12`,
  color,
  borderRadius: 8,
  padding: '9px 16px',
  fontWeight: 700,
  fontFamily: FONT,
  fontSize: 12,
  cursor: 'pointer',
  letterSpacing: 0.5,
})

const label = { color: C.muted, fontSize: 11, fontFamily: FONT, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 }
const val   = { color: C.text, fontWeight: 700, fontFamily: FONT }
const divider = <div style={{ height: 1, background: C.border, margin: '14px 0' }} />

// ─── Regime indicator ─────────────────────────────────────────────────────────
function RegimeBar({ vix, vixRegime, sectorHealth, marketCondition }) {
  const regimeColor = vixRegime === 'HIGH_FEAR' ? C.red : vixRegime === 'ELEVATED' ? C.amber : C.up
  const condColor   = marketCondition === 'BUY AGGRESSIVELY' ? C.up
    : marketCondition === 'BUY SELECTIVELY' ? C.accent
    : marketCondition === 'WAIT' ? C.amber
    : C.red

  return (
    <div style={{ ...card(), marginBottom: 14, padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
      {marketCondition && <span style={badge(condColor, 'lg')}>{marketCondition}</span>}
      {vix && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...label, marginBottom: 0 }}>VIX PROXY</span>
          <span style={{ ...badge(regimeColor), fontSize: 13 }}>{fmt(vix)} — {vixRegime}</span>
        </div>
      )}
      {sectorHealth && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(sectorHealth).map(([k, v]) => (
            <span key={k} style={badge(v === 'BULLISH' ? C.up : v === 'BEARISH' ? C.down : C.flat, 'sm')}>
              {k.toUpperCase()} {v}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Earnings pill ────────────────────────────────────────────────────────────
function EarningsPill({ days, date }) {
  if (days == null || days < 0) return null
  const color = days <= 3 ? C.red : days <= 10 ? C.amber : C.accent
  return (
    <span style={{ ...badge(color), marginLeft: 8 }}>
      EARNINGS {days <= 0 ? 'TODAY' : `in ${days}d`}{date ? ` · ${date}` : ''}
    </span>
  )
}

// ─── Action badge ──────────────────────────────────────────────────────────────
function ActionBadge({ action }) {
  const color = action === 'STRONG BUY' ? C.up
    : action === 'BUY' ? C.accent
    : action === 'WATCH' ? C.amber
    : action === 'AVOID' ? C.red
    : C.muted
  return <span style={badge(color, 'lg')}>{action || 'WATCH'}</span>
}

// ─── Gate badge ───────────────────────────────────────────────────────────────
function GateBadge({ label: lbl, pass }) {
  const color = pass === true ? C.up : pass === false ? C.red : C.amber
  const text  = pass === true ? '✓' : pass === false ? '✗' : '~'
  return (
    <span style={{ ...badge(color), gap: 4 }}>
      {text} {lbl}
    </span>
  )
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score, max = 100 }) {
  const pct   = Math.min((score / max) * 100, 100)
  const color = score >= 80 ? C.up : score >= 70 ? C.accent : score >= 60 ? C.amber : C.red
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ color, fontWeight: 800, fontFamily: FONT, fontSize: 14, minWidth: 32 }}>{score}</span>
    </div>
  )
}

// ─── Opportunity card ─────────────────────────────────────────────────────────
function OpportunityCard({ opp, rank, active, onClick }) {
  const earnHistory = EARNINGS_HISTORY[opp.ticker]
  const gapUp = opp.bigMoverToday && Math.abs(opp.changePctToday || 0) > 8

  return (
    <button
      onClick={() => onClick(opp)}
      style={{
        ...card(),
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        borderColor: active ? `${C.accent}88` : gapUp ? `${C.amber}44` : C.border,
        background: active
          ? `linear-gradient(160deg, rgba(0,200,255,0.1) 0%, ${C.card} 100%)`
          : `linear-gradient(160deg, ${C.panel} 0%, ${C.card} 100%)`,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: C.muted, fontFamily: FONT, fontSize: 12 }}>#{rank}</span>
          <span style={{ color: C.text, fontFamily: FONT, fontWeight: 900, fontSize: 22 }}>{opp.ticker}</span>
          <EarningsPill days={opp.earningsTradingDaysAway} date={opp.earningsDate} />
          {gapUp && <span style={badge(C.amber)}>⚠ GAP UP</span>}
        </div>
        <ActionBadge action={opp.action} />
      </div>

      {/* Price row */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', marginBottom: 14 }}>
        <span style={{ color: C.text, fontFamily: FONT, fontWeight: 900, fontSize: 28 }}>{opp.currentPrice || '—'}</span>
        <span style={{ color: opp.direction === 'up' ? C.up : C.down, fontFamily: FONT, fontWeight: 700 }}>
          {opp.change1d || ''}
        </span>
        {opp.expectedGain && (
          <span style={{ color: C.gold, fontFamily: FONT, fontSize: 13 }}>Target: {opp.expectedGain}</span>
        )}
      </div>

      {/* Thesis */}
      <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>{opp.thesis || '—'}</div>

      {/* Gates */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <GateBadge label="RETURN GATE" pass={opp.returnGate === 'PASS' ? true : opp.returnGate === 'FAIL' ? false : null} />
        <GateBadge label="CASH CHALLENGE" pass={opp.cashChallenge === 'PASS' ? true : opp.cashChallenge === 'FAIL' ? false : null} />
        {opp.priceStatus && <span style={badge(opp.priceStatus?.includes('LIVE') ? C.up : C.amber)}>{opp.priceStatus}</span>}
      </div>

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
        {[
          ['Catalyst', opp.catalyst],
          ['Catalyst date', opp.catalystDate || opp.earningsDate],
          ['Entry zone', opp.entryZone],
          ['Stop loss', opp.stopLoss],
          ['Risk/Reward', opp.riskReward],
          ['Allocation', opp.allocation],
        ].map(([lbl, v]) => v ? (
          <div key={lbl}>
            <div style={label}>{lbl}</div>
            <div style={{ ...val, fontSize: 13 }}>{v}</div>
          </div>
        ) : null)}
      </div>

      {/* Earnings history */}
      {earnHistory && (
        <div style={{ ...badge(C.purple), fontSize: 11, marginTop: 4 }}>
          📊 {earnHistory.label}
        </div>
      )}

      {/* Score */}
      {opp.opportunityScore != null && (
        <div style={{ marginTop: 12 }}>
          <div style={label}>OPPORTUNITY SCORE</div>
          <ScoreBar score={opp.opportunityScore} />
        </div>
      )}
    </button>
  )
}

// ─── Earnings calendar card ───────────────────────────────────────────────────
function EarningsCalendarSection({ calendar }) {
  if (!calendar?.length) return null
  const upcoming = calendar.filter(e => (e.tradingDaysAway ?? -1) >= 0).slice(0, 12)
  if (!upcoming.length) return null

  return (
    <div style={{ ...card(), marginTop: 18 }}>
      <div style={{ color: C.accent, fontFamily: FONT, fontSize: 12, letterSpacing: 1, marginBottom: 16 }}>
        VERIFIED EARNINGS DATES — SOURCE: FINNHUB
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {upcoming.map((e, i) => {
          const daysColor = e.tradingDaysAway <= 3 ? C.red : e.tradingDaysAway <= 10 ? C.amber : C.accent
          const hist = EARNINGS_HISTORY[e.ticker]
          return (
            <div key={i} style={{ ...card({ padding: 12 }), borderColor: `${daysColor}33` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: C.text, fontFamily: FONT, fontWeight: 800, fontSize: 16 }}>{e.ticker}</span>
                <span style={{ ...badge(daysColor), fontSize: 10 }}>
                  {e.tradingDaysAway === 0 ? 'TODAY' : `${e.tradingDaysAway}d`}
                </span>
              </div>
              <div style={{ color: C.muted, fontFamily: FONT, fontSize: 11, marginTop: 4 }}>{e.date}</div>
              {hist && (
                <div style={{ color: C.purple, fontFamily: FONT, fontSize: 10, marginTop: 6 }}>
                  {hist.label}
                </div>
              )}
              {e.epsEstimate != null && (
                <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
                  EPS est: ${e.epsEstimate}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── CIO Summary panel ────────────────────────────────────────────────────────
function CIOPanel({ cio }) {
  if (!cio) return null
  return (
    <div style={{ ...card({ borderColor: `${C.gold}44` }), marginBottom: 18 }}>
      <div style={{ color: C.gold, fontFamily: FONT, fontSize: 12, letterSpacing: 1, marginBottom: 14 }}>
        ⚡ FINAL CIO CALLS
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {[
          ['Best Trade Today',       cio.bestTradeToday,        C.up],
          ['Best Risk/Reward',       cio.bestRiskReward,        C.accent],
          ['Best New Opportunity',   cio.bestNewOpportunity,    C.green],
          ['Best Speculative',       cio.bestSpeculative,       C.purple],
          ['Cash Recommendation',    cio.cashRecommendation,    C.amber],
          ['Final Market Decision',  cio.finalMarketDecision,   C.gold],
        ].map(([lbl, v, color]) => v ? (
          <div key={lbl} style={{ ...card({ padding: 12 }) }}>
            <div style={label}>{lbl}</div>
            <div style={{ color, fontFamily: FONT, fontWeight: 800, fontSize: 14 }}>{v}</div>
          </div>
        ) : null)}
      </div>
      {cio.watchList?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={label}>WATCH LIST</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {cio.watchList.map((w, i) => (
              <span key={i} style={badge(C.amber)}>{w.ticker || w} {w.reason ? `— ${w.reason}` : ''}</span>
            ))}
          </div>
        </div>
      )}
      {cio.avoidList?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={label}>AVOID</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {cio.avoidList.map((w, i) => (
              <span key={i} style={badge(C.red)}>{w.ticker || w} {w.reason ? `— ${w.reason}` : ''}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Deep dive panel ──────────────────────────────────────────────────────────
function DeepDivePanel({ stock, content, loading, onRun }) {
  return (
    <div style={{ ...card(), position: 'sticky', top: 20 }}>
      <div style={{ color: C.accent, fontFamily: FONT, fontSize: 12, letterSpacing: 1, marginBottom: 14 }}>
        SELECTED SETUP
      </div>
      {stock ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 26, color: C.text }}>{stock.ticker}</div>
              <div style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>{stock.company || stock.ticker}</div>
            </div>
            <ActionBadge action={stock.action} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              ['Live Price',    stock.currentPrice],
              ['Target',        stock.takeProfit || stock.expectedGain],
              ['Stop Loss',     stock.stopLoss],
              ['R/R',           stock.riskReward],
              ['Entry Zone',    stock.entryZone],
              ['Allocation',    stock.allocation],
            ].map(([lbl, v]) => v ? (
              <div key={lbl}>
                <div style={label}>{lbl}</div>
                <div style={{ ...val, fontSize: 14 }}>{v}</div>
              </div>
            ) : null)}
          </div>

          {stock.earningsDate && (
            <div style={{ marginBottom: 12 }}>
              <div style={label}>Earnings Date (Verified)</div>
              <div style={{ color: C.amber, fontFamily: FONT, fontWeight: 700 }}>
                {stock.earningsDate}
                {stock.earningsTradingDaysAway != null && ` · ${stock.earningsTradingDaysAway} trading days`}
              </div>
            </div>
          )}

          {stock.catalyst && (
            <div style={{ marginBottom: 12 }}>
              <div style={label}>Catalyst</div>
              <div style={{ ...val, fontSize: 13 }}>{stock.catalyst}</div>
            </div>
          )}

          {stock.invalidation && (
            <div style={{ marginBottom: 14 }}>
              <div style={label}>Invalidation</div>
              <div style={{ color: C.red, fontSize: 13 }}>{stock.invalidation}</div>
            </div>
          )}

          {divider}

          <div style={{ color: C.accent, fontFamily: FONT, fontSize: 12, letterSpacing: 1, marginBottom: 10 }}>
            DEEP DIVE ANALYSIS
          </div>

          {loading ? (
            <div style={{ color: C.muted, fontFamily: FONT, fontSize: 12 }}>Analysing {stock.ticker}…</div>
          ) : content ? (
            <div style={{ color: C.text, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{content}</div>
          ) : (
            <button onClick={onRun} style={btn(C.accent)}>▶ Run deep dive</button>
          )}
        </>
      ) : (
        <div style={{ color: C.muted, fontFamily: FONT, fontSize: 12 }}>Select an opportunity to view details.</div>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const TABS = [
  { key: 'opportunities', label: '⚡ Opportunities' },
  { key: 'global',        label: '🌍 Global' },
  { key: 'us',            label: '🇺🇸 US Pre-Market' },
  { key: 'europe',        label: '🇪🇺 Europe' },
  { key: 'risk',          label: '⚠ Risk' },
]

export default function Dashboard() {
  const [activeTab,    setActiveTab]    = useState('opportunities')
  const [sectionData,  setSectionData]  = useState({})
  const [loading,      setLoading]      = useState({})
  const [errors,       setErrors]       = useState({})
  const [selected,     setSelected]     = useState(null)
  const [drillContent, setDrillContent] = useState(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [lastUpdated,  setLastUpdated]  = useState({})
  const loadedRef = useRef({})

  // ── API helpers ────────────────────────────────────────────────────────────

  const callClaude = useCallback(async (prompt, mode = 'json') => {
    const res  = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, mode }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Claude error ${res.status}`)
    const tb = data.content?.find(b => b.type === 'text')
    if (!tb) throw new Error('No text block in Claude response')
    return tb.text
  }, [])

  const fetchMarket = useCallback(async (type, extra = '') => {
    const res  = await fetch(`/api/market?type=${type}${extra}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Market error ${res.status}`)
    return data
  }, [])

  // ── Section loaders ────────────────────────────────────────────────────────

  const loadOpportunities = useCallback(async () => {
    setLoading(p => ({ ...p, opportunities: true }))
    setErrors(p  => ({ ...p, opportunities: null }))
    try {
      const market = await fetchMarket('opportunities')
      const { stocks, earningsCalendar, vix, vixRegime, sectorHealth } = market

      // Build a rich prompt that gives Claude verified data to work with
      const stockLines = (stocks || []).map(s => {
        const hist = EARNINGS_HISTORY[s.ticker]
        return [
          `${s.ticker}: price=${s.priceFormatted} change=${s.change1d}`,
          s.hasVerifiedEarnings ? `VERIFIED_EARNINGS_DATE=${s.earningsDate} (${s.earningsTradingDaysAway} trading days away)` : 'NO_VERIFIED_EARNINGS_DATE',
          s.bigMoverToday ? 'BIG_MOVER_TODAY — apply Gap-Up Penalty if >8%' : '',
          hist ? `EARNINGS_HISTORY: ${hist.label}` : '',
        ].filter(Boolean).join(' | ')
      }).join('\n')

      const calendarLines = (earningsCalendar || []).slice(0, 15).map(e =>
        `${e.ticker} reports ${e.date} (${e.tradingDaysAway} trading days) EPS_est=${e.epsEstimate || 'N/A'}`
      ).join('\n')

      const prompt = `
TODAY: ${new Date().toDateString()}
VIX PROXY (VIXY): ${vix || 'N/A'} — REGIME: ${vixRegime || 'UNKNOWN'}
SECTOR HEALTH: ${JSON.stringify(sectorHealth)}

LIVE PRICES FROM FINNHUB (verified):
${stockLines}

VERIFIED EARNINGS CALENDAR (next 60 days, source: Finnhub):
${calendarLines || 'None found'}

EARNINGS HISTORY (hardcoded, update periodically):
${Object.entries(EARNINGS_HISTORY).map(([k,v]) => `${k}: ${v.label}`).join(', ')}

RULES YOU MUST FOLLOW:
1. Only use earnings dates from VERIFIED_EARNINGS_DATE above — never invent dates.
2. Apply GAP-UP PENALTY: if a stock is up >8% today → max rating = WATCH unless second catalyst exists.
3. Apply POST-CATALYST CHASE RULE: catalyst already occurred + stock up >15% → max rating = WATCH.
4. Apply RETURN GATE: prove credible 15%+ path. Use earnings history if available.
5. Apply CASH CHALLENGE: beats holding cash? If no → max rating = WATCH.
6. Stocks with earnings in 0-3 trading days are highest priority for BUY candidates.
7. Stocks with no verified catalyst within 40 trading days → max rating = WATCH.
8. Producing zero BUY recommendations is valid and correct if nothing qualifies.

Return JSON only:
{
  "marketCondition": "BUY AGGRESSIVELY|BUY SELECTIVELY|WAIT|HOLD CASH",
  "cashRecommendation": "one sentence explaining cash level",
  "cashPct": 30,
  "cio": {
    "bestTradeToday": "TICKER or NONE",
    "bestRiskReward": "TICKER or NONE",
    "bestNewOpportunity": "TICKER or NONE",
    "bestSpeculative": "TICKER or NONE",
    "cashRecommendation": "e.g. Hold 30% cash",
    "finalMarketDecision": "BUY AGGRESSIVELY|BUY SELECTIVELY|WAIT|HOLD CASH",
    "watchList": [{"ticker":"","reason":""}],
    "avoidList": [{"ticker":"","reason":""}]
  },
  "opportunities": [
    {
      "ticker": "",
      "company": "",
      "action": "STRONG BUY|BUY|WATCH|AVOID",
      "currentPrice": "use verified price above",
      "entryZone": "$X-$Y",
      "stopLoss": "$X — reason in one line",
      "takeProfit": "$X (N%)",
      "expectedGain": "15-20%",
      "confidence": 8,
      "riskLevel": "LOW|MEDIUM|HIGH",
      "catalyst": "specific named catalyst — NO invented catalysts",
      "catalystDate": "use VERIFIED date only, else UNVERIFIED",
      "riskReward": "3:1",
      "allocation": "10%",
      "buyNow": "YES|NO|WAIT",
      "thesis": "2 sentences max, specific, no fluff",
      "invalidation": "specific conditions that break the thesis",
      "returnGate": "PASS|CONDITIONAL PASS|FAIL|INSUFFICIENT EVIDENCE",
      "returnGatePathway": "which of the 6 pathways used",
      "cashChallenge": "PASS|FAIL",
      "priceStatus": "LIVE PRICE VERIFIED",
      "opportunityScore": 75,
      "scoreBreakdown": {
        "catalystTiming": 20,
        "catalystStrength": 16,
        "probability": 15,
        "evidenceQuality": 12,
        "riskReward": 7,
        "entryQuality": 3,
        "analystSupport": 2
      }
    }
  ]
}
`
      const aiText = await callClaude(prompt, 'cio')
      const ai     = repairJSON(aiText)

      // Ground prices with verified live data
      const priceMap = Object.fromEntries((stocks || []).map(s => [s.ticker, s]))
      const grounded = (ai.opportunities || []).map(opp => {
        const live = priceMap[opp.ticker] || {}
        return {
          ...opp,
          currentPrice: live.priceFormatted || opp.currentPrice,
          change1d: live.change1d || null,
          changePctToday: live.changePct || 0,
          direction: live.direction || 'up',
          bigMoverToday: live.bigMoverToday || false,
          earningsDate: live.earningsDate || null,
          earningsTradingDaysAway: live.earningsTradingDaysAway ?? null,
          hasVerifiedEarnings: live.hasVerifiedEarnings || false,
          provider: 'finnhub',
        }
      })

      setSectionData(p => ({
        ...p,
        opportunities: {
          marketCondition: ai.marketCondition,
          cashRecommendation: ai.cashRecommendation,
          cashPct: ai.cashPct,
          cio: ai.cio,
          opportunities: grounded,
          earningsCalendar,
          vix,
          vixRegime,
          sectorHealth,
          meta: market.meta,
        },
      }))
      setLastUpdated(p => ({ ...p, opportunities: new Date().toISOString() }))
      if (grounded[0]) setSelected(grounded[0])
    } catch (err) {
      setErrors(p => ({ ...p, opportunities: err.message }))
    } finally {
      setLoading(p => ({ ...p, opportunities: false }))
    }
  }, [fetchMarket, callClaude])

  const loadGlobal = useCallback(async () => {
    setLoading(p => ({ ...p, global: true }))
    setErrors(p  => ({ ...p, global: null }))
    try {
      const market = await fetchMarket('global')
      const summary = `
Real market data:
Markets: ${market.markets?.map(m => `${m.name} ${m.value} ${m.change}`).join(', ')}
Commodities: ${market.commodities?.map(c => `${c.name} ${c.value} ${c.change}`).join(', ')}
FX: ${market.currencies?.map(c => `${c.pair} ${c.value} ${c.change}`).join(', ')}
VIX Proxy: ${market.vix} (${market.vixRegime})

Based ONLY on data above, return JSON:
{"sentiment":"RISK ON|RISK OFF|NEUTRAL","sentimentReason":"one sentence","regimeAdvice":"one sentence on what this means for swing traders","macroEvents":[{"event":"","impact":"HIGH|MEDIUM|LOW"}]}`
      const aiText = await callClaude(summary)
      const ai     = repairJSON(aiText)
      setSectionData(p => ({ ...p, global: { ...market, ...ai } }))
      setLastUpdated(p => ({ ...p, global: new Date().toISOString() }))
    } catch (err) {
      setErrors(p => ({ ...p, global: err.message }))
    } finally {
      setLoading(p => ({ ...p, global: false }))
    }
  }, [fetchMarket, callClaude])

  const loadUS = useCallback(async () => {
    setLoading(p => ({ ...p, us: true }))
    setErrors(p  => ({ ...p, us: null }))
    try {
      const market = await fetchMarket('us')
      const summary = `
Real US data:
Futures: ${market.futures?.map(f => `${f.index} ${f.value} ${f.change}`).join(', ')}
Gainers: ${market.gainers?.map(g => `${g.ticker} ${g.change}`).join(', ')}
Losers: ${market.losers?.map(l => `${l.ticker} ${l.change}`).join(', ')}

Apply POST-CATALYST CHASE RULE to every gainer. Return JSON:
{"outlook":"BULLISH|BEARISH|NEUTRAL","outlookReason":"one sentence","sectorLeaders":[],"sectorLaggards":[],"watchForToday":["specific things to monitor"]}`
      const aiText = await callClaude(summary)
      const ai     = repairJSON(aiText)
      setSectionData(p => ({ ...p, us: { ...market, ...ai } }))
      setLastUpdated(p => ({ ...p, us: new Date().toISOString() }))
    } catch (err) {
      setErrors(p => ({ ...p, us: err.message }))
    } finally {
      setLoading(p => ({ ...p, us: false }))
    }
  }, [fetchMarket, callClaude])

  const loadEurope = useCallback(async () => {
    setLoading(p => ({ ...p, europe: true }))
    setErrors(p  => ({ ...p, europe: null }))
    try {
      const market = await fetchMarket('europe')
      const summary = `
European indices: ${market.futures?.map(f => `${f.index} ${f.value} ${f.change}`).join(', ')}

Return JSON:
{"outlook":"BULLISH|BEARISH|NEUTRAL","outlookReason":"one sentence","europeanSetups":[{"ticker":"","company":"","catalyst":"specific","catalystDate":"","action":"WATCH|BUY"}]}`
      const aiText = await callClaude(summary)
      const ai     = repairJSON(aiText)
      setSectionData(p => ({ ...p, europe: { ...market, ...ai } }))
      setLastUpdated(p => ({ ...p, europe: new Date().toISOString() }))
    } catch (err) {
      setErrors(p => ({ ...p, europe: err.message }))
    } finally {
      setLoading(p => ({ ...p, europe: false }))
    }
  }, [fetchMarket, callClaude])

  const loadRisk = useCallback(async () => {
    setLoading(p => ({ ...p, risk: true }))
    setErrors(p  => ({ ...p, risk: null }))
    try {
      const prompt = `Today is ${new Date().toDateString()}.
Assess current swing-trading risk environment. Be specific about threats in the next 40 days.
Return JSON:
{"overallRisk":"HIGH|ELEVATED|MODERATE|LOW","cashSuggestion":"X%","macroRisks":[{"risk":"","detail":"","severity":"HIGH|MEDIUM|LOW"}],"geopoliticalRisks":[{"risk":"","detail":"","severity":""}],"sectorRisks":[{"sector":"","risk":"","severity":""}],"positionSizingAdvice":"one line","hedgeIdeas":[""]}`
      const aiText = await callClaude(prompt)
      const ai     = repairJSON(aiText)
      setSectionData(p => ({ ...p, risk: ai }))
      setLastUpdated(p => ({ ...p, risk: new Date().toISOString() }))
    } catch (err) {
      setErrors(p => ({ ...p, risk: err.message }))
    } finally {
      setLoading(p => ({ ...p, risk: false }))
    }
  }, [callClaude])

  const deepDive = useCallback(async (opp) => {
    setDrillLoading(true)
    setDrillContent(null)
    try {
      const hist = EARNINGS_HISTORY[opp.ticker]
      const text = await callClaude(`
Today: ${new Date().toDateString()}
Analyse ${opp.ticker} at ${opp.currentPrice}.
Earnings date: ${opp.earningsDate || 'NOT VERIFIED'} (${opp.earningsTradingDaysAway ?? '?'} trading days away).
Catalyst: ${opp.catalyst || 'N/A'}
Earnings history: ${hist ? hist.label : 'not available'}
Thesis: ${opp.thesis}

Cover: (1) Why this specific setup NOW (2) Key risk to the thesis (3) Ideal entry trigger (4) What invalidates immediately.
Label each claim FACT, ANALYSIS or OPINION. Under 260 words.`, 'deepdive')
      setDrillContent(text)
    } catch (err) {
      setDrillContent(`Error: ${err.message}`)
    } finally {
      setDrillLoading(false)
    }
  }, [callClaude])

  // Auto-load tabs when first visited
  const loaders = { opportunities: loadOpportunities, global: loadGlobal, us: loadUS, europe: loadEurope, risk: loadRisk }

  useEffect(() => {
    if (!loadedRef.current[activeTab] && !loading[activeTab] && !sectionData[activeTab]) {
      loadedRef.current[activeTab] = true
      loaders[activeTab]?.()
    }
  }, [activeTab]) // eslint-disable-line

  const handleStockClick = useCallback((opp) => {
    setSelected(opp)
    setDrillContent(null)
    deepDive(opp)
  }, [deepDive])

  const refresh = useCallback(() => {
    loadedRef.current[activeTab] = true
    loaders[activeTab]?.()
  }, [activeTab, loadOpportunities, loadGlobal, loadUS, loadEurope, loadRisk]) // eslint-disable-line

  // ── Renders ────────────────────────────────────────────────────────────────

  function renderOpportunities() {
    const d = sectionData.opportunities
    if (!d) return null
    const opps = d.opportunities || []

    return (
      <>
        <RegimeBar vix={d.vix} vixRegime={d.vixRegime} sectorHealth={d.sectorHealth} marketCondition={d.marketCondition} />
        <CIOPanel cio={d.cio} />

        {d.cashRecommendation && (
          <div style={{ ...card({ padding: '12px 18px' }), marginBottom: 14 }}>
            <span style={{ color: C.muted, fontFamily: FONT, fontSize: 12 }}>CASH: </span>
            <span style={{ color: C.text, fontFamily: FONT, fontSize: 13 }}>{d.cashRecommendation}</span>
            {d.cashPct != null && <span style={{ ...badge(C.amber), marginLeft: 10 }}>{d.cashPct}% CASH</span>}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(300px,0.8fr)', gap: 18, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'grid', gap: 14 }}>
              {opps.length ? opps.map((opp, i) => (
                <OpportunityCard
                  key={`${opp.ticker}-${i}`}
                  opp={opp}
                  rank={i + 1}
                  active={selected?.ticker === opp.ticker}
                  onClick={handleStockClick}
                />
              )) : (
                <div style={{ ...card(), color: C.muted, fontFamily: FONT, fontSize: 13 }}>
                  No qualifying opportunities returned. Cash may be the right call.
                </div>
              )}
            </div>
            <EarningsCalendarSection calendar={d.earningsCalendar} />
          </div>

          <DeepDivePanel
            stock={selected}
            content={drillContent}
            loading={drillLoading}
            onRun={() => selected && deepDive(selected)}
          />
        </div>
      </>
    )
  }

  function renderGlobal() {
    const d = sectionData.global
    if (!d) return null
    const sentColor = d.sentiment === 'RISK ON' ? C.up : d.sentiment === 'RISK OFF' ? C.down : C.flat
    return (
      <>
        <div style={{ ...card({ marginBottom: 14 }), display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={badge(sentColor, 'lg')}>{d.sentiment || 'NEUTRAL'}</span>
          <span style={{ color: C.text, fontFamily: FONT, fontSize: 13 }}>{d.sentimentReason}</span>
          {d.regimeAdvice && <span style={{ color: C.muted, fontFamily: FONT, fontSize: 12 }}>{d.regimeAdvice}</span>}
          {d.vix && <span style={{ ...badge(d.vixRegime === 'CALM' ? C.up : d.vixRegime === 'HIGH_FEAR' ? C.red : C.amber) }}>VIX PROXY: {fmt(d.vix)}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
          {(d.markets || []).map((m, i) => (
            <div key={i} style={card({ padding: 14 })}>
              <div style={label}>{m.name}</div>
              <div style={{ color: m.direction === 'up' ? C.up : C.down, fontFamily: FONT, fontWeight: 800, fontSize: 18 }}>{m.value}</div>
              <div style={{ color: m.direction === 'up' ? C.up : C.down, fontFamily: FONT, fontSize: 12 }}>{m.change}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          <div style={card()}>
            <div style={{ color: C.accent, fontFamily: FONT, fontSize: 12, letterSpacing: 1, marginBottom: 14 }}>COMMODITIES & FX</div>
            {(d.commodities || []).map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontFamily: FONT }}>
                <span style={{ color: C.muted }}>{c.name}</span>
                <span style={{ color: c.direction === 'up' ? C.up : C.down }}>{c.value} {c.change}</span>
              </div>
            ))}
            {divider}
            {(d.currencies || []).map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontFamily: FONT }}>
                <span style={{ color: C.muted }}>{c.pair}</span>
                <span style={{ color: C.text }}>{c.value} {c.change}</span>
              </div>
            ))}
          </div>
          <div style={card()}>
            <div style={{ color: C.accent, fontFamily: FONT, fontSize: 12, letterSpacing: 1, marginBottom: 14 }}>MACRO EVENTS</div>
            {(d.macroEvents || []).map((e, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ color: C.text, fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>{e.event}</div>
                <div style={{ ...badge(e.impact === 'HIGH' ? C.red : e.impact === 'MEDIUM' ? C.amber : C.muted), marginTop: 6 }}>{e.impact}</div>
                {i < d.macroEvents.length - 1 && divider}
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  function renderUS() {
    const d = sectionData.us
    if (!d) return null
    const outlookColor = d.outlook === 'BULLISH' ? C.up : d.outlook === 'BEARISH' ? C.down : C.flat
    return (
      <>
        <div style={{ ...card({ marginBottom: 14 }), display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={badge(outlookColor, 'lg')}>{d.outlook || 'NEUTRAL'}</span>
          <span style={{ color: C.text, fontFamily: FONT, fontSize: 13 }}>{d.outlookReason}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
          {(d.futures || []).map((f, i) => (
            <div key={i} style={card({ padding: 14 })}>
              <div style={label}>{f.index}</div>
              <div style={{ color: f.direction === 'up' ? C.up : C.down, fontFamily: FONT, fontWeight: 800, fontSize: 18 }}>{f.value}</div>
              <div style={{ color: f.direction === 'up' ? C.up : C.down, fontFamily: FONT, fontSize: 12 }}>{f.change}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
          {[['Top Gainers', d.gainers, C.up], ['Top Losers', d.losers, C.down]].map(([title, items, color]) => (
            <div key={title} style={card()}>
              <div style={{ color: C.accent, fontFamily: FONT, fontSize: 12, letterSpacing: 1, marginBottom: 14 }}>{title.toUpperCase()}</div>
              {(items || []).map((g, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT }}>
                    <span style={{ color: C.text, fontWeight: 800 }}>{g.ticker}</span>
                    <span style={{ color }}>{g.change}</span>
                  </div>
                  <div style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>{g.price}</div>
                  {i < items.length - 1 && divider}
                </div>
              ))}
            </div>
          ))}
          {d.watchForToday?.length > 0 && (
            <div style={card()}>
              <div style={{ color: C.accent, fontFamily: FONT, fontSize: 12, letterSpacing: 1, marginBottom: 14 }}>WATCH FOR TODAY</div>
              {d.watchForToday.map((w, i) => (
                <div key={i} style={{ color: C.text, fontFamily: FONT, fontSize: 13, marginBottom: 8 }}>• {w}</div>
              ))}
            </div>
          )}
        </div>
      </>
    )
  }

  function renderEurope() {
    const d = sectionData.europe
    if (!d) return null
    const outlookColor = d.outlook === 'BULLISH' ? C.up : d.outlook === 'BEARISH' ? C.down : C.flat
    return (
      <>
        <div style={{ ...card({ marginBottom: 14 }), display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={badge(outlookColor, 'lg')}>{d.outlook || 'NEUTRAL'}</span>
          <span style={{ color: C.text, fontFamily: FONT, fontSize: 13 }}>{d.outlookReason}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
          {(d.futures || []).map((f, i) => (
            <div key={i} style={card({ padding: 14 })}>
              <div style={label}>{f.index}</div>
              <div style={{ color: f.direction === 'up' ? C.up : C.down, fontFamily: FONT, fontWeight: 800, fontSize: 18 }}>{f.value}</div>
              <div style={{ color: f.direction === 'up' ? C.up : C.down, fontFamily: FONT, fontSize: 12 }}>{f.change}</div>
            </div>
          ))}
        </div>
        {d.europeanSetups?.length > 0 && (
          <div style={card()}>
            <div style={{ color: C.accent, fontFamily: FONT, fontSize: 12, letterSpacing: 1, marginBottom: 14 }}>EUROPEAN SETUPS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {d.europeanSetups.map((s, i) => (
                <div key={i} style={card({ padding: 14 })}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: C.text, fontFamily: FONT, fontWeight: 800 }}>{s.ticker}</span>
                    <ActionBadge action={s.action} />
                  </div>
                  <div style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>{s.company}</div>
                  <div style={{ color: C.text, fontSize: 13, marginTop: 8 }}>{s.catalyst}</div>
                  {s.catalystDate && <div style={{ color: C.amber, fontSize: 12, fontFamily: FONT, marginTop: 4 }}>{s.catalystDate}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )
  }

  function renderRisk() {
    const d = sectionData.risk
    if (!d) return null
    const riskColor = d.overallRisk === 'LOW' ? C.up : d.overallRisk === 'MODERATE' ? C.amber : C.red
    return (
      <>
        <div style={{ ...card({ marginBottom: 14 }), display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={badge(riskColor, 'lg')}>RISK: {d.overallRisk || 'MODERATE'}</span>
          {d.cashSuggestion && <span style={{ ...badge(C.amber) }}>Suggest {d.cashSuggestion} cash</span>}
          {d.positionSizingAdvice && <span style={{ color: C.muted, fontFamily: FONT, fontSize: 12 }}>{d.positionSizingAdvice}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
          {[
            ['Macro Risks',        d.macroRisks,        r => r.risk,   r => r.detail,   r => r.severity],
            ['Geopolitical Risks', d.geopoliticalRisks, r => r.risk,   r => r.detail,   r => r.severity],
            ['Sector Risks',       d.sectorRisks,       r => r.sector, r => r.risk,     r => r.severity],
          ].map(([title, items, titleFn, detailFn, sevFn]) => (
            <div key={title} style={card()}>
              <div style={{ color: C.accent, fontFamily: FONT, fontSize: 12, letterSpacing: 1, marginBottom: 14 }}>{title.toUpperCase()}</div>
              {(items || []).map((r, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ color: C.text, fontFamily: FONT, fontWeight: 700, fontSize: 13 }}>{titleFn(r)}</div>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{detailFn(r)}</div>
                  <span style={{ ...badge(sevFn(r) === 'HIGH' ? C.red : sevFn(r) === 'MEDIUM' ? C.amber : C.muted), marginTop: 6 }}>{sevFn(r)}</span>
                  {i < items.length - 1 && divider}
                </div>
              ))}
            </div>
          ))}
          <div style={card()}>
            <div style={{ color: C.accent, fontFamily: FONT, fontSize: 12, letterSpacing: 1, marginBottom: 14 }}>HEDGE IDEAS</div>
            {(d.hedgeIdeas || []).map((h, i) => (
              <div key={i} style={{ color: C.text, fontFamily: FONT, fontSize: 13, marginBottom: 8 }}>• {h}</div>
            ))}
          </div>
        </div>
      </>
    )
  }

  function renderContent() {
    const isLoading = loading[activeTab]
    const error     = errors[activeTab]
    const data      = sectionData[activeTab]

    if (isLoading) {
      return (
        <div style={{ ...card(), minHeight: 300, display: 'grid', placeItems: 'center' }}>
          <div>
            <div style={{ color: C.accent, fontFamily: FONT, fontSize: 14, marginBottom: 8, textAlign: 'center' }}>
              {activeTab === 'opportunities' ? '⚡ Running trading analysis…' : '⟳ Loading…'}
            </div>
            <div style={{ color: C.muted, fontFamily: FONT, fontSize: 12, textAlign: 'center' }}>
              {activeTab === 'opportunities'
                ? 'Fetching live prices → Pulling earnings calendar → Applying trading rules → Generating CIO analysis'
                : 'Fetching market data and running AI analysis'}
            </div>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div style={{ ...card({ borderColor: `${C.red}55` }), padding: 24 }}>
          <div style={{ color: C.red, fontFamily: FONT, fontWeight: 700, marginBottom: 8 }}>Error loading data</div>
          <div style={{ color: C.text, fontFamily: FONT, fontSize: 13, marginBottom: 16, whiteSpace: 'pre-wrap' }}>{error}</div>
          <button onClick={refresh} style={btn(C.red)}>Retry</button>
        </div>
      )
    }

    if (!data) return (
      <div style={{ ...card(), minHeight: 200, display: 'grid', placeItems: 'center' }}>
        <div style={{ color: C.muted, fontFamily: FONT }}>Loading…</div>
      </div>
    )

    if (activeTab === 'opportunities') return renderOpportunities()
    if (activeTab === 'global')        return renderGlobal()
    if (activeTab === 'us')            return renderUS()
    if (activeTab === 'europe')        return renderEurope()
    if (activeTab === 'risk')          return renderRisk()
    return null
  }

  // ── Shell ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: 20, fontFamily: FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700;900&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 1600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ ...card({ marginBottom: 14 }), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '14px 20px' }}>
          <div>
            <div style={{ color: C.accent, fontWeight: 900, fontSize: 24, letterSpacing: 2 }}>CATALYST</div>
            <div style={{ color: C.muted, fontSize: 11, letterSpacing: 1 }}>TRADING INTELLIGENCE · LIVE DATA · {new Date().toDateString().toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {lastUpdated[activeTab] && (
              <span style={{ color: C.muted, fontSize: 11 }}>Updated {timeStr(lastUpdated[activeTab])}</span>
            )}
            <button onClick={refresh} style={btn(C.accent)}>↻ REFRESH</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const active = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  appearance: 'none',
                  border: `1px solid ${active ? `${C.accent}88` : C.border}`,
                  background: active ? `${C.accent}14` : 'transparent',
                  color: active ? C.accent : C.muted,
                  borderRadius: 8,
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontFamily: FONT,
                  fontSize: 12,
                  letterSpacing: 0.5,
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
                {loading[t.key] && ' ⟳'}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {renderContent()}
      </div>
    </div>
  )
}
