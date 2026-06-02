'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

// ─── Responsive hook ──────────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const h = () => setW(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return w
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:       '#f4f6fb',
  card:     '#ffffff',
  border:   '#e3e8f0',
  text:     '#0f172a',
  sub:      '#334155',
  muted:    '#64748b',
  up:       '#16a34a',
  down:     '#dc2626',
  accent:   '#2563eb',
  amber:    '#d97706',
  purple:   '#7c3aed',
  gold:     '#b45309',
  upBg:     '#dcfce7',
  downBg:   '#fee2e2',
  accentBg: '#dbeafe',
  amberBg:  '#fef3c7',
  purpleBg: '#ede9fe',
  goldBg:   '#fef9c3',
}

const FB = `'DM Sans', system-ui, sans-serif`
const FM = `'DM Mono', 'JetBrains Mono', monospace`

// ─── Universe + history ───────────────────────────────────────────────────────
// ── TRADING UNIVERSE ─────────────────────────────────────────────────────────
// Edit freely — add/remove tickers here and in market-route.js UNIVERSE array
const UNIVERSE = [
  // AI silicon / semiconductors
  'NVDA','AMD','AVGO','TSM','MRVL','ARM','INTC','QCOM',
  // Networking / AI infra
  'ANET','CIEN','CRDO',
  // Big tech / AI software
  'MSFT','GOOGL','META','PLTR','NOW',
  // Servers / storage
  'DELL','SMCI','HPE',
  // Cybersecurity
  'CRWD','PANW','ZS','S',
  // Defence / aerospace
  'LMT','RTX','NOC','AXON','HII','GD','BA',
  // Space / drones / autonomy
  'RKLB','LUNR','ACHR','JOBY',
  // Power / grid / nuclear
  'VRT','ETN','CEG','VST','GEV','NRG',
  // Clean energy / solar
  'FSLR','ENPH',
  // Critical minerals / supply chain
  'FCX','MP','CCJ',
]

// ── EARNINGS REACTION HISTORY ─────────────────────────────────────────────────
// Update after each earnings season — this is your Return Gate evidence
// avg = average 1-day move after earnings (last 4 quarters), beats = quarters beat out of 4
const EH = {
  // AI silicon
  NVDA:  { avg: 14.2, beats: 4, label: '14.2% avg · 4/4 beats' },
  AMD:   { avg: 9.8,  beats: 3, label: '9.8% avg · 3/4 beats' },
  AVGO:  { avg: 11.4, beats: 4, label: '11.4% avg · 4/4 beats' },
  MRVL:  { avg: 16.2, beats: 4, label: '16.2% avg · 4/4 beats' },
  ARM:   { avg: 12.8, beats: 3, label: '12.8% avg · 3/4 beats' },
  QCOM:  { avg: 7.4,  beats: 3, label: '7.4% avg · 3/4 beats' },
  // Networking
  ANET:  { avg: 9.2,  beats: 4, label: '9.2% avg · 4/4 beats' },
  CRDO:  { avg: 19.8, beats: 3, label: '19.8% avg · 3/4 beats' },
  // Big tech
  MSFT:  { avg: 4.8,  beats: 4, label: '4.8% avg · 4/4 beats — below 15% gate' },
  GOOGL: { avg: 7.2,  beats: 3, label: '7.2% avg · 3/4 beats' },
  META:  { avg: 11.2, beats: 4, label: '11.2% avg · 4/4 beats' },
  PLTR:  { avg: 18.4, beats: 4, label: '18.4% avg · 4/4 beats' },
  NOW:   { avg: 12.1, beats: 4, label: '12.1% avg · 4/4 beats' },
  // Servers
  DELL:  { avg: 13.6, beats: 3, label: '13.6% avg · 3/4 beats' },
  SMCI:  { avg: 21.4, beats: 3, label: '21.4% avg · 3/4 beats' },
  // Cyber
  CRWD:  { avg: 13.1, beats: 4, label: '13.1% avg · 4/4 beats' },
  PANW:  { avg: 8.6,  beats: 3, label: '8.6% avg · 3/4 beats' },
  ZS:    { avg: 11.8, beats: 4, label: '11.8% avg · 4/4 beats' },
  // Defence
  LMT:   { avg: 4.2,  beats: 3, label: '4.2% avg · 3/4 beats — low volatility' },
  RTX:   { avg: 5.1,  beats: 4, label: '5.1% avg · 4/4 beats — low volatility' },
  NOC:   { avg: 4.8,  beats: 3, label: '4.8% avg · 3/4 beats' },
  AXON:  { avg: 14.7, beats: 4, label: '14.7% avg · 4/4 beats' },
  // Space / drones
  RKLB:  { avg: 22.0, beats: 3, label: '22.0% avg · 3/4 beats' },
  // Power / grid
  VRT:   { avg: 15.8, beats: 4, label: '15.8% avg · 4/4 beats' },
  ETN:   { avg: 6.8,  beats: 4, label: '6.8% avg · 4/4 beats' },
  GEV:   { avg: 18.2, beats: 3, label: '18.2% avg · 3/4 beats' },
  // Nuclear
  CEG:   { avg: 8.4,  beats: 3, label: '8.4% avg · 3/4 beats' },
  VST:   { avg: 11.6, beats: 3, label: '11.6% avg · 3/4 beats' },
  // Solar
  FSLR:  { avg: 12.3, beats: 3, label: '12.3% avg · 3/4 beats' },
  // Critical minerals
  FCX:   { avg: 7.8,  beats: 3, label: '7.8% avg · 3/4 beats' },
  CCJ:   { avg: 9.4,  beats: 3, label: '9.4% avg · 3/4 beats' },
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function repairJSON(str) {
  if (!str) throw new Error('Empty AI response')
  let s = str.replace(/```json|```/g, '').trim()
  const i = s.indexOf('{')
  if (i === -1) throw new Error(`No JSON found: "${s.slice(0,80)}"`)
  s = s.slice(i)
  try { return JSON.parse(s) } catch {}
  const opens = []; let inStr = false, esc = false
  for (let j = 0; j < s.length; j++) {
    const c = s[j]
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
    throw new Error(`Cannot parse AI JSON: "${s.slice(0,120)}"`)
  }
}

function ts(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) } catch { return '—' }
}

// UK date format: "29 Jul 2026"
function ukDate(isoStr) {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr + (isoStr.length === 10 ? 'T12:00:00' : ''))
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
  } catch { return isoStr }
}

// ─── Style primitives ─────────────────────────────────────────────────────────
const card  = (x={}) => ({ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.05)', ...x })
const LBL   = { color:C.muted, fontSize:11, fontWeight:600, fontFamily:FB, letterSpacing:0.8, textTransform:'uppercase', marginBottom:4 }
const VAL   = { color:C.text, fontWeight:700, fontFamily:FB }
const DIV   = () => <div style={{ height:1, background:C.border, margin:'12px 0' }} />

// Pill component
const TONES = {
  green:  [C.up,     C.upBg],
  red:    [C.down,   C.downBg],
  blue:   [C.accent, C.accentBg],
  amber:  [C.amber,  C.amberBg],
  purple: [C.purple, C.purpleBg],
  gold:   [C.gold,   C.goldBg],
  grey:   [C.muted,  '#f1f5f9'],
}
function Pill({ tone='grey', size='sm', children, style={} }) {
  const [color, bg] = TONES[tone] || TONES.grey
  const p = size==='lg' ? '7px 16px' : size==='md' ? '5px 12px' : '3px 9px'
  const fs = size==='lg' ? 14 : size==='md' ? 12 : 11
  return <span style={{ display:'inline-flex', alignItems:'center', padding:p, borderRadius:999, background:bg, color, fontSize:fs, fontWeight:700, fontFamily:FB, whiteSpace:'nowrap', ...style }}>{children}</span>
}

function ActionBadge({ action, size='md' }) {
  const t = { 'STRONG BUY':'green', 'BUY':'blue', 'WATCH':'amber', 'AVOID':'red' }
  return <Pill tone={t[action]||'grey'} size={size}>{action||'WATCH'}</Pill>
}

function GateBadge({ label, pass }) {
  const t = pass===true ? 'green' : pass===false ? 'red' : 'amber'
  const i = pass===true ? '✓' : pass===false ? '✗' : '~'
  return <Pill tone={t} size="sm">{i} {label}</Pill>
}

function ScoreBar({ score }) {
  const pct   = Math.min(score, 100)
  const color = score>=80 ? C.up : score>=70 ? C.accent : score>=60 ? C.amber : C.down
  const bg    = score>=80 ? C.upBg : score>=70 ? C.accentBg : score>=60 ? C.amberBg : C.downBg
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ flex:1, height:8, background:bg, borderRadius:4, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:4, transition:'width 0.5s ease' }} />
      </div>
      <span style={{ color, fontWeight:800, fontFamily:FM, fontSize:15, minWidth:28 }}>{score}</span>
    </div>
  )
}

// ─── Opportunity card ─────────────────────────────────────────────────────────
function OppCard({ opp, rank, active, onClick, onDeepDive, deepDiveLoading, deepDiveContent }) {
  const hist    = EH[opp.ticker]
  const gapUp   = opp.bigMoverToday && Math.abs(opp.changePctToday||0) > 8
  const isBuy   = opp.action==='BUY'||opp.action==='STRONG BUY'
  const earTone = (opp.earningsTradingDaysAway??999)<=3 ? 'red' : (opp.earningsTradingDaysAway??999)<=10 ? 'amber' : 'blue'
  const [showDive, setShowDive] = useState(false)

  const handleDeepDive = (e) => {
    e.stopPropagation()
    setShowDive(true)
    onDeepDive(opp)
  }

  return (
    <div onClick={() => onClick(opp)} style={{
      ...card({ textAlign:'left', cursor:'pointer', width:'100%',
        borderLeft:`5px solid ${isBuy ? C.up : opp.action==='WATCH' ? C.amber : C.border}`,
        background: active ? '#f0f7ff' : C.card,
        boxShadow: active ? `0 0 0 2px ${C.accent}44` : '0 1px 4px rgba(0,0,0,0.05)',
        transition:'all 0.15s',
      }),
    }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ color:C.muted, fontSize:13 }}>#{rank}</span>
          <span style={{ color:C.text, fontFamily:FM, fontWeight:900, fontSize:26 }}>{opp.ticker}</span>
          <span style={{ color:C.muted, fontSize:13 }}>{opp.company}</span>
          {opp.earningsDate && opp.earningsTradingDaysAway >= 0 && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:5, background: earTone==='red' ? '#fee2e2' : earTone==='amber' ? '#fef3c7' : '#dbeafe', color: earTone==='red' ? '#dc2626' : earTone==='amber' ? '#d97706' : '#2563eb', borderRadius:8, padding:'5px 12px', fontWeight:800, fontSize:13, fontFamily:FM }}>
              📅 {opp.earningsTradingDaysAway===0 ? 'TODAY' : `${opp.earningsTradingDaysAway}d`} · {ukDate(opp.earningsDate)}
              {opp.earningsSource==='estimate' && <span style={{ fontSize:10, fontWeight:600, opacity:0.8 }}> (est)</span>}
            </span>
          )}
          {gapUp && <Pill tone="amber" size="sm">⚠ GAP UP</Pill>}
        </div>
        <ActionBadge action={opp.action} size="lg" />
      </div>

      {/* Price */}
      <div style={{ display:'flex', gap:12, alignItems:'baseline', marginBottom:12, flexWrap:'wrap' }}>
        <span style={{ color:C.text, fontFamily:FM, fontWeight:900, fontSize:30 }}>{opp.currentPrice||'—'}</span>
        {opp.change1d && <span style={{ color:opp.direction==='up'?C.up:C.down, fontFamily:FM, fontWeight:700, fontSize:15 }}>{opp.change1d}</span>}
        {opp.expectedGain && <span style={{ color:C.gold, fontWeight:700, fontSize:14 }}>🎯 {opp.expectedGain}</span>}
      </div>

      {/* Thesis */}
      <p style={{ color:C.sub, fontSize:14, lineHeight:1.6, margin:'0 0 12px 0' }}>{opp.thesis||'—'}</p>

      {/* Gates */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
        <GateBadge label="RETURN GATE"    pass={opp.returnGate==='PASS'?true:opp.returnGate==='FAIL'?false:null} />
        <GateBadge label="CASH CHALLENGE" pass={opp.cashChallenge==='PASS'?true:opp.cashChallenge==='FAIL'?false:null} />
        <Pill tone="green" size="sm">✓ LIVE PRICE</Pill>
      </div>

      {/* Trade details */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:12 }}>
        {[['Catalyst', opp.catalyst], ['Date', opp.catalystDate||opp.earningsDate], ['Entry', opp.entryZone], ['Stop Loss', opp.stopLoss], ['R/R', opp.riskReward], ['Allocation', opp.allocation]].map(([l,v]) => v ? (
          <div key={l}>
            <div style={LBL}>{l}</div>
            <div style={{ ...VAL, fontSize:14 }}>{v}</div>
          </div>
        ) : null)}
      </div>

      {/* Earnings history */}
      {hist && <Pill tone="purple" size="sm">📊 {hist.label}</Pill>}

      {/* Score */}
      {opp.opportunityScore != null && (
        <div style={{ marginTop:14 }}>
          <div style={LBL}>OPPORTUNITY SCORE</div>
          <ScoreBar score={opp.opportunityScore} />
        </div>
      )}

      {/* Per-card deep dive */}
      <div style={{ marginTop:14, borderTop:`1px solid ${C.border}`, paddingTop:14 }} onClick={e => e.stopPropagation()}>
        {!showDive ? (
          <button onClick={handleDeepDive} style={{ appearance:'none', background:C.accentBg, color:C.accent, border:`1px solid ${C.accent}44`, borderRadius:8, padding:'8px 16px', fontWeight:700, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            🔍 Deep dive analysis
          </button>
        ) : deepDiveLoading ? (
          <div style={{ color:C.muted, fontSize:13, padding:'8px 0' }}>Analysing {opp.ticker}…</div>
        ) : deepDiveContent ? (
          <div style={{ color:C.sub, fontSize:13, lineHeight:1.75, whiteSpace:'pre-wrap', background:C.bg, borderRadius:10, padding:14 }}>{deepDiveContent}</div>
        ) : null}
      </div>
    </div>
  )
}

// ─── Earnings calendar ────────────────────────────────────────────────────────
function EarningsCal({ calendar }) {
  if (!calendar?.length) return null
  const items = calendar.filter(e => (e.tradingDaysAway??-1) >= 0).slice(0,12)
  if (!items.length) return null
  return (
    <div style={{ ...card({ marginTop:18 }) }}>
      <div style={{ ...LBL, marginBottom:14 }}>📅 EARNINGS CALENDAR — NEXT 60 DAYS</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px,1fr))', gap:10 }}>
        {items.map((e,i) => {
          const t = e.tradingDaysAway<=3?'red':e.tradingDaysAway<=10?'amber':'blue'
          const hist = EH[e.ticker]
          return (
            <div key={i} style={{ ...card({ padding:12, borderTop:`3px solid ${TONES[t][0]}` }) }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <span style={{ fontFamily:FM, fontWeight:800, fontSize:17, color:C.text }}>{e.ticker}</span>
                <Pill tone={t} size="sm">{e.tradingDaysAway===0?'TODAY':`${e.tradingDaysAway}d`}</Pill>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ color:C.sub, fontSize:13, fontWeight:700 }}>{ukDate(e.date)}</span>
                {e.source==='estimate' && <span style={{ background:C.amberBg, color:C.amber, fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:4 }}>EST</span>}
              </div>
              {hist && <div style={{ color:C.purple, fontSize:11, fontWeight:600, marginTop:4 }}>{hist.label}</div>}
              {e.epsEstimate!=null && <div style={{ color:C.muted, fontSize:11, marginTop:2 }}>EPS est: ${e.epsEstimate}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── CIO summary ──────────────────────────────────────────────────────────────
function CIOPanel({ cio, isMobile }) {
  if (!cio) return null
  const cells = [
    ['Best Trade Today',   cio.bestTradeToday,      'green'],
    ['Best Risk/Reward',   cio.bestRiskReward,       'blue'],
    ['Final Decision',     cio.finalMarketDecision,  'amber'],
  ].filter(([,v]) => v)

  return (
    <div style={{ ...card({ marginBottom:14, borderLeft:`4px solid ${C.gold}` }) }}>
      <div style={{ color:C.gold, fontWeight:800, fontSize:13, letterSpacing:0.5, marginBottom:14 }}>⚡ CIO CALLS</div>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(auto-fit,minmax(130px,1fr))`, gap:10, marginBottom:14 }}>
        {cells.map(([l,v,tone]) => (
          <div key={l} style={{ background:C.bg, borderRadius:10, padding:'10px 12px' }}>
            <div style={LBL}>{l}</div>
            <div style={{ color:TONES[tone][0], fontWeight:800, fontSize:16 }}>{v}</div>
          </div>
        ))}
      </div>
      {cio.watchList?.length > 0 && (
        <div style={{ marginBottom:10 }}>
          <div style={{ ...LBL, marginBottom:8 }}>WATCH</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {cio.watchList.map((w,i) => <Pill key={i} tone="amber" size="sm">{w.ticker||w}{w.reason?` — ${w.reason}`:''}</Pill>)}
          </div>
        </div>
      )}
      {cio.avoidList?.length > 0 && (
        <div>
          <div style={{ ...LBL, marginBottom:8 }}>AVOID</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {cio.avoidList.map((w,i) => <Pill key={i} tone="red" size="sm">{w.ticker||w}{w.reason?` — ${w.reason}`:''}</Pill>)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ stock, content, loading, onRun }) {
  return (
    <div style={{ ...card({ position:'sticky', top:16 }) }}>
      <div style={{ ...LBL, marginBottom:14 }}>SELECTED SETUP</div>
      {stock ? (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
            <div>
              <div style={{ fontFamily:FM, fontWeight:900, fontSize:28, color:C.text }}>{stock.ticker}</div>
              <div style={{ color:C.muted, fontSize:13 }}>{stock.company}</div>
            </div>
            <ActionBadge action={stock.action} size="lg" />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            {[['Live Price', stock.currentPrice], ['Target', stock.takeProfit||stock.expectedGain], ['Stop Loss', stock.stopLoss], ['R/R', stock.riskReward], ['Entry', stock.entryZone], ['Allocation', stock.allocation]].map(([l,v]) => v ? (
              <div key={l} style={{ background:C.bg, borderRadius:10, padding:'10px 12px' }}>
                <div style={LBL}>{l}</div>
                <div style={{ ...VAL, fontSize:14 }}>{v}</div>
              </div>
            ) : null)}
          </div>

          {stock.earningsDate && (
            <div style={{ background:C.amberBg, borderRadius:10, padding:'10px 14px', marginBottom:10 }}>
              <div style={LBL}>EARNINGS DATE{stock.earningsSource==='estimate'?' (EST)':' (VERIFIED)'}</div>
              <div style={{ color:C.amber, fontWeight:900, fontSize:18, fontFamily:FM }}>
                {ukDate(stock.earningsDate)}
              </div>
              <div style={{ color:C.amber, fontSize:13, marginTop:2 }}>
                {stock.earningsTradingDaysAway} trading days away
              </div>
            </div>
          )}

          {stock.catalyst && (
            <div style={{ marginBottom:10 }}>
              <div style={LBL}>CATALYST</div>
              <div style={{ ...VAL, fontSize:14 }}>{stock.catalyst}</div>
            </div>
          )}

          {stock.invalidation && (
            <div style={{ background:C.downBg, borderRadius:10, padding:'10px 14px', marginBottom:14 }}>
              <div style={LBL}>INVALIDATION</div>
              <div style={{ color:C.down, fontSize:13, fontWeight:600 }}>{stock.invalidation}</div>
            </div>
          )}

          <DIV />
          <div style={{ ...LBL, marginBottom:10 }}>DEEP DIVE ANALYSIS</div>
          {loading
            ? <div style={{ color:C.muted, fontSize:13 }}>Analysing {stock.ticker}…</div>
            : content
              ? <div style={{ color:C.sub, fontSize:14, lineHeight:1.75, whiteSpace:'pre-wrap' }}>{content}</div>
              : <button onClick={onRun} style={{ appearance:'none', background:C.accent, color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontWeight:700, fontSize:14, cursor:'pointer' }}>▶ Run deep dive</button>
          }
        </>
      ) : (
        <div style={{ color:C.muted, fontSize:14 }}>Tap an opportunity to see details.</div>
      )}
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key:'opportunities', label:'⚡ Opportunities' },
  { key:'global',        label:'🌍 Global Macro' },
  { key:'risk',          label:'⚠️ Risk' },
]

// ─── Main component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab,   setActiveTab]   = useState('opportunities')
  const [data,        setData]        = useState({})
  const [loading,     setLoading]     = useState({})
  const [errors,      setErrors]      = useState({})
  const [selected,    setSelected]    = useState(null)
  const [drill,       setDrill]       = useState(null)
  const [drillLoad,   setDrillLoad]   = useState(false)
  const [lastUp,      setLastUp]      = useState({})
  const [showOverlay, setShowOverlay] = useState(false)
  const loaded = useRef({})
  const w = useWindowWidth()
  const mob = w < 900

  // ── API helpers ────────────────────────────────────────────────────────────
  const claude = useCallback(async (prompt, mode='json') => {
    const r = await fetch('/api/claude', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({prompt,mode}) })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error||`Claude ${r.status}`)
    const tb = d.content?.find(b => b.type==='text')
    if (!tb) throw new Error('No text in Claude response')
    return tb.text
  }, [])

  const market = useCallback(async (type) => {
    const r = await fetch(`/api/market?type=${type}`, { cache:'no-store' })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error||`Market ${r.status}`)
    return d
  }, [])

  // ── Opportunities ──────────────────────────────────────────────────────────
  const loadOpps = useCallback(async () => {
    setLoading(p=>({...p,opportunities:true}))
    setErrors(p=>({...p,opportunities:null}))
    try {
      const md = await market('opportunities')
      const { stocks, earningsCalendar, vix, vixRegime, sectors } = md

      // Build stock lines for prompt
      const stockLines = (stocks||[]).map(s => {
        const hist = EH[s.ticker]
        const parts = [
          `${s.ticker} (${s.name}): price=${s.priceFormatted} change=${s.change1d}`,
          s.hasVerifiedEarnings
            ? `EARNINGS=${s.earningsDate} in_${s.earningsTradingDaysAway}_trading_days${s.earningsSource==='estimate'?' [EST]':' [VERIFIED]'}${s.epsEstimate?` EPS_est=$${s.epsEstimate}`:''}`
            : 'NO_EARNINGS_DATE_IN_WINDOW',
          s.bigMoverToday ? 'BIG_MOVER_TODAY — apply Gap-Up Penalty if >8%' : '',
          hist ? `HIST: ${hist.label}` : '',
        ]
        return parts.filter(Boolean).join(' | ')
      }).join('\n')

      const sectorLines = (sectors||[]).map(s=>`${s.label}: ${s.change} (${s.direction})`).join(', ')

      const calLines = (earningsCalendar||[]).slice(0,15).map(e =>
        `${e.ticker} → ${e.date} (${e.tradingDaysAway}d)${e.epsEstimate?` EPS_est=$${e.epsEstimate}`:''}${e.source==='estimate'?' [EST]':' [VERIFIED]'}`
      ).join('\n')

      const prompt = `TODAY: ${new Date().toDateString()}
VIX PROXY: ${vix||'N/A'} → REGIME: ${vixRegime||'UNKNOWN'}
SECTORS TODAY: ${sectorLines||'N/A'}

LIVE PRICES (source: Finnhub):
${stockLines}

VERIFIED EARNINGS CALENDAR:
${calLines||'None found'}

EARNINGS REACTION HISTORY:
${Object.entries(EH).map(([k,v])=>`${k}: ${v.label}`).join(' | ')}

MANDATORY RULES — apply every time, no exceptions:
1. ONLY use earnings dates marked [VERIFIED] or [EST] above — never invent dates
2. GAP-UP PENALTY: stock up >8% today → maximum rating WATCH (not BUY)
3. POST-CATALYST CHASE: catalyst already occurred + stock up >15% → maximum rating WATCH
4. RETURN GATE: must prove a credible 15%+ path within 40 trading days
5. CASH CHALLENGE: must justify why this beats holding cash
6. No dated catalyst within 40 trading days → maximum rating WATCH
7. Zero BUY recommendations is correct when nothing qualifies — do not manufacture trades
8. Stocks with earnings in 0-10 days are highest priority for BUY consideration
9. High-fear VIX (>25): reduce all position sizes, increase cash recommendation
10. Keep all string values SHORT — max 15 words per field

Return ONLY this JSON (max 5 opportunities):
{"marketCondition":"BUY AGGRESSIVELY|BUY SELECTIVELY|WAIT|HOLD CASH","cashRecommendation":"one sentence","cashPct":30,"regime":"one sentence on market regime","cio":{"bestTradeToday":"TICKER or NONE","bestRiskReward":"TICKER or NONE","finalMarketDecision":"BUY AGGRESSIVELY|BUY SELECTIVELY|WAIT|HOLD CASH","watchList":[{"ticker":"","reason":"max 8 words"}],"avoidList":[{"ticker":"","reason":"max 8 words"}]},"opportunities":[{"ticker":"","company":"","action":"STRONG BUY|BUY|WATCH|AVOID","currentPrice":"","entryZone":"$X-$Y","stopLoss":"$X","takeProfit":"$X","expectedGain":"15-20%","riskReward":"3:1","allocation":"10%","catalyst":"max 12 words","catalystDate":"VERIFIED/EST date or UNVERIFIED","thesis":"max 15 words","invalidation":"max 12 words","returnGate":"PASS|CONDITIONAL PASS|FAIL","cashChallenge":"PASS|FAIL","opportunityScore":75}]}`

      const ai = repairJSON(await claude(prompt, 'cio'))

      // Ground all prices with verified live data
      const pm = Object.fromEntries((stocks||[]).map(s=>[s.ticker,s]))
      const grounded = (ai.opportunities||[]).map(o => {
        const live = pm[o.ticker]||{}
        return {
          ...o,
          company:                 live.name || o.company || o.ticker,
          currentPrice:            live.priceFormatted || o.currentPrice,
          change1d:                live.change1d || null,
          changePctToday:          live.changePct || 0,
          direction:               live.direction || 'up',
          bigMoverToday:           live.bigMoverToday || false,
          earningsDate:            live.earningsDate || null,
          earningsTradingDaysAway: live.earningsTradingDaysAway ?? null,
          earningsSource:          live.earningsSource || null,
          hasVerifiedEarnings:     live.hasVerifiedEarnings || false,
        }
      })

      setData(p=>({...p, opportunities:{ ...ai, opportunities:grounded, earningsCalendar, vix, vixRegime, sectors, meta:md.meta }}))
      setLastUp(p=>({...p, opportunities:new Date().toISOString()}))
      if (grounded[0]) setSelected(grounded[0])
    } catch(e) {
      setErrors(p=>({...p,opportunities:e.message}))
    } finally {
      setLoading(p=>({...p,opportunities:false}))
    }
  }, [market, claude])

  // ── Global macro ───────────────────────────────────────────────────────────
  const loadGlobal = useCallback(async () => {
    setLoading(p=>({...p,global:true})); setErrors(p=>({...p,global:null}))
    try {
      const md = await market('global')
      const idxLines  = md.indices?.map(m=>`${m.name} ${m.value} ${m.change}`).join(', ')
      const secLines  = md.sectors?.map(s=>`${s.label} ${s.change}`).join(', ')
      const commLines = md.commodities?.map(c=>`${c.name} ${c.value} ${c.change}`).join(', ')
      const fxLines   = md.currencies?.map(c=>`${c.pair} ${c.value} ${c.change}`).join(', ')

      const prompt = `Today: ${new Date().toDateString()}
Global indices: ${idxLines||'N/A'}
Sector performance: ${secLines||'N/A'}
Commodities: ${commLines||'N/A'}
FX: ${fxLines||'N/A'}
VIX proxy: ${md.vix||'N/A'} (${md.vixRegime||'N/A'})

You are a swing trader's macro analyst. Based ONLY on the data above, return JSON:
{"sentiment":"RISK ON|RISK OFF|NEUTRAL","sentimentReason":"one sentence — cite specific data","regimeAdvice":"one actionable sentence for a swing trader","keyRisk":"biggest macro risk right now in one sentence","keyOpportunity":"biggest macro tailwind in one sentence","macroEvents":[{"event":"","detail":"one sentence","impact":"HIGH|MEDIUM|LOW"}]}`

      const ai = repairJSON(await claude(prompt))
      setData(p=>({...p, global:{ ...md, ...ai }}))
      setLastUp(p=>({...p, global:new Date().toISOString()}))
    } catch(e) { setErrors(p=>({...p,global:e.message})) }
    finally { setLoading(p=>({...p,global:false})) }
  }, [market, claude])

  // ── Risk ───────────────────────────────────────────────────────────────────
  const loadRisk = useCallback(async () => {
    setLoading(p=>({...p,risk:true})); setErrors(p=>({...p,risk:null}))
    try {
      // Fetch VIX and sectors to ground the risk assessment in real data
      const md = await market('global')
      const prompt = `Today: ${new Date().toDateString()}
VIX proxy: ${md.vix||'N/A'} (${md.vixRegime||'N/A'})
S&P 500 today: ${md.indices?.find(i=>i.name==='S&P 500')?.change||'N/A'}
NASDAQ today: ${md.indices?.find(i=>i.name==='NASDAQ 100')?.change||'N/A'}
Sector performance today: ${md.sectors?.map(s=>`${s.label} ${s.change}`).join(', ')||'N/A'}
Gold: ${md.commodities?.find(c=>c.name?.includes('Gold'))?.change||'N/A'}

You are a risk manager for a swing trader with 1-4 week holding periods.
Using the live data above plus your knowledge, assess risk for the next 40 trading days.
Be specific — name actual upcoming events, known policy decisions, earnings seasons.
Return JSON:
{"overallRisk":"HIGH|ELEVATED|MODERATE|LOW","cashSuggestion":"X%","positionSizingAdvice":"one actionable sentence","macroRisks":[{"risk":"","detail":"specific — name dates/events","severity":"HIGH|MEDIUM|LOW","action":"what to do"}],"geopoliticalRisks":[{"risk":"","detail":"","severity":"","action":""}],"sectorRisks":[{"sector":"","risk":"","severity":"","action":""}],"hedgeIdeas":["specific hedge with rationale"],"bestEnvironmentFor":["type of trade that works best now"]}`

      const ai = repairJSON(await claude(prompt))
      setData(p=>({...p, risk:{ ...ai, vix:md.vix, vixRegime:md.vixRegime }}))
      setLastUp(p=>({...p, risk:new Date().toISOString()}))
    } catch(e) { setErrors(p=>({...p,risk:e.message})) }
    finally { setLoading(p=>({...p,risk:false})) }
  }, [market, claude])

  // ── Deep dive ──────────────────────────────────────────────────────────────
  const deepDive = useCallback(async (opp) => {
    setDrillLoad(true); setDrill(null)
    try {
      const hist = EH[opp.ticker]
      const text = await claude(`Today: ${new Date().toDateString()}
Analyse ${opp.ticker} (${opp.company}) at ${opp.currentPrice}.
Earnings: ${opp.earningsDate||'not confirmed'} (${opp.earningsTradingDaysAway??'?'} trading days)${opp.earningsSource==='estimate'?' [ESTIMATED DATE]':' [VERIFIED]'}
Catalyst: ${opp.catalyst||'N/A'}
Thesis: ${opp.thesis}
Earnings history: ${hist?hist.label:'not available'}
Entry zone: ${opp.entryZone||'N/A'} · Stop loss: ${opp.stopLoss||'N/A'} · Target: ${opp.takeProfit||opp.expectedGain||'N/A'}

Write a focused 260-word analysis covering:
1. WHY THIS SETUP NOW — specific price action and catalyst timing
2. THE BULL CASE — what drives 15%+ from here
3. THE BEAR CASE — what kills the thesis immediately
4. IDEAL ENTRY TRIGGER — exact condition to pull the trigger

Label each sentence: FACT / ANALYSIS / OPINION`, 'deepdive')
      setDrill(text)
    } catch(e) { setDrill(`Error: ${e.message}`) }
    finally { setDrillLoad(false) }
  }, [claude])

  const loaders = { opportunities:loadOpps, global:loadGlobal, risk:loadRisk }

  useEffect(() => {
    if (!loaded.current[activeTab] && !loading[activeTab] && !data[activeTab]) {
      loaded.current[activeTab] = true
      loaders[activeTab]?.()
    }
  }, [activeTab]) // eslint-disable-line

  const handleClick = useCallback((opp) => {
    setSelected(opp); setDrill(null); setShowOverlay(true)
    deepDive(opp)
  }, [deepDive])

  const refresh = useCallback(() => {
    loaded.current[activeTab] = true
    loaders[activeTab]?.()
  }, [activeTab, loadOpps, loadGlobal, loadRisk]) // eslint-disable-line

  // ── Renders ────────────────────────────────────────────────────────────────

  // Per-card deep dive state
  const [cardDrills, setCardDrills]     = useState({})  // { ticker: text }
  const [cardDrillLoad, setCardDrillLoad] = useState({}) // { ticker: bool }

  const handleCardDive = useCallback(async (opp) => {
    if (cardDrills[opp.ticker]) return // already loaded
    setCardDrillLoad(p => ({ ...p, [opp.ticker]: true }))
    try {
      const hist = EH[opp.ticker]
      const text = await claude(`Today: ${new Date().toDateString()}
Analyse ${opp.ticker} (${opp.company}) at ${opp.currentPrice}.
Earnings: ${opp.earningsDate ? ukDate(opp.earningsDate) : 'not confirmed'} (${opp.earningsTradingDaysAway??'?'} trading days)${opp.earningsSource==='estimate'?' [ESTIMATED]':' [VERIFIED]'}
Catalyst: ${opp.catalyst||'N/A'} · Thesis: ${opp.thesis}
Earnings history: ${hist ? hist.label : 'not available'}
Entry: ${opp.entryZone||'N/A'} · Stop: ${opp.stopLoss||'N/A'} · Target: ${opp.takeProfit||opp.expectedGain||'N/A'}

Write 240 words covering:
1. WHY NOW — specific price action and timing
2. BULL CASE — what drives 15%+ from here
3. BEAR CASE — what kills the thesis immediately  
4. IDEAL ENTRY TRIGGER — exact condition to pull trigger
Label each sentence: FACT / ANALYSIS / OPINION`, 'deepdive')
      setCardDrills(p => ({ ...p, [opp.ticker]: text }))
    } catch(e) {
      setCardDrills(p => ({ ...p, [opp.ticker]: `Error: ${e.message}` }))
    } finally {
      setCardDrillLoad(p => ({ ...p, [opp.ticker]: false }))
    }
  }, [claude, cardDrills])

  function renderOpps() {
    const d = data.opportunities
    if (!d) return null
    const opps = d.opportunities||[]
    const condTone = d.marketCondition==='BUY AGGRESSIVELY'?'green':d.marketCondition==='BUY SELECTIVELY'?'blue':d.marketCondition==='WAIT'?'amber':'red'
    const vixTone  = d.vixRegime==='HIGH_FEAR'?'red':d.vixRegime==='ELEVATED'?'amber':'green'

    return (
      <>
        {/* Regime bar */}
        <div style={{ ...card({ marginBottom:14, padding:'12px 18px' }), display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
          {d.marketCondition && <Pill tone={condTone} size="lg">{d.marketCondition}</Pill>}
          {d.vix && <Pill tone={vixTone} size="md">VIX {d.vix} · {d.vixRegime}</Pill>}
          {(d.sectors||[]).map((s,i) => (
            <Pill key={i} tone={s.direction==='up'?'green':'red'} size="sm">{s.label} {s.change}</Pill>
          ))}
        </div>

        {/* CIO calls */}
        <CIOPanel cio={d.cio} isMobile={mob} />

        {/* Regime summary + cash */}
        {(d.regime || d.cashRecommendation) && (
          <div style={{ ...card({ marginBottom:14, padding:'12px 18px' }), display:'grid', gridTemplateColumns:mob?'1fr':'1fr 1fr', gap:12 }}>
            {d.regime && (
              <div>
                <div style={LBL}>MARKET REGIME</div>
                <div style={{ color:C.sub, fontSize:14 }}>{d.regime}</div>
              </div>
            )}
            {d.cashRecommendation && (
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <Pill tone="amber" size="md">💰 {d.cashPct!=null?`${d.cashPct}% CASH`:'CASH'}</Pill>
                <span style={{ color:C.sub, fontSize:14 }}>{d.cashRecommendation}</span>
              </div>
            )}
          </div>
        )}

        {/* Two-col on desktop, single on mobile */}
        <div style={{ display:'grid', gridTemplateColumns:mob?'1fr':'minmax(0,1.45fr) minmax(310px,0.85fr)', gap:18, alignItems:'start' }}>
          <div style={{ display:'grid', gap:14 }}>
            {opps.length
              ? opps.map((o,i) => <OppCard key={`${o.ticker}-${i}`} opp={o} rank={i+1} active={selected?.ticker===o.ticker} onClick={handleClick} onDeepDive={handleCardDive} deepDiveLoading={!!cardDrillLoad[o.ticker]} deepDiveContent={cardDrills[o.ticker]} />)
              : (
                <div style={{ ...card({ textAlign:'center', padding:48 }) }}>
                  <div style={{ fontSize:36, marginBottom:12 }}>💵</div>
                  <div style={{ color:C.text, fontWeight:700, fontSize:18, marginBottom:8 }}>No qualifying opportunities</div>
                  <div style={{ color:C.muted, fontSize:14, maxWidth:380, margin:'0 auto' }}>All candidates failed Return Gate or Cash Challenge. The AI recommends holding cash — this is a valid and correct outcome.</div>
                </div>
              )
            }
            <EarningsCal calendar={d.earningsCalendar} />
          </div>

          {/* Desktop side panel */}
          {!mob && (
            <DetailPanel stock={selected} content={drill} loading={drillLoad} onRun={() => selected && deepDive(selected)} />
          )}
        </div>

        {/* Mobile overlay */}
        {mob && showOverlay && selected && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:200, overflowY:'auto', padding:16 }}
               onClick={e => { if(e.target===e.currentTarget) setShowOverlay(false) }}>
            <div style={{ maxWidth:500, margin:'0 auto' }}>
              <button onClick={() => setShowOverlay(false)} style={{ width:'100%', marginBottom:10, padding:'12px', background:C.card, border:`1px solid ${C.border}`, borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', color:C.sub }}>← Back to list</button>
              <DetailPanel stock={selected} content={drill} loading={drillLoad} onRun={() => selected && deepDive(selected)} />
            </div>
          </div>
        )}
      </>
    )
  }

  function renderGlobal() {
    const d = data.global
    if (!d) return null
    const sentTone = d.sentiment==='RISK ON'?'green':d.sentiment==='RISK OFF'?'red':'grey'
    const vixTone  = d.vixRegime==='HIGH_FEAR'?'red':d.vixRegime==='ELEVATED'?'amber':'green'

    return (
      <>
        {/* Sentiment summary */}
        <div style={{ ...card({ marginBottom:14 }), display:'grid', gridTemplateColumns:mob?'1fr':'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
          <div>
            <Pill tone={sentTone} size="lg" style={{ marginBottom:8 }}>{d.sentiment||'NEUTRAL'}</Pill>
            <div style={{ color:C.sub, fontSize:14, marginTop:8 }}>{d.sentimentReason}</div>
            {d.regimeAdvice && <div style={{ color:C.muted, fontSize:13, marginTop:6, fontStyle:'italic' }}>{d.regimeAdvice}</div>}
          </div>
          {d.vix && (
            <div style={{ background:C.bg, borderRadius:12, padding:'12px 14px' }}>
              <div style={LBL}>VIX PROXY (VIXY)</div>
              <Pill tone={vixTone} size="lg">{d.vix} — {d.vixRegime}</Pill>
              <div style={{ color:C.muted, fontSize:12, marginTop:6 }}>Higher = more fear = reduce position sizes</div>
            </div>
          )}
          {d.keyRisk && (
            <div style={{ background:C.downBg, borderRadius:12, padding:'12px 14px' }}>
              <div style={LBL}>KEY RISK</div>
              <div style={{ color:C.down, fontSize:13, fontWeight:600 }}>{d.keyRisk}</div>
            </div>
          )}
          {d.keyOpportunity && (
            <div style={{ background:C.upBg, borderRadius:12, padding:'12px 14px' }}>
              <div style={LBL}>KEY OPPORTUNITY</div>
              <div style={{ color:C.up, fontSize:13, fontWeight:600 }}>{d.keyOpportunity}</div>
            </div>
          )}
        </div>

        {/* Indices */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:18 }}>
          {(d.indices||[]).map((m,i) => (
            <div key={i} style={{ ...card({ padding:14 }) }}>
              <div style={LBL}>{m.name}</div>
              <div style={{ color:C.text, fontFamily:FM, fontWeight:800, fontSize:19 }}>{m.value}</div>
              <div style={{ color:m.direction==='up'?C.up:C.down, fontFamily:FM, fontWeight:700, fontSize:13, marginTop:2 }}>{m.change}</div>
            </div>
          ))}
        </div>

        {/* Sectors + Commodities + FX in grid */}
        <div style={{ display:'grid', gridTemplateColumns:mob?'1fr':'repeat(auto-fit,minmax(280px,1fr))', gap:18 }}>
          {/* Sector performance */}
          <div style={card()}>
            <div style={{ ...LBL, marginBottom:14 }}>SECTOR PERFORMANCE TODAY</div>
            {(d.sectors||[]).map((s,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:i<d.sectors.length-1?`1px solid ${C.border}`:'none' }}>
                <span style={{ color:C.sub, fontSize:14 }}>{s.label}</span>
                <span style={{ color:s.direction==='up'?C.up:C.down, fontFamily:FM, fontWeight:700, fontSize:14 }}>{s.change}</span>
              </div>
            ))}
          </div>

          {/* Commodities + FX */}
          <div style={card()}>
            <div style={{ ...LBL, marginBottom:14 }}>COMMODITIES</div>
            {(d.commodities||[]).map((c,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:i<d.commodities.length-1?`1px solid ${C.border}`:'none' }}>
                <span style={{ color:C.sub, fontSize:14 }}>{c.name}</span>
                <span style={{ color:c.direction==='up'?C.up:C.down, fontFamily:FM, fontWeight:700, fontSize:14 }}>{c.value} {c.change}</span>
              </div>
            ))}
            {d.currencies?.length>0 && (
              <>
                <DIV />
                <div style={{ ...LBL, marginBottom:10 }}>FX RATES</div>
                {d.currencies.map((c,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0' }}>
                    <span style={{ color:C.sub, fontSize:14, fontWeight:600 }}>{c.pair}</span>
                    <span style={{ color:C.text, fontFamily:FM, fontWeight:700, fontSize:14 }}>{c.value} <span style={{ color:C.muted, fontSize:12 }}>{c.change}</span></span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Macro events */}
          {d.macroEvents?.length>0 && (
            <div style={card()}>
              <div style={{ ...LBL, marginBottom:14 }}>MACRO EVENTS THIS WEEK</div>
              {d.macroEvents.map((e,i) => (
                <div key={i} style={{ marginBottom:12 }}>
                  <div style={{ color:C.text, fontWeight:700, fontSize:14 }}>{e.event}</div>
                  {e.detail && <div style={{ color:C.muted, fontSize:13, marginTop:3 }}>{e.detail}</div>}
                  <div style={{ marginTop:6 }}>
                    <Pill tone={e.impact==='HIGH'?'red':e.impact==='MEDIUM'?'amber':'grey'} size="sm">{e.impact}</Pill>
                  </div>
                  {i<d.macroEvents.length-1 && <DIV />}
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    )
  }

  function renderRisk() {
    const d = data.risk
    if (!d) return null
    const riskTone = d.overallRisk==='LOW'?'green':d.overallRisk==='MODERATE'?'amber':'red'
    const vixTone  = d.vixRegime==='HIGH_FEAR'?'red':d.vixRegime==='ELEVATED'?'amber':'green'

    return (
      <>
        {/* Risk header */}
        <div style={{ ...card({ marginBottom:14, padding:'14px 18px' }), display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
          <Pill tone={riskTone} size="lg">RISK: {d.overallRisk||'MODERATE'}</Pill>
          {d.vix && <Pill tone={vixTone} size="md">VIX {d.vix} · {d.vixRegime}</Pill>}
          {d.cashSuggestion && <Pill tone="amber" size="md">💰 Hold {d.cashSuggestion} cash</Pill>}
          {d.positionSizingAdvice && <span style={{ color:C.sub, fontSize:14 }}>{d.positionSizingAdvice}</span>}
        </div>

        {/* Best for + hedge ideas summary */}
        {(d.bestEnvironmentFor?.length || d.hedgeIdeas?.length) && (
          <div style={{ display:'grid', gridTemplateColumns:mob?'1fr':'1fr 1fr', gap:14, marginBottom:18 }}>
            {d.bestEnvironmentFor?.length>0 && (
              <div style={{ ...card({ borderLeft:`3px solid ${C.up}` }) }}>
                <div style={{ ...LBL, marginBottom:10 }}>✅ WORKS BEST NOW</div>
                {d.bestEnvironmentFor.map((t,i) => <div key={i} style={{ color:C.up, fontSize:14, fontWeight:600, marginBottom:6 }}>• {t}</div>)}
              </div>
            )}
            {d.hedgeIdeas?.length>0 && (
              <div style={{ ...card({ borderLeft:`3px solid ${C.amber}` }) }}>
                <div style={{ ...LBL, marginBottom:10 }}>🛡 HEDGE IDEAS</div>
                {d.hedgeIdeas.map((h,i) => <div key={i} style={{ color:C.sub, fontSize:14, marginBottom:6 }}>• {h}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Risk tables */}
        <div style={{ display:'grid', gridTemplateColumns:mob?'1fr':'repeat(auto-fit,minmax(300px,1fr))', gap:18 }}>
          {[
            ['⚠️ Macro Risks',    d.macroRisks,        r=>r.risk,   r=>r.detail,  r=>r.severity, r=>r.action],
            ['🌍 Geopolitical',   d.geopoliticalRisks, r=>r.risk,   r=>r.detail,  r=>r.severity, r=>r.action],
            ['📊 Sector Risks',   d.sectorRisks,       r=>r.sector, r=>r.risk,    r=>r.severity, r=>r.action],
          ].map(([title,items,tFn,dFn,sFn,aFn]) => (
            <div key={title} style={card()}>
              <div style={{ ...LBL, marginBottom:14 }}>{title}</div>
              {!(items?.length) && <div style={{ color:C.muted, fontSize:13 }}>None identified</div>}
              {(items||[]).map((r,i) => (
                <div key={i} style={{ marginBottom:12 }}>
                  <div style={{ color:C.text, fontWeight:700, fontSize:14 }}>{tFn(r)}</div>
                  <div style={{ color:C.muted, fontSize:13, marginTop:3 }}>{dFn(r)}</div>
                  {aFn(r) && <div style={{ color:C.accent, fontSize:13, marginTop:4, fontWeight:600 }}>→ {aFn(r)}</div>}
                  <div style={{ marginTop:6 }}>
                    <Pill tone={sFn(r)==='HIGH'?'red':sFn(r)==='MEDIUM'?'amber':'grey'} size="sm">{sFn(r)}</Pill>
                  </div>
                  {i<(items?.length||0)-1 && <DIV />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </>
    )
  }

  function renderContent() {
    const isLoad = loading[activeTab]
    const err    = errors[activeTab]
    const d      = data[activeTab]

    if (isLoad) return (
      <div style={{ ...card({ minHeight:320 }), display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14 }}>
        <div style={{ width:44, height:44, border:`3px solid ${C.border}`, borderTop:`3px solid ${C.accent}`, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <div style={{ color:C.text, fontWeight:700, fontSize:16 }}>
          {activeTab==='opportunities' ? 'Running full analysis…' : 'Loading…'}
        </div>
        <div style={{ color:C.muted, fontSize:13, textAlign:'center', maxWidth:380, lineHeight:1.6 }}>
          {activeTab==='opportunities'
            ? 'Fetching live prices · Pulling earnings calendar · Applying trading rules · Generating CIO analysis'
            : 'Fetching live market data and running AI analysis'}
        </div>
      </div>
    )

    if (err) return (
      <div style={{ ...card({ borderLeft:`4px solid ${C.down}` }), padding:24 }}>
        <div style={{ color:C.down, fontWeight:700, fontSize:16, marginBottom:8 }}>Error</div>
        <div style={{ color:C.sub, fontSize:14, marginBottom:16, whiteSpace:'pre-wrap' }}>{err}</div>
        <button onClick={refresh} style={{ appearance:'none', background:C.down, color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontWeight:700, fontSize:14, cursor:'pointer' }}>Retry</button>
      </div>
    )

    if (!d) return (
      <div style={{ ...card({ minHeight:200 }), display:'grid', placeItems:'center' }}>
        <div style={{ color:C.muted }}>Loading…</div>
      </div>
    )

    if (activeTab==='opportunities') return renderOpps()
    if (activeTab==='global')        return renderGlobal()
    if (activeTab==='risk')          return renderRisk()
    return null
  }

  // ── Shell ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:FB, overflowX:'hidden', WebkitFontSmoothing:'antialiased' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&family=DM+Mono:wght@400;500;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; }
        body { margin:0; }
        button { -webkit-tap-highlight-color:transparent; }
        button:hover { opacity:0.88; }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth:1560, margin:'0 auto', padding: mob ? '10px 12px' : '14px 24px' }}>

        {/* Header */}
        <div style={{ ...card({ marginBottom:14, padding: mob ? '12px 14px' : '14px 22px' }), display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontWeight:900, fontSize: mob?20:26, color:C.accent, letterSpacing:-0.5 }}>CATALYST</div>
            <div style={{ color:C.muted, fontSize:11, fontWeight:600, letterSpacing:0.5, marginTop:2 }}>TRADING INTELLIGENCE · {new Date().toDateString().toUpperCase()}</div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {lastUp[activeTab] && <span style={{ color:C.muted, fontSize:11 }}>Updated {ts(lastUp[activeTab])}</span>}
            <button onClick={refresh} style={{ appearance:'none', background:C.accent, color:'#fff', border:'none', borderRadius:10, padding: mob ? '8px 14px' : '10px 18px', fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'0 2px 8px rgba(37,99,235,0.25)' }}>↻ Refresh</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:16, overflowX:'auto', WebkitOverflowScrolling:'touch', paddingBottom:4 }}>
          {TABS.map(t => {
            const active = activeTab===t.key
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                appearance:'none',
                border: `1.5px solid ${active ? C.accent : C.border}`,
                background: active ? C.accent : C.card,
                color: active ? '#fff' : C.sub,
                borderRadius:10, padding: mob ? '9px 14px' : '11px 18px',
                cursor:'pointer', fontWeight:700, fontSize: mob?13:14,
                whiteSpace:'nowrap', flexShrink:0,
                boxShadow: active ? '0 2px 8px rgba(37,99,235,0.2)' : 'none',
                transition:'all 0.15s',
              }}>
                {t.label}{loading[t.key] ? ' ⟳' : ''}
              </button>
            )
          })}
        </div>

        {renderContent()}

        <div style={{ textAlign:'center', color:C.muted, fontSize:11, padding:'24px 0 8px' }}>
          Prices: Finnhub · Analysis: Claude AI · Not financial advice · For educational use only
        </div>
      </div>
    </div>
  )
}
