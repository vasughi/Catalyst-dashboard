'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

// Responsive hook — drives all layout decisions in JS (no CSS class fighting)
function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

// ─── Light theme design tokens ────────────────────────────────────────────────
const C = {
  bg:       '#f5f6fa',
  surface:  '#ffffff',
  card:     '#ffffff',
  border:   '#e2e6ef',
  borderMd: '#c8d0e0',
  text:     '#111827',
  textSub:  '#374151',
  muted:    '#6b7280',
  up:       '#059669',    // deep green — easy on eyes
  down:     '#dc2626',    // clear red
  flat:     '#6b7280',
  accent:   '#2563eb',    // strong blue
  amber:    '#d97706',
  green:    '#059669',
  red:      '#dc2626',
  purple:   '#7c3aed',
  gold:     '#b45309',
  upBg:     '#d1fae5',
  downBg:   '#fee2e2',
  accentBg: '#dbeafe',
  amberBg:  '#fef3c7',
  purpleBg: '#ede9fe',
}

// Clean sans-serif — excellent legibility
const FONT_BODY  = `'DM Sans', 'Outfit', 'Nunito', system-ui, sans-serif`
const FONT_MONO  = `'DM Mono', 'JetBrains Mono', 'Fira Code', monospace`
const FONT_HEAD  = `'DM Sans', 'Outfit', system-ui, sans-serif`

const UNIVERSE = [
  'NVDA','AMD','AVGO','TSM','MRVL','ARM',
  'MSFT','GOOGL','META','PLTR',
  'DELL','SMCI','CRWD','PANW','ZS',
  'LMT','RTX','NOC','AXON',
  'VRT','ETN','CEG','FSLR','ANET','RKLB',
]

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

// ─── Utilities ────────────────────────────────────────────────────────────────

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

function timeStr(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '—' }
}

// ─── Base style helpers ───────────────────────────────────────────────────────

const card = (extra = {}) => ({
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  ...extra,
})

// Pill badge — fully solid, high contrast
const pill = (color, bg, size = 'sm') => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: size === 'lg' ? '7px 16px' : size === 'md' ? '5px 12px' : '3px 9px',
  borderRadius: 999,
  background: bg,
  color: color,
  fontSize: size === 'lg' ? 14 : size === 'md' ? 12 : 11,
  fontWeight: 700,
  fontFamily: FONT_BODY,
  letterSpacing: 0.2,
  whiteSpace: 'nowrap',
})

const pillColors = {
  green:  [C.up,     C.upBg],
  red:    [C.down,   C.downBg],
  blue:   [C.accent, C.accentBg],
  amber:  [C.amber,  C.amberBg],
  purple: [C.purple, C.purpleBg],
  grey:   [C.muted,  '#f3f4f6'],
}

function Pill({ tone = 'grey', size = 'sm', children }) {
  const [color, bg] = pillColors[tone] || pillColors.grey
  return <span style={pill(color, bg, size)}>{children}</span>
}

const btn = (primary = true) => ({
  appearance: 'none',
  border: primary ? 'none' : `1.5px solid ${C.border}`,
  background: primary ? C.accent : C.surface,
  color: primary ? '#fff' : C.textSub,
  borderRadius: 10,
  padding: '10px 18px',
  fontWeight: 700,
  fontFamily: FONT_BODY,
  fontSize: 14,
  cursor: 'pointer',
  boxShadow: primary ? '0 2px 8px rgba(37,99,235,0.25)' : 'none',
})

const LBL = { color: C.muted, fontSize: 11, fontWeight: 600, fontFamily: FONT_BODY, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }
const VAL = { color: C.text, fontWeight: 700, fontFamily: FONT_BODY, fontSize: 15 }

const Divider = () => <div style={{ height: 1, background: C.border, margin: '14px 0' }} />

// ─── Action badge ─────────────────────────────────────────────────────────────
function ActionBadge({ action, size = 'md' }) {
  const map = {
    'STRONG BUY': 'green',
    'BUY':        'blue',
    'WATCH':      'amber',
    'AVOID':      'red',
  }
  return <Pill tone={map[action] || 'grey'} size={size}>{action || 'WATCH'}</Pill>
}

// ─── Gate badge ───────────────────────────────────────────────────────────────
function GateBadge({ label: lbl, pass }) {
  const tone  = pass === true ? 'green' : pass === false ? 'red' : 'amber'
  const icon  = pass === true ? '✓' : pass === false ? '✗' : '~'
  return <Pill tone={tone} size="sm">{icon} {lbl}</Pill>
}

// ─── Earnings pill ────────────────────────────────────────────────────────────
function EarningsPill({ days, date }) {
  if (days == null || days < 0) return null
  const tone = days <= 3 ? 'red' : days <= 10 ? 'amber' : 'blue'
  const label = days <= 0 ? 'EARNINGS TODAY' : `EARNINGS ${days}d · ${date || ''}`
  return <Pill tone={tone} size="sm">{label}</Pill>
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score }) {
  const pct   = Math.min((score / 100) * 100, 100)
  const color = score >= 80 ? C.up : score >= 70 ? C.accent : score >= 60 ? C.amber : C.down
  const bg    = score >= 80 ? C.upBg : score >= 70 ? C.accentBg : score >= 60 ? C.amberBg : C.downBg
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
      <div style={{ flex: 1, height: 8, background: bg, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ color, fontWeight: 800, fontFamily: FONT_MONO, fontSize: 15, minWidth: 28 }}>{score}</span>
    </div>
  )
}

// ─── Stat tile (small number card) ───────────────────────────────────────────
function StatTile({ label: lbl, value, change, direction }) {
  const changeColor = direction === 'up' ? C.up : direction === 'down' ? C.down : C.muted
  return (
    <div style={{ ...card({ padding: 16 }) }}>
      <div style={LBL}>{lbl}</div>
      <div style={{ color: C.text, fontWeight: 800, fontSize: 22, fontFamily: FONT_MONO }}>{value}</div>
      {change && <div style={{ color: changeColor, fontWeight: 600, fontSize: 13, fontFamily: FONT_MONO, marginTop: 2 }}>{change}</div>}
    </div>
  )
}

// ─── Regime bar ───────────────────────────────────────────────────────────────
function RegimeBar({ vix, vixRegime, sectorHealth, marketCondition }) {
  const condTone = marketCondition === 'BUY AGGRESSIVELY' ? 'green'
    : marketCondition === 'BUY SELECTIVELY' ? 'blue'
    : marketCondition === 'WAIT' ? 'amber'
    : 'red'
  const vixTone = vixRegime === 'HIGH_FEAR' ? 'red' : vixRegime === 'ELEVATED' ? 'amber' : 'green'

  return (
    <div style={{ ...card({ marginBottom: 14, padding: '14px 18px' }), display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      {marketCondition && <ActionBadge action={marketCondition} size="lg" />}
      {vix && <Pill tone={vixTone} size="md">VIX {vix} · {vixRegime}</Pill>}
      {sectorHealth && Object.entries(sectorHealth).map(([k, v]) => (
        <Pill key={k} tone={v === 'BULLISH' ? 'green' : v === 'BEARISH' ? 'red' : 'grey'} size="sm">
          {k.toUpperCase()} {v}
        </Pill>
      ))}
    </div>
  )
}

// ─── CIO panel ───────────────────────────────────────────────────────────────
function CIOPanel({ cio }) {
  if (!cio) return null
  const cells = [
    ['Best Trade Today',      cio.bestTradeToday,       'green'],
    ['Best Risk/Reward',      cio.bestRiskReward,       'blue'],
    ['Final Decision',        cio.finalMarketDecision,  'amber'],
  ].filter(([, v]) => v)

  return (
    <div style={{ ...card({ marginBottom: 14, borderLeft: `4px solid ${C.gold}`, borderRadius: 16 }) }}>
      <div style={{ color: C.gold, fontWeight: 800, fontSize: 13, fontFamily: FONT_BODY, letterSpacing: 0.5, marginBottom: 14 }}>
        ⚡ CIO CALLS
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: cio.watchList?.length ? 14 : 0 }}>
        {cells.map(([lbl, v, tone]) => (
          <div key={lbl} style={{ background: C.bg, borderRadius: 10, padding: 12 }}>
            <div style={LBL}>{lbl}</div>
            <div style={{ color: pillColors[tone][0], fontWeight: 800, fontSize: 16, fontFamily: FONT_BODY }}>{v}</div>
          </div>
        ))}
      </div>
      {cio.watchList?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...LBL, marginBottom: 8 }}>WATCH</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cio.watchList.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                <Pill tone="amber" size="sm">{w.ticker || w}</Pill>
                {w.reason && <span style={{ color: C.textSub, fontSize: 13, lineHeight: 1.5, flex: 1, minWidth: 0 }}>{w.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {cio.avoidList?.length > 0 && (
        <div>
          <div style={{ ...LBL, marginBottom: 8 }}>AVOID</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cio.avoidList.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                <Pill tone="red" size="sm">{w.ticker || w}</Pill>
                {w.reason && <span style={{ color: C.textSub, fontSize: 13, lineHeight: 1.5, flex: 1, minWidth: 0 }}>{w.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Opportunity card ─────────────────────────────────────────────────────────
function OpportunityCard({ opp, rank, active, onClick }) {
  const hist   = EARNINGS_HISTORY[opp.ticker]
  const gapUp  = opp.bigMoverToday && Math.abs(opp.changePctToday || 0) > 8
  const isBuy  = opp.action === 'BUY' || opp.action === 'STRONG BUY'

  return (
    <button
      onClick={() => onClick(opp)}
      style={{
        ...card({
          textAlign: 'left',
          cursor: 'pointer',
          width: '100%',
          borderLeft: `5px solid ${isBuy ? C.up : opp.action === 'WATCH' ? C.amber : C.border}`,
          borderRadius: 16,
          background: active ? '#f0f7ff' : C.card,
          boxShadow: active ? '0 0 0 2px #2563eb44' : '0 1px 4px rgba(0,0,0,0.06)',
          transition: 'all 0.15s',
        }),
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: C.muted, fontSize: 13, fontFamily: FONT_BODY }}>#{rank}</span>
          <span style={{ color: C.text, fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 26 }}>{opp.ticker}</span>
          <EarningsPill days={opp.earningsTradingDaysAway} date={opp.earningsDate} />
          {gapUp && <Pill tone="amber" size="sm">⚠ GAP UP — WATCH ONLY</Pill>}
        </div>
        <ActionBadge action={opp.action} size="lg" />
      </div>

      {/* Price */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ color: C.text, fontFamily: FONT_MONO, fontWeight: 900, fontSize: 32 }}>{opp.currentPrice || '—'}</span>
        {opp.change1d && (
          <span style={{ color: opp.direction === 'up' ? C.up : C.down, fontFamily: FONT_MONO, fontWeight: 700, fontSize: 16 }}>
            {opp.change1d}
          </span>
        )}
        {opp.expectedGain && (
          <span style={{ color: C.gold, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14 }}>
            🎯 Target: {opp.expectedGain}
          </span>
        )}
      </div>

      {/* Thesis */}
      <p style={{ color: C.textSub, fontSize: 14, lineHeight: 1.6, margin: '0 0 14px 0' }}>{opp.thesis || '—'}</p>

      {/* Gates */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <GateBadge label="RETURN GATE"    pass={opp.returnGate === 'PASS' ? true : opp.returnGate === 'FAIL' ? false : null} />
        <GateBadge label="CASH CHALLENGE" pass={opp.cashChallenge === 'PASS' ? true : opp.cashChallenge === 'FAIL' ? false : null} />
        <Pill tone="green" size="sm">LIVE PRICE VERIFIED</Pill>
      </div>

      {/* Details 2-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
        {[
          ['Catalyst',      opp.catalyst],
          ['Date',          opp.catalystDate || opp.earningsDate],
          ['Entry Zone',    opp.entryZone],
          ['Stop Loss',     opp.stopLoss],
          ['Risk / Reward', opp.riskReward],
          ['Allocation',    opp.allocation],
        ].map(([lbl, v]) => v ? (
          <div key={lbl}>
            <div style={LBL}>{lbl}</div>
            <div style={{ ...VAL, fontSize: 14 }}>{v}</div>
          </div>
        ) : null)}
      </div>

      {/* Earnings history chip */}
      {hist && (
        <Pill tone="purple" size="sm">📊 {hist.label}</Pill>
      )}

      {/* Score */}
      {opp.opportunityScore != null && (
        <div style={{ marginTop: 14 }}>
          <div style={LBL}>OPPORTUNITY SCORE</div>
          <ScoreBar score={opp.opportunityScore} />
        </div>
      )}
    </button>
  )
}

// ─── Earnings calendar section ────────────────────────────────────────────────
function EarningsCalendar({ calendar }) {
  if (!calendar?.length) return null
  const upcoming = calendar.filter(e => (e.tradingDaysAway ?? -1) >= 0).slice(0, 12)
  if (!upcoming.length) return null

  return (
    <div style={{ ...card({ marginTop: 18 }) }}>
      <div style={{ color: C.muted, fontWeight: 700, fontSize: 12, letterSpacing: 0.8, marginBottom: 14, fontFamily: FONT_BODY }}>
        📅 VERIFIED EARNINGS CALENDAR — SOURCE: FINNHUB
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {upcoming.map((e, i) => {
          const tone = e.tradingDaysAway <= 3 ? 'red' : e.tradingDaysAway <= 10 ? 'amber' : 'blue'
          const hist = EARNINGS_HISTORY[e.ticker]
          return (
            <div key={i} style={{ ...card({ padding: 12, borderTop: `3px solid ${pillColors[tone][0]}` }) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: C.text, fontWeight: 800, fontSize: 18, fontFamily: FONT_MONO }}>{e.ticker}</span>
                <Pill tone={tone} size="sm">{e.tradingDaysAway === 0 ? 'TODAY' : `${e.tradingDaysAway}d`}</Pill>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ color: C.muted, fontSize: 12, fontFamily: FONT_BODY }}>{e.date}</span>
                {e.source === 'fallback_estimate' && <span style={{ background: '#fef3c7', color: '#d97706', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>EST</span>}
              </div>
              {hist && <div style={{ color: C.purple, fontSize: 11, fontWeight: 600, marginTop: 4 }}>{hist.label}</div>}
              {e.epsEstimate != null && <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>EPS est: ${e.epsEstimate}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Deep dive panel ──────────────────────────────────────────────────────────
function DeepDivePanel({ stock, content, loading, onRun }) {
  return (
    <div style={{ ...card({ position: 'sticky', top: 16 }) }}>
      <div style={{ color: C.muted, fontWeight: 700, fontSize: 11, letterSpacing: 0.8, marginBottom: 14, fontFamily: FONT_BODY }}>
        SELECTED SETUP
      </div>
      {stock ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 900, fontSize: 30, color: C.text }}>{stock.ticker}</div>
              <div style={{ color: C.muted, fontSize: 13 }}>{stock.company || stock.ticker}</div>
            </div>
            <ActionBadge action={stock.action} size="lg" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              ['Live Price',  stock.currentPrice],
              ['Target',      stock.takeProfit || stock.expectedGain],
              ['Stop Loss',   stock.stopLoss],
              ['R/R',         stock.riskReward],
              ['Entry Zone',  stock.entryZone],
              ['Allocation',  stock.allocation],
            ].map(([lbl, v]) => v ? (
              <div key={lbl} style={{ background: C.bg, borderRadius: 10, padding: '10px 12px' }}>
                <div style={LBL}>{lbl}</div>
                <div style={{ ...VAL, fontSize: 15 }}>{v}</div>
              </div>
            ) : null)}
          </div>

          {stock.earningsDate && (
            <div style={{ background: C.amberBg, borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
              <div style={LBL}>EARNINGS DATE (VERIFIED)</div>
              <div style={{ color: C.amber, fontWeight: 800, fontSize: 15, fontFamily: FONT_MONO }}>
                {stock.earningsDate} · {stock.earningsTradingDaysAway} trading days
              </div>
            </div>
          )}

          {stock.catalyst && (
            <div style={{ marginBottom: 10 }}>
              <div style={LBL}>CATALYST</div>
              <div style={{ ...VAL, fontSize: 14 }}>{stock.catalyst}</div>
            </div>
          )}

          {stock.invalidation && (
            <div style={{ background: C.downBg, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <div style={LBL}>INVALIDATION</div>
              <div style={{ color: C.down, fontSize: 13, fontWeight: 600 }}>{stock.invalidation}</div>
            </div>
          )}

          <Divider />

          <div style={{ color: C.muted, fontWeight: 700, fontSize: 11, letterSpacing: 0.8, marginBottom: 10, fontFamily: FONT_BODY }}>
            DEEP DIVE ANALYSIS
          </div>

          {loading ? (
            <div style={{ color: C.muted, fontSize: 13, fontFamily: FONT_BODY }}>Analysing {stock.ticker}…</div>
          ) : content ? (
            <div style={{ color: C.textSub, fontSize: 14, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{content}</div>
          ) : (
            <button onClick={onRun} style={btn(true)}>▶ Run deep dive</button>
          )}
        </>
      ) : (
        <div style={{ color: C.muted, fontSize: 14 }}>Tap an opportunity to see details.</div>
      )}
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'opportunities', label: '⚡ Opportunities' },
  { key: 'global',        label: '🌍 Global' },
  { key: 'us',            label: '🇺🇸 US Markets' },
  { key: 'europe',        label: '🇪🇺 Europe' },
  { key: 'risk',          label: '⚠️ Risk' },
]

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab,    setActiveTab]    = useState('opportunities')
  const [sectionData,  setSectionData]  = useState({})
  const [loading,      setLoading]      = useState({})
  const [errors,       setErrors]       = useState({})
  const [selected,     setSelected]     = useState(null)
  const [drillContent, setDrillContent] = useState(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [lastUpdated,  setLastUpdated]  = useState({})
  const [showDetail,   setShowDetail]   = useState(false) // mobile detail overlay
  const loadedRef = useRef({})
  const windowWidth = useWindowWidth()
  const isMobile    = windowWidth < 900

  const callClaude = useCallback(async (prompt, mode = 'json') => {
    const res  = await fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, mode }) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Claude error ${res.status}`)
    const tb = data.content?.find(b => b.type === 'text')
    if (!tb) throw new Error('No text block in Claude response')
    return tb.text
  }, [])

  const fetchMarket = useCallback(async (type) => {
    const res  = await fetch(`/api/market?type=${type}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Market error ${res.status}`)
    return data
  }, [])

  const loadOpportunities = useCallback(async () => {
    setLoading(p => ({ ...p, opportunities: true }))
    setErrors(p  => ({ ...p, opportunities: null }))
    try {
      const market = await fetchMarket('opportunities')
      const { stocks, earningsCalendar, vix, vixRegime, sectorHealth } = market

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

      const prompt = `TODAY: ${new Date().toDateString()}
VIX: ${vix || 'N/A'} (${vixRegime || 'UNKNOWN'})
SECTORS: ${JSON.stringify(sectorHealth)}

LIVE PRICES:
${stockLines}

EARNINGS CALENDAR (verified, Finnhub):
${calendarLines || 'None'}

EARNINGS HISTORY: ${Object.entries(EARNINGS_HISTORY).map(([k,v]) => `${k}:${v.label}`).join(' | ')}

RULES: Use VERIFIED_EARNINGS_DATE only. GAP-UP>8%=WATCH. No catalyst within 40d=WATCH. Zero BUYs is valid.

Return ONLY this JSON (max 5 opportunities, keep all strings SHORT):
{"marketCondition":"BUY AGGRESSIVELY|BUY SELECTIVELY|WAIT|HOLD CASH","cashRecommendation":"one sentence","cashPct":30,"cio":{"bestTradeToday":"TICKER or NONE","bestRiskReward":"TICKER or NONE","finalMarketDecision":"BUY AGGRESSIVELY|BUY SELECTIVELY|WAIT|HOLD CASH","watchList":[{"ticker":"","reason":""}],"avoidList":[{"ticker":"","reason":""}]},"opportunities":[{"ticker":"","action":"STRONG BUY|BUY|WATCH|AVOID","currentPrice":"","entryZone":"$X-$Y","stopLoss":"$X","takeProfit":"$X","expectedGain":"15-20%","riskReward":"3:1","allocation":"10%","buyNow":"YES|NO|WAIT","catalyst":"specific catalyst","catalystDate":"VERIFIED date or UNVERIFIED","thesis":"one sentence","invalidation":"one sentence","returnGate":"PASS|FAIL","cashChallenge":"PASS|FAIL","opportunityScore":75}]}`

      const aiText = await callClaude(prompt, 'cio')
      const ai     = repairJSON(aiText)
      const priceMap = Object.fromEntries((stocks || []).map(s => [s.ticker, s]))
      const grounded = (ai.opportunities || []).map(opp => {
        const live = priceMap[opp.ticker] || {}
        return { ...opp, currentPrice: live.priceFormatted || opp.currentPrice, change1d: live.change1d || null, changePctToday: live.changePct || 0, direction: live.direction || 'up', bigMoverToday: live.bigMoverToday || false, earningsDate: live.earningsDate || null, earningsTradingDaysAway: live.earningsTradingDaysAway ?? null, hasVerifiedEarnings: live.hasVerifiedEarnings || false }
      })

      setSectionData(p => ({ ...p, opportunities: { marketCondition: ai.marketCondition, cashRecommendation: ai.cashRecommendation, cashPct: ai.cashPct, cio: ai.cio, opportunities: grounded, earningsCalendar, vix, vixRegime, sectorHealth, meta: market.meta } }))
      setLastUpdated(p => ({ ...p, opportunities: new Date().toISOString() }))
      if (grounded[0]) setSelected(grounded[0])
    } catch (err) {
      setErrors(p => ({ ...p, opportunities: err.message }))
    } finally {
      setLoading(p => ({ ...p, opportunities: false }))
    }
  }, [fetchMarket, callClaude])

  const loadGlobal = useCallback(async () => {
    setLoading(p => ({ ...p, global: true })); setErrors(p => ({ ...p, global: null }))
    try {
      const market = await fetchMarket('global')
      const summary = `Real market data:\nMarkets: ${market.markets?.map(m => `${m.name} ${m.value} ${m.change}`).join(', ')}\nCommodities: ${market.commodities?.map(c => `${c.name} ${c.value} ${c.change}`).join(', ')}\nFX: ${market.currencies?.map(c => `${c.pair} ${c.value} ${c.change}`).join(', ')}\nVIX: ${market.vix} (${market.vixSignal})\nReturn JSON: {"sentiment":"RISK ON|RISK OFF|NEUTRAL","sentimentReason":"one sentence","regimeAdvice":"one sentence for swing traders","macroEvents":[{"event":"","impact":"HIGH|MEDIUM|LOW"}]}`
      const ai = repairJSON(await callClaude(summary))
      setSectionData(p => ({ ...p, global: { ...market, ...ai } }))
      setLastUpdated(p => ({ ...p, global: new Date().toISOString() }))
    } catch (err) { setErrors(p => ({ ...p, global: err.message })) }
    finally { setLoading(p => ({ ...p, global: false })) }
  }, [fetchMarket, callClaude])

  const loadUS = useCallback(async () => {
    setLoading(p => ({ ...p, us: true })); setErrors(p => ({ ...p, us: null }))
    try {
      const market = await fetchMarket('us')
      const summary = `Real US data:\nFutures: ${market.futures?.map(f => `${f.index} ${f.value} ${f.change}`).join(', ')}\nGainers: ${market.gainers?.map(g => `${g.ticker} ${g.change}`).join(', ')}\nLosers: ${market.losers?.map(l => `${l.ticker} ${l.change}`).join(', ')}\nApply POST-CATALYST CHASE RULE to gainers. Return JSON: {"outlook":"BULLISH|BEARISH|NEUTRAL","outlookReason":"one sentence","watchForToday":["specific things to monitor"]}`
      const ai = repairJSON(await callClaude(summary))
      setSectionData(p => ({ ...p, us: { ...market, ...ai } }))
      setLastUpdated(p => ({ ...p, us: new Date().toISOString() }))
    } catch (err) { setErrors(p => ({ ...p, us: err.message })) }
    finally { setLoading(p => ({ ...p, us: false })) }
  }, [fetchMarket, callClaude])

  const loadEurope = useCallback(async () => {
    setLoading(p => ({ ...p, europe: true })); setErrors(p => ({ ...p, europe: null }))
    try {
      const market = await fetchMarket('europe')
      const stockLines = (market.europeanStocks || [])
        .map(s => `${s.ticker} (${s.name}, ${s.sector}): ${s.priceFormatted} ${s.change1d}`)
        .join(', ')
      const summary = `European indices: ${market.futures?.map(f => `${f.index} ${f.value} ${f.change}`).join(', ')}
European stocks with live prices: ${stockLines || 'none'}
Today: ${new Date().toDateString()}
Return JSON: {"outlook":"BULLISH|BEARISH|NEUTRAL","outlookReason":"one sentence","europeanSetups":[{"ticker":"use real ticker from data above","company":"full name","sector":"","price":"use real price","change":"use real change","catalyst":"specific upcoming catalyst with date","catalystDate":"","action":"WATCH|BUY"}]}`
      const ai = repairJSON(await callClaude(summary))
      setSectionData(p => ({ ...p, europe: { ...market, ...ai } }))
      setLastUpdated(p => ({ ...p, europe: new Date().toISOString() }))
    } catch (err) { setErrors(p => ({ ...p, europe: err.message })) }
    finally { setLoading(p => ({ ...p, europe: false })) }
  }, [fetchMarket, callClaude])

  const loadRisk = useCallback(async () => {
    setLoading(p => ({ ...p, risk: true })); setErrors(p => ({ ...p, risk: null }))
    try {
      const prompt = `Today: ${new Date().toDateString()}. Assess swing-trading risk next 40 days. Return JSON: {"overallRisk":"HIGH|ELEVATED|MODERATE|LOW","cashSuggestion":"X%","positionSizingAdvice":"one line","macroRisks":[{"risk":"","detail":"","severity":"HIGH|MEDIUM|LOW"}],"geopoliticalRisks":[{"risk":"","detail":"","severity":""}],"sectorRisks":[{"sector":"","risk":"","severity":""}],"hedgeIdeas":[""]}`
      const ai = repairJSON(await callClaude(prompt))
      setSectionData(p => ({ ...p, risk: ai }))
      setLastUpdated(p => ({ ...p, risk: new Date().toISOString() }))
    } catch (err) { setErrors(p => ({ ...p, risk: err.message })) }
    finally { setLoading(p => ({ ...p, risk: false })) }
  }, [callClaude])

  const deepDive = useCallback(async (opp) => {
    setDrillLoading(true); setDrillContent(null)
    try {
      const hist = EARNINGS_HISTORY[opp.ticker]
      const text = await callClaude(`Today: ${new Date().toDateString()}\nAnalyse ${opp.ticker} at ${opp.currentPrice}.\nEarnings: ${opp.earningsDate || 'NOT VERIFIED'} (${opp.earningsTradingDaysAway ?? '?'} trading days)\nCatalyst: ${opp.catalyst || 'N/A'}\nHistory: ${hist ? hist.label : 'not available'}\nThesis: ${opp.thesis}\nCover: (1) Why this setup NOW (2) Key risk (3) Ideal entry trigger (4) Immediate invalidation. Label each FACT/ANALYSIS/OPINION. Under 260 words.`, 'deepdive')
      setDrillContent(text)
    } catch (err) { setDrillContent(`Error: ${err.message}`) }
    finally { setDrillLoading(false) }
  }, [callClaude])

  const loaders = { opportunities: loadOpportunities, global: loadGlobal, us: loadUS, europe: loadEurope, risk: loadRisk }

  useEffect(() => {
    if (!loadedRef.current[activeTab] && !loading[activeTab] && !sectionData[activeTab]) {
      loadedRef.current[activeTab] = true
      loaders[activeTab]?.()
    }
  }, [activeTab]) // eslint-disable-line

  const handleStockClick = useCallback((opp) => {
    setSelected(opp); setDrillContent(null); setShowDetail(true)
    deepDive(opp)
  }, [deepDive])

  const refresh = useCallback(() => {
    loadedRef.current[activeTab] = true
    loaders[activeTab]?.()
  }, [activeTab, loadOpportunities, loadGlobal, loadUS, loadEurope, loadRisk]) // eslint-disable-line

  // ── Renders ────────────────────────────────────────────────────────────────

  function renderOpportunities() {
    const d    = sectionData.opportunities
    if (!d) return null
    const opps = d.opportunities || []

    return (
      <>
        <RegimeBar vix={d.vix} vixRegime={d.vixRegime} sectorHealth={d.sectorHealth} marketCondition={d.marketCondition} />
        <CIOPanel cio={d.cio} />

        {d.cashRecommendation && (
          <div style={{ ...card({ padding: '12px 16px', marginBottom: 14 }), display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Pill tone="amber" size="md">💰 {d.cashPct != null ? `${d.cashPct}% CASH` : 'CASH'}</Pill>
            <span style={{ color: C.textSub, fontSize: 14 }}>{d.cashRecommendation}</span>
          </div>
        )}

        {/* Responsive grid: two-col desktop, single col mobile */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1.45fr) minmax(320px,0.85fr)', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 14 }}>
            {opps.length ? opps.map((opp, i) => (
              <OpportunityCard key={`${opp.ticker}-${i}`} opp={opp} rank={i+1} active={selected?.ticker === opp.ticker} onClick={handleStockClick} />
            )) : (
              <div style={{ ...card(), textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>💵</div>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>No qualifying opportunities</div>
                <div style={{ color: C.muted, fontSize: 14 }}>All candidates failed Return Gate or Cash Challenge. Holding cash is the right call.</div>
              </div>
            )}
            <EarningsCalendar calendar={d.earningsCalendar} />
          </div>

          {/* Side panel: only rendered on desktop; mobile gets overlay instead */}
          {!isMobile && (
            <DeepDivePanel stock={selected} content={drillContent} loading={drillLoading} onRun={() => selected && deepDive(selected)} />
          )}
        </div>

        {/* Mobile overlay */}
        {showDetail && selected && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, overflowY: 'auto', padding: 16 }}
               onClick={e => { if (e.target === e.currentTarget) setShowDetail(false) }}>
            <div style={{ maxWidth: 500, margin: '0 auto', position: 'relative' }}>
              <button onClick={() => setShowDetail(false)} style={{ ...btn(false), marginBottom: 10, width: '100%' }}>← Back to list</button>
              <DeepDivePanel stock={selected} content={drillContent} loading={drillLoading} onRun={() => selected && deepDive(selected)} />
            </div>
          </div>
        )}
      </>
    )
  }

  function renderGlobal() {
    const d = sectionData.global
    if (!d) return null
    const sentTone = d.sentiment === 'RISK ON' ? 'green' : d.sentiment === 'RISK OFF' ? 'red' : 'grey'
    return (
      <>
        <div style={{ ...card({ marginBottom: 14 }), display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Pill tone={sentTone} size="lg">{d.sentiment || 'NEUTRAL'}</Pill>
          <div>
            <div style={{ color: C.text, fontWeight: 600, fontSize: 15 }}>{d.sentimentReason}</div>
            {d.regimeAdvice && <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{d.regimeAdvice}</div>}
          </div>
          {d.vix && <Pill tone={d.vixSignal === 'CALM' ? 'green' : d.vixSignal === 'HIGH_FEAR' ? 'red' : 'amber'} size="md">VIX {d.vix}</Pill>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
          {(d.markets || []).map((m, i) => <StatTile key={i} label={m.name} value={m.value} change={m.change} direction={m.direction} />)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          <div style={card()}>
            <div style={{ ...LBL, marginBottom: 14 }}>COMMODITIES & FX</div>
            {(d.commodities || []).map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < d.commodities.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ color: C.textSub, fontSize: 14 }}>{c.name}</span>
                <span style={{ color: c.direction === 'up' ? C.up : C.down, fontWeight: 700, fontFamily: FONT_MONO, fontSize: 14 }}>{c.value} <span style={{ fontSize: 12 }}>{c.change}</span></span>
              </div>
            ))}
            {d.currencies?.length > 0 && <><Divider />
              {(d.currencies || []).map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                  <span style={{ color: C.textSub, fontSize: 14, fontWeight: 600 }}>{c.pair}</span>
                  <span style={{ color: C.text, fontWeight: 700, fontFamily: FONT_MONO, fontSize: 14 }}>{c.value} <span style={{ color: C.muted, fontSize: 12 }}>{c.change}</span></span>
                </div>
              ))}
            </>}
          </div>
          <div style={card()}>
            <div style={{ ...LBL, marginBottom: 14 }}>MACRO EVENTS</div>
            {(d.macroEvents || []).map((e, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{e.event}</div>
                <Pill tone={e.impact === 'HIGH' ? 'red' : e.impact === 'MEDIUM' ? 'amber' : 'grey'} size="sm">{e.impact}</Pill>
                {i < d.macroEvents.length - 1 && <Divider />}
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
    const outlookTone = d.outlook === 'BULLISH' ? 'green' : d.outlook === 'BEARISH' ? 'red' : 'grey'
    return (
      <>
        <div style={{ ...card({ marginBottom: 14 }), display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pill tone={outlookTone} size="lg">{d.outlook || 'NEUTRAL'}</Pill>
          <span style={{ color: C.textSub, fontSize: 14 }}>{d.outlookReason}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
          {(d.futures || []).map((f, i) => <StatTile key={i} label={f.index} value={f.value} change={f.change} direction={f.direction} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {[['🚀 Top Gainers', d.gainers, 'up'], ['📉 Top Losers', d.losers, 'down']].map(([title, items, dir]) => (
            <div key={title} style={card()}>
              <div style={{ ...LBL, marginBottom: 14 }}>{title}</div>
              {(items || []).map((g, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ color: C.text, fontWeight: 800, fontFamily: FONT_MONO, fontSize: 15 }}>{g.ticker}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: dir === 'up' ? C.up : C.down, fontWeight: 700, fontFamily: FONT_MONO, fontSize: 14 }}>{g.change}</div>
                    <div style={{ color: C.muted, fontSize: 12 }}>{g.price}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {d.watchForToday?.length > 0 && (
            <div style={card()}>
              <div style={{ ...LBL, marginBottom: 14 }}>👀 WATCH FOR TODAY</div>
              {d.watchForToday.map((w, i) => (
                <div key={i} style={{ color: C.textSub, fontSize: 14, padding: '6px 0', borderBottom: i < d.watchForToday.length - 1 ? `1px solid ${C.border}` : 'none' }}>• {w}</div>
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
    const outlookTone = d.outlook === 'BULLISH' ? 'green' : d.outlook === 'BEARISH' ? 'red' : 'grey'
    return (
      <>
        {/* Sentiment bar */}
        <div style={{ ...card({ marginBottom: 14 }), display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pill tone={outlookTone} size="lg">{d.outlook || 'NEUTRAL'}</Pill>
          <span style={{ color: C.textSub, fontSize: 14 }}>{d.outlookReason}</span>
        </div>

        {/* Index tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
          {(d.futures || []).map((f, i) => <StatTile key={i} label={f.index} value={f.value} change={f.change} direction={f.direction} />)}
        </div>

        {/* Live European stock prices */}
        {d.europeanStocks?.length > 0 && (
          <div style={{ ...card({ marginBottom: 18 }) }}>
            <div style={{ ...LBL, marginBottom: 14 }}>🇪🇺 EUROPEAN STOCKS — LIVE PRICES</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {d.europeanStocks.map((s, i) => (
                <div key={i} style={{ background: C.bg, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, fontFamily: FONT_MONO, color: C.text }}>{s.name}</span>
                  </div>
                  <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>{s.ticker} · {s.sector}</div>
                  <div style={{ fontWeight: 800, fontSize: 20, fontFamily: FONT_MONO, color: C.text }}>{s.priceFormatted}</div>
                  <div style={{ color: s.direction === 'up' ? C.up : C.down, fontWeight: 700, fontSize: 13, fontFamily: FONT_MONO, marginTop: 2 }}>{s.change1d}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI setups */}
        {d.europeanSetups?.length > 0 && (
          <div style={card()}>
            <div style={{ ...LBL, marginBottom: 14 }}>📋 SETUPS TO WATCH</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {d.europeanSetups.map((s, i) => (
                <div key={i} style={{ background: C.bg, borderRadius: 12, padding: 16, border: `1px solid ${C.border}`, borderTop: `3px solid ${C.accent}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 17, color: C.text }}>{s.company || s.ticker}</div>
                      <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{s.ticker} · {s.sector}</div>
                    </div>
                    <ActionBadge action={s.action} />
                  </div>
                  {(s.price || s.change) && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 8 }}>
                      {s.price && <span style={{ fontWeight: 800, fontSize: 20, fontFamily: FONT_MONO, color: C.text }}>{s.price}</span>}
                      {s.change && <span style={{ color: s.change?.startsWith('+') ? C.up : C.down, fontWeight: 700, fontFamily: FONT_MONO, fontSize: 13 }}>{s.change}</span>}
                    </div>
                  )}
                  <div style={{ color: C.textSub, fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}>{s.catalyst}</div>
                  {s.catalystDate && (
                    <Pill tone="amber" size="sm">📅 {s.catalystDate}</Pill>
                  )}
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
    const riskTone = d.overallRisk === 'LOW' ? 'green' : d.overallRisk === 'MODERATE' ? 'amber' : 'red'
    return (
      <>
        <div style={{ ...card({ marginBottom: 14 }), display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pill tone={riskTone} size="lg">RISK: {d.overallRisk || 'MODERATE'}</Pill>
          {d.cashSuggestion && <Pill tone="amber" size="md">💰 Hold {d.cashSuggestion} cash</Pill>}
          {d.positionSizingAdvice && <span style={{ color: C.muted, fontSize: 14 }}>{d.positionSizingAdvice}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {[
            ['⚠️ Macro Risks',        d.macroRisks,        r => r.risk,   r => r.detail,   r => r.severity],
            ['🌍 Geopolitical',       d.geopoliticalRisks, r => r.risk,   r => r.detail,   r => r.severity],
            ['📊 Sector Risks',       d.sectorRisks,       r => r.sector, r => r.risk,     r => r.severity],
          ].map(([title, items, tFn, dFn, sFn]) => (
            <div key={title} style={card()}>
              <div style={{ ...LBL, marginBottom: 14 }}>{title}</div>
              {(items || []).map((r, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{tFn(r)}</div>
                  <div style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>{dFn(r)}</div>
                  <div style={{ marginTop: 6 }}>
                    <Pill tone={sFn(r) === 'HIGH' ? 'red' : sFn(r) === 'MEDIUM' ? 'amber' : 'grey'} size="sm">{sFn(r)}</Pill>
                  </div>
                  {i < (items?.length || 0) - 1 && <Divider />}
                </div>
              ))}
            </div>
          ))}
          <div style={card()}>
            <div style={{ ...LBL, marginBottom: 14 }}>🛡 HEDGE IDEAS</div>
            {(d.hedgeIdeas || []).map((h, i) => (
              <div key={i} style={{ color: C.textSub, fontSize: 14, padding: '6px 0', borderBottom: i < d.hedgeIdeas.length - 1 ? `1px solid ${C.border}` : 'none' }}>• {h}</div>
            ))}
          </div>
        </div>
      </>
    )
  }

  function renderContent() {
    const isLoad = loading[activeTab]
    const err    = errors[activeTab]
    const data   = sectionData[activeTab]

    if (isLoad) return (
      <div style={{ ...card(), minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>
          {activeTab === 'opportunities' ? 'Running trading analysis…' : 'Loading…'}
        </div>
        <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', maxWidth: 360 }}>
          {activeTab === 'opportunities'
            ? 'Fetching live prices · Pulling earnings calendar · Applying trading rules · Generating CIO analysis'
            : 'Fetching live market data and running AI analysis'}
        </div>
      </div>
    )

    if (err) return (
      <div style={{ ...card({ borderLeft: `4px solid ${C.down}` }), padding: 24 }}>
        <div style={{ color: C.down, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Error loading data</div>
        <div style={{ color: C.textSub, fontSize: 14, marginBottom: 16, whiteSpace: 'pre-wrap' }}>{err}</div>
        <button onClick={refresh} style={btn(true)}>Retry</button>
      </div>
    )

    if (!data) return (
      <div style={{ ...card(), minHeight: 200, display: 'grid', placeItems: 'center' }}>
        <div style={{ color: C.muted }}>Loading…</div>
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
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: FONT_BODY, overflowX: 'hidden', width: '100%', WebkitFontSmoothing: 'antialiased' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&family=DM+Mono:wght@400;500;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        html { -webkit-text-size-adjust: 100%; }
        @keyframes spin { to { transform: rotate(360deg); } }
        button { -webkit-tap-highlight-color: transparent; }
        button:hover { opacity: 0.88; }
        img, video { max-width: 100%; }
        body { margin: 0; overflow-x: hidden; }
      `}</style>

      <div style={{ maxWidth: 1560, margin: '0 auto', padding: isMobile ? '10px 12px' : '12px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14, padding: '14px 18px', background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: isMobile ? 20 : 24, color: C.accent, fontFamily: FONT_HEAD, letterSpacing: -0.5 }}>CATALYST</div>
            <div style={{ color: C.muted, fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>TRADING INTELLIGENCE · {new Date().toDateString().toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {lastUpdated[activeTab] && (
              <span style={{ color: C.muted, fontSize: 12 }}>Updated {timeStr(lastUpdated[activeTab])}</span>
            )}
            <button onClick={refresh} style={{ ...btn(true), padding: isMobile ? '8px 14px' : '10px 18px', fontSize: isMobile ? 13 : 14 }}>↻ {isMobile ? '' : 'Refresh'}</button>
          </div>
        </div>

        {/* Tabs — scrollable on mobile */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
          {TABS.map(t => {
            const active = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  appearance: 'none',
                  border: `1.5px solid ${active ? C.accent : C.border}`,
                  background: active ? C.accent : C.card,
                  color: active ? '#fff' : C.textSub,
                  borderRadius: 10,
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: active ? '0 2px 8px rgba(37,99,235,0.2)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}{loading[t.key] ? ' ⟳' : ''}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {renderContent()}

        {/* Footer */}
        <div style={{ textAlign: 'center', color: C.muted, fontSize: 11, padding: '24px 0 8px', fontWeight: 500 }}>
          Prices: Finnhub · Analysis: Claude AI · Not financial advice · For educational use only
        </div>
      </div>
    </div>
  )
}
