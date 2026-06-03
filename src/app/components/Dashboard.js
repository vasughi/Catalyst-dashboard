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
  NVDA:  { avg: 14.2, beats: 4, label: '14.2% avg · 4/4 beats — next: est Aug 2026' },
  AMD:   { avg: 9.8,  beats: 3, label: '9.8% avg · 3/4 beats' },
  AVGO:  { avg: 11.4, beats: 4, label: '11.4% avg · 4/4 beats — REPORTS 3 JUN 2026' },
  MRVL:  { avg: 16.2, beats: 4, label: '16.2% avg · 4/4 beats — next: 20 Aug 2026' },
  ARM:   { avg: 12.8, beats: 3, label: '12.8% avg · 3/4 beats' },
  QCOM:  { avg: 7.4,  beats: 3, label: '7.4% avg · 3/4 beats' },
  // Networking
  ANET:  { avg: 9.2,  beats: 4, label: '9.2% avg · 4/4 beats' },
  CRDO:  { avg: 19.8, beats: 3, label: '19.8% avg · 4/4 beats — REPORTS TODAY 1 JUN 2026' },
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

  // Try direct parse first (handles both compact and pretty-printed)
  try { return JSON.parse(s) } catch {}

  // Try cleaning up common issues before attempting repair
  try {
    const cleaned = s
      .replace(/,\s*}/g, '}')
      .replace(/,\s*\]/g, ']')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
    return JSON.parse(cleaned)
  } catch {}

  // Response may be truncated — close all open brackets/strings
  let inStr = false, esc = false
  const opens = []
  for (let j = 0; j < s.length; j++) {
    const c = s[j]
    if (esc) { esc = false; continue }
    if (c === '\\' && inStr) { esc = true; continue }
    if (c === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (c === '{') opens.push('}')
    else if (c === '[') opens.push(']')
    else if ((c === '}' || c === ']') && opens.length) opens.pop()
  }

  // If we're mid-string, close it
  let fixed = s
  if (inStr) fixed += '"'

  // Remove trailing comma before closing
  fixed = fixed.replace(/,\s*$/, '')

  // Close all open brackets
  fixed = fixed + opens.reverse().join('')

  // Remove trailing commas before closing brackets
  fixed = fixed.replace(/,\s*([}\]])/g, '$1')

  try { return JSON.parse(fixed) } catch {
    // Last resort: try to extract whatever completed opportunity objects exist
    try {
      // Find all complete opportunity objects (between { and })
      const oppArrayMatch = fixed.match(/"opportunities"\s*:\s*\[/)
      if (oppArrayMatch) {
        const startIdx = fixed.indexOf('[', fixed.indexOf('"opportunities"'))
        let depth = 0, endIdx = startIdx
        for (let k = startIdx; k < fixed.length; k++) {
          if (fixed[k] === '[' || fixed[k] === '{') depth++
          if (fixed[k] === ']' || fixed[k] === '}') depth--
          if (depth === 0) { endIdx = k; break }
        }
        const arrStr = fixed.slice(startIdx, endIdx + 1)
        const opps = JSON.parse(arrStr.replace(/,\s*$/, '').replace(/,\s*([}\]])/g, '$1'))
        return {
          marketCondition: 'BUY SELECTIVELY', cashPct: 30,
          cashRecommendation: 'Analysis partially complete — retry for full results',
          regime: 'Partial data loaded',
          cio: { bestTradeToday: opps[0]?.ticker || '—', bestRiskReward: opps[0]?.ticker || '—', finalMarketDecision: 'BUY SELECTIVELY', watchList: [], avoidList: [] },
          opportunities: opps,
        }
      }
    } catch {}
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

// ─── Tooltip (hover for plain-English definition) ───────────────────────────
function Tip({ term, meaning }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position:'relative', display:'inline-flex', alignItems:'center', gap:3 }}>
      <span>{term}</span>
      <span
        onMouseEnter={()=>setShow(true)}
        onMouseLeave={()=>setShow(false)}
        onTouchStart={()=>setShow(s=>!s)}
        style={{ width:16, height:16, borderRadius:'50%', background:C.accentBg, color:C.accent, fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'help', flexShrink:0 }}
      >?</span>
      {show && (
        <div style={{ position:'absolute', bottom:'calc(100% + 6px)', left:0, background:C.text, color:'#fff', borderRadius:8, padding:'8px 12px', fontSize:12, lineHeight:1.5, width:220, zIndex:999, boxShadow:'0 4px 16px rgba(0,0,0,0.2)', fontWeight:400, fontFamily:FB }}>
          {meaning}
        </div>
      )}
    </span>
  )
}

// Key terms glossary
const GLOSSARY = {
  "Reward vs Risk": "For every £1 you risk losing, how much could you gain. 3:1 means you could make £3 for every £1 at risk.",
  "VIX": "The market's fear level. Below 18 = calm. 18-25 = cautious. Above 25 = high fear — consider holding more cash.",
  "Opportunity Score": "Our overall rating out of 100. Above 80 = strong setup. 70-80 = good. Below 60 = borderline.",
  "15%+ PATH EXISTS": "We checked whether a realistic path to 15% gain exists within 8 weeks. Green tick means yes.",
  "BEATS HOLDING CASH": "We checked whether this trade is clearly better than just keeping your money in cash. Green tick means yes.",
  "Portfolio %": "What percentage of your total investment budget to put into this one stock. Never put everything in one stock.",
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
function OppCard({ opp, rank, active, onClick, onDeepDive, deepDiveLoading, deepDiveContent, getEH, techMap }) {
  const hist    = getEH ? getEH(opp.ticker) : EH[opp.ticker]
  // Use live techMap data if available, fall back to opp fields from AI
  const tc      = techMap?.[opp.ticker] || {}
  const trend        = tc.trend        || opp.trend        || null
  const setup        = tc.setup        || opp.setup        || null
  const entryQuality = tc.entryQuality || opp.entryQuality || null
  const trendComment = opp.trendComment || null
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
              {opp.earningsSource==='confirmed'  && <span style={{ fontSize:10, fontWeight:600 }}> ✓</span>}
              {opp.earningsSource==='estimate'   && <span style={{ fontSize:10, fontWeight:600, opacity:0.8 }}> (est)</span>}
              {opp.earningsSource==='conflicted' && <span style={{ fontSize:10, fontWeight:600 }}> ⚠</span>}
            </span>
          )}
          {gapUp && <Pill tone="amber" size="sm">⚠ GAP UP</Pill>}
        </div>
        <ActionBadge action={opp.action} size="lg" />
      </div>

      {/* Price */}
      <div style={{ display:'flex', gap:12, alignItems:'baseline', marginBottom:12, flexWrap:'wrap' }}>
        <span style={{ color: (!opp.currentPrice || opp.currentPrice==='N/A' || opp.currentPrice==='—') ? C.muted : C.text, fontFamily:FM, fontWeight:900, fontSize:30 }}>
          {(!opp.currentPrice || opp.currentPrice==='N/A') ? 'Loading…' : opp.currentPrice}
        </span>
        {opp.change1d && opp.change1d !== 'N/A' && <span style={{ color:opp.direction==='up'?C.up:C.down, fontFamily:FM, fontWeight:700, fontSize:15 }}>{opp.change1d}</span>}
        {opp.expectedGain && <span style={{ color:C.gold, fontWeight:700, fontSize:14 }}>🎯 {opp.expectedGain}</span>}
      </div>

      {/* Thesis */}
      <p style={{ color:C.sub, fontSize:14, lineHeight:1.6, margin:'0 0 12px 0' }}>{opp.thesis||'—'}</p>

      {/* Technical trend badge */}
      {(trend || setup) && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
          {trend && (
            <Pill tone={
              trend==='STRONG UPTREND'?'green':
              trend==='PULLBACK IN UPTREND'?'blue':
              trend==='RECOVERING'?'amber':'red'
            } size="sm">
              📈 {trend}
            </Pill>
          )}
          {setup && setup !== 'NEUTRAL' && (
            <Pill tone={
              setup==='PULLBACK'?'green':
              setup==='EXTENDED'?'amber':'grey'
            } size="sm">
              {setup==='PULLBACK'?'✓ IDEAL ENTRY':setup==='EXTENDED'?'⚠ EXTENDED':'📊 '+setup}
            </Pill>
          )}
          {entryQuality && (
            <Pill tone={
              entryQuality==='EXCELLENT'?'green':
              entryQuality==='GOOD'?'blue':
              entryQuality==='AVERAGE'?'grey':'red'
            } size="sm">
              Entry: {entryQuality}
            </Pill>
          )}
          {tc.computedAt && <Pill tone="grey" size="sm">📡 SMA live</Pill>}
        </div>
      )}
      {trendComment && (
        <div style={{ color:C.muted, fontSize:12, fontStyle:'italic', marginBottom:8 }}>{trendComment}</div>
      )}

      {/* Gates */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
        <GateBadge label="15%+ PATH EXISTS" pass={opp.returnGate==='PASS'?true:opp.returnGate==='FAIL'?false:null} />
        <GateBadge label="BEATS HOLDING CASH" pass={opp.cashChallenge==='PASS'?true:opp.cashChallenge==='FAIL'?false:null} />
        <Pill tone="green" size="sm">✓ LIVE PRICE</Pill>
      </div>

      {/* Trade details */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:12 }}>
        {[
          ['Upcoming event',   opp.catalyst||opp.upcomingEvent],
          ['Event date',       opp.catalystDate||opp.eventDate||opp.earningsDate],
          ['Buy between',      opp.entryZone],
          ['Sell if drops to', opp.stopLoss],
          ['Reward vs Risk ❓', opp.riskReward],
          ['Portfolio % ❓',    opp.allocation],
        ].map(([l,v]) => v ? (
          <div key={l}>
            <div style={LBL}>{l}</div>
            <div style={{ ...VAL, fontSize:14 }}>{v}</div>
          </div>
        ) : null)}
      </div>

      {/* Earnings history */}
      {hist && (
        <Pill tone={hist.live ? 'green' : 'purple'} size="sm">
          {hist.live ? '📡' : '📊'} {hist.label}{hist.live ? ' · live' : ''}
        </Pill>
      )}

      {/* Score */}
      {opp.opportunityScore != null && (
        <div style={{ marginTop:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
            <span style={LBL}>OUR RATING</span>
            <span style={{ color:C.muted, fontSize:11 }}>(out of 100 — above 75 is strong)</span>
          </div>
          <ScoreBar score={opp.opportunityScore} />
        </div>
      )}

      {/* Per-card deep dive */}
      <div style={{ marginTop:14, borderTop:`1px solid ${C.border}`, paddingTop:14 }} onClick={e => e.stopPropagation()}>
        {!showDive ? (
          <button onClick={handleDeepDive} className="no-print" style={{ appearance:'none', background:C.accentBg, color:C.accent, border:`1px solid ${C.accent}44`, borderRadius:8, padding:'8px 16px', fontWeight:700, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
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
      <div style={{ ...LBL, marginBottom:14 }}>📅 UPCOMING EARNINGS RESULTS — NEXT 60 DAYS</div><div style={{ color:C.muted, fontSize:12, marginBottom:12 }}>Companies below are reporting their financial results soon. This is when big price moves happen.</div>
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
                {e.source==='confirmed'  && <span style={{ background:C.upBg,    color:C.up,    fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:4 }}>✓ CONFIRMED</span>}
                {e.source==='estimate'   && <span style={{ background:C.amberBg, color:C.amber, fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:4 }}>EST</span>}
                {e.source==='conflicted' && <span style={{ background:C.downBg,  color:C.down,  fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:4 }}>⚠ CHECK DATE</span>}
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
function CIOPanel({ cio, marketCondition, vix, vixRegime, sectors, regime, cashPct, cashRecommendation, isMobile }) {
  const condTone = marketCondition==='BUY AGGRESSIVELY'?'green':marketCondition==='BUY SELECTIVELY'?'blue':marketCondition==='WAIT'?'amber':'red'
  const vixTone  = vixRegime==='HIGH_FEAR'?'red':vixRegime==='ELEVATED'?'amber':'green'

  return (
    <div style={{ ...card({ marginBottom:14 }) }}>
      {/* Row 1 — decision + VIX + sectors */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', marginBottom:14, paddingBottom:12, borderBottom:`1px solid ${C.border}` }}>
        {marketCondition && <Pill tone={condTone} size="lg">{marketCondition}</Pill>}
        {vix && <Pill tone={vixTone} size="md">VIX {vix} · {vixRegime}</Pill>}
        {(sectors||[]).map((s,i) => (
          <Pill key={i} tone={s.direction==='BULLISH'||s.direction==='up'?'green':'red'} size="sm">{s.label} {s.change}</Pill>
        ))}
      </div>

      {/* Row 2 — CIO decision tiles */}
      {cio && (
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)', gap:10, marginBottom:14 }}>
          {[
            ['⚡ Best Buy Today',       cio.bestTradeToday, 'green'],
            ['📐 Best Value Setup',     cio.bestRiskReward,  'blue'],
            ['🎯 Overall Advice',       cio.finalMarketDecision, condTone],
          ].filter(([,v])=>v).map(([l,v,tone])=>(
            <div key={l} style={{ background:TONES[tone][1], borderRadius:10, padding:'10px 14px', border:`1px solid ${TONES[tone][0]}33` }}>
              <div style={{ color:C.muted, fontSize:11, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase', marginBottom:4 }}>{l}</div>
              <div style={{ color:TONES[tone][0], fontWeight:900, fontSize:18, fontFamily:FM }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Row 3 — cash + regime */}
      {(cashRecommendation || regime) && (
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'auto 1fr', gap:10, alignItems:'center', marginBottom:cio?.watchList?.length||cio?.avoidList?.length?12:0, paddingBottom:cio?.watchList?.length||cio?.avoidList?.length?12:0, borderBottom:cio?.watchList?.length||cio?.avoidList?.length?`1px solid ${C.border}`:'none' }}>
          {cashPct!=null && <Pill tone="amber" size="md">💰 {cashPct}% CASH</Pill>}
          <span style={{ color:C.sub, fontSize:13 }}>{regime || cashRecommendation}</span>
        </div>
      )}

      {/* Row 4 — Watch tiles — show ALL stocks in watchList */}
      {cio?.watchList?.length > 0 && (
        <div style={{ marginBottom:cio?.avoidList?.length?12:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={LBL}>👀 KEEP AN EYE ON THESE</div>
            <span style={{ color:C.muted, fontSize:11 }}>({cio.watchList.length} stocks)</span>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {cio.watchList.map((w,i)=>(
              <div key={i} style={{ background:C.amberBg, border:`1px solid ${C.amber}33`, borderRadius:8, padding:'5px 10px', maxWidth: mob ? '100%' : 340 }}>
                <span style={{ color:C.amber, fontWeight:800, fontFamily:FM, fontSize:13 }}>{w.ticker||w}</span>
                {w.reason && <span style={{ color:C.sub, fontSize:12 }}> — {w.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Row 5 — Avoid tiles — show ALL stocks in avoidList */}
      {cio?.avoidList?.length > 0 && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={LBL}>🚫 DON'T BUY THESE NOW</div>
            <span style={{ color:C.muted, fontSize:11 }}>({cio.avoidList.length} stocks)</span>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {cio.avoidList.map((w,i)=>(
              <div key={i} style={{ background:C.downBg, border:`1px solid ${C.down}33`, borderRadius:8, padding:'5px 10px', maxWidth: mob ? '100%' : 340 }}>
                <span style={{ color:C.down, fontWeight:800, fontFamily:FM, fontSize:13 }}>{w.ticker||w}</span>
                {w.reason && <span style={{ color:C.sub, fontSize:12 }}> — {w.reason}</span>}
              </div>
            ))}
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
            {[['Current Price', stock.currentPrice], ['Target Price', stock.takeProfit||stock.expectedGain], ['Exit if below', stock.stopLoss], ['Reward vs Risk', stock.riskReward], ['Buy between', stock.entryZone], ['Portfolio %', stock.allocation]].map(([l,v]) => v ? (
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
              <div style={LBL}>UPCOMING EVENT</div>
              <div style={{ ...VAL, fontSize:14 }}>{stock.catalyst}</div>
            </div>
          )}

          {stock.invalidation && (
            <div style={{ background:C.downBg, borderRadius:10, padding:'10px 14px', marginBottom:14 }}>
              <div style={LBL}>🚨 SELL IMMEDIATELY IF...</div>
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

// ─── Password — resolved at module level ─────────────────────────────────────
// Set NEXT_PUBLIC_PORTFOLIO_PASSWORD in Vercel env vars, or default is used
const PORTFOLIO_PASSWORD = (
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PORTFOLIO_PASSWORD
) || 'catalyst2026'

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key:'opportunities', label:'⚡ Opportunities' },
  { key:'portfolio',     label:'💼 My Portfolio' }, // password protected — manual input
  { key:'t212',          label:'🏦 T212 Live' },    // password protected — Trading 212 API
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
  const [showAllOpps, setShowAllOpps] = useState(false)
  // Portfolio password gate — stored in sessionStorage (cleared on browser close)
  const [portfolioUnlocked, setPortfolioUnlocked] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [passwordInput,     setPasswordInput]     = useState('')
  const [passwordError,     setPasswordError]     = useState(false)
  // Live earnings history — fetched from /api/earnings-history, cached 24h
  // Falls back to hardcoded EH if fetch fails
  const [liveEH,      setLiveEH]      = useState({})
  const [techMap,     setTechMap]     = useState({})  // SMA/trend data per ticker
  const [newsData,    setNewsData]    = useState({})  // live news + analyst ratings per ticker
  // Portfolio holdings — persisted in localStorage
  const [holdings,      setHoldings]     = useState([])
  const [portfolioResult, setPortfolioResult] = useState(null)
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [portfolioError, setPortfolioError] = useState(null)
  const [newTicker,     setNewTicker]    = useState('')
  const [newBuyPrice,   setNewBuyPrice]  = useState('')
  const [newShares,     setNewShares]    = useState('')
  const [newCurrency,   setNewCurrency]  = useState('USD')
  // T212 live portfolio state
  const [t212Data,         setT212Data]        = useState(null)
  const [t212Loading,      setT212Loading]      = useState(false)
  const [t212Error,        setT212Error]        = useState(null)
  const [t212Result,       setT212Result]       = useState(null)
  const [t212AnalysisLoad, setT212AnalysisLoad] = useState(false)
  const [t212Unlocked,     setT212Unlocked]     = useState(false)
  const [t212PwInput,      setT212PwInput]      = useState('')
  const [t212PwError,      setT212PwError]      = useState(false)
  const [t212ViewMode,     setT212ViewMode]     = useState('pies') // 'pies' | 'stocks'
  const [expandedPies,     setExpandedPies]     = useState({})     // { pieName: bool }
  const loaded = useRef({})
  const w = useWindowWidth()
  const mob = w < 900

  // ── API helpers ────────────────────────────────────────────────────────────
  // Fetch live earnings history (cached 24h on server)
  const fetchEarningsHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/earnings-history', { cache: 'force-cache' })
      if (!r.ok) return
      const d = await r.json()
      if (d?.history) {
        setLiveEH(d.history)
      }
    } catch {}
  }, [])

  // Fetch SMA/trend technicals in background — batches of 5, never blocks main load
  const fetchTechnicals = useCallback(async (tickers) => {
    if (!tickers?.length) return
    const BATCH = 5
    for (let i = 0; i < tickers.length; i += BATCH) {
      const batch = tickers.slice(i, i + BATCH)
      try {
        const r = await fetch('/api/technicals?symbols=' + batch.join(','), { cache: 'no-store' })
        if (!r.ok) continue
        const d = await r.json()
        if (d?.technicals) {
          setTechMap(prev => ({ ...prev, ...d.technicals }))
        }
      } catch {}
      // Small gap between batches to avoid rate limits
      if (i + BATCH < tickers.length) {
        await new Promise(r => setTimeout(r, 600))
      }
    }
  }, [])

  // Fetch live news + analyst ratings + earnings results in background
  const fetchNews = useCallback(async (tickers) => {
    if (!tickers?.length) return
    // Fetch in batches of 15 (API cap)
    const BATCH = 15
    for (let i = 0; i < tickers.length; i += BATCH) {
      const batch = tickers.slice(i, i + BATCH)
      try {
        const r = await fetch('/api/news?symbols=' + batch.join(','), { cache: 'no-store' })
        if (!r.ok) continue
        const d = await r.json()
        if (d?.results) {
          setNewsData(prev => ({ ...prev, ...d.results }))
        }
      } catch {}
    }
  }, [])

  // Merge live EH with hardcoded fallback — live takes priority
  const getEH = useCallback((ticker) => {
    const live = liveEH[ticker]
    if (live) return {
      avg:   live.avgMove,
      beats: live.beatCount,
      label: live.label,
      live:  true,
    }
    return EH[ticker] || null
  }, [liveEH])

  const claude = useCallback(async (prompt, mode='json') => {
    // Use streaming via /api/claude — collects full streamed response,
    // bypassing Vercel timeout by using Edge runtime (no 10s limit)
    const r = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, mode }),
    })
    // Handle streaming response
    if (r.headers.get('content-type')?.includes('text/plain')) {
      const text = await r.text()
      if (!r.ok) throw new Error(text || `Claude ${r.status}`)
      return text
    }
    // Handle regular JSON response
    const d = await r.json()
    if (!r.ok) throw new Error(d.error || `Claude ${r.status}`)
    const tb = d.content?.find(b => b.type === 'text')
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
    setLoadingStep('Fetching live prices…')
    try {
      const md = await market('opportunities')
      setLoadingStep('Building AI analysis…')
      const { stocks, earningsCalendar, vix, vixRegime, sectors } = md

      // Build stock lines for prompt
      const stockLines = (stocks||[]).map(s => {
        const hist = getEH(s.ticker)
        const parts = [
          s.ticker+'('+s.name+'): $'+s.price?.toFixed(2)+' '+s.change1d,
          s.hasVerifiedEarnings
            ? ('EARNINGS='+s.earningsDate+' in_'+s.earningsTradingDaysAway+'d'+(s.earningsSource==='estimate'?' [EST]':' [VERIFIED]')+(s.epsEstimate?' EPS=$'+s.epsEstimate:''))
            : 'NO_EARNINGS',
          s.bigMoverToday ? 'GAP_UP>8%_APPLY_PENALTY' : '',
          hist ? 'HIST:'+hist.label+(hist.live?' [LIVE]':'') : '',
          // Technicals — use live techMap if available
          (()=>{const t=techMap[s.ticker]||{}; return[
            t.trend             ? 'TREND:'+t.trend                                                  : '',
            t.entryQuality      ? 'ENTRY:'+t.entryQuality                                           : '',
            t.pctAbove200!=null ? 'vs200SMA:'+(t.pctAbove200>=0?'+':'')+t.pctAbove200+'%'          : '',
            t.suggestedStopLoss ? 'STOP:$'+t.suggestedStopLoss                                      : '',
          ].filter(Boolean).join(' | ')})(),
        ]
        return parts.filter(Boolean).join(' | ')
      }).join('\n')

      const sectorLines = (sectors||[]).map(s=>s.label+': '+s.change+' ('+s.direction+')').join(', ')

      // Build earnings history lines — live if available, hardcoded fallback otherwise
      const ehLines = UNIVERSE.map(sym => {
        const h = getEH(sym)
        if (!h) return null
        return `${sym}: ${h.label}${h.live ? ' [LIVE]' : ' [CACHED]'}`
      }).filter(Boolean).join(' | ')

      const calLines = (earningsCalendar||[]).slice(0,15).map(e => {
        const conf = e.source === 'confirmed' ? '[CONFIRMED by 2 sources]'
          : e.source === 'conflicted' ? `[CONFLICTED — alt date: ${e.altDate}]`
          : e.source === 'ninjas'    ? '[API NINJAS source]'
          : e.source === 'estimate'  ? '[HARDCODED ESTIMATE]'
          : '[FINNHUB]'
        return e.ticker+' → '+e.date+' ('+e.tradingDaysAway+'d) '+conf+(e.epsEstimate?' EPS_est=$'+e.epsEstimate:'')
      }).join('\n')

      // Build live news context from background fetch
      const newsLines = Object.entries(newsData)
        .filter(([, d]) => d?.news?.length || d?.analyst || d?.lastEarnings)
        .map(([ticker, d]) => {
          const parts = []
          if (d.analyst) parts.push('Analysts:'+d.analyst.consensus+'('+d.analyst.total+' covering)')
          if (d.lastEarnings) {
            const e = d.lastEarnings
            parts.push('Last earnings:'+(e.beat?'BEAT':'MISS')+' by '+e.surprise+' ('+e.period+')')
          }
          if (d.news?.length) parts.push(...d.news.slice(0,2).map(n=>n.date+':'+n.headline.slice(0,80)))
          return parts.length ? ticker+': '+parts.join(' | ') : null
        })
        .filter(Boolean)
        .join('\n')

      const prompt = `TODAY: ${new Date().toDateString()}
VIX: ${vix||'N/A'} (${vixRegime||'UNKNOWN'})
SECTORS: ${sectorLines||'N/A'}

PRICES:
${stockLines}

EARNINGS DATES (next 60 days):
${calLines||'None confirmed yet'}

EARNINGS HISTORY:
${ehLines || Object.entries(EH).map(([k,v])=>(k+': '+v.label)).join(' | ')}

LIVE NEWS + ANALYST DATA (auto-fetched):
${newsLines || 'Loading in background — refresh for live data'}

KNOWN EVENTS (may be stale):
- AVGO: Reported 3 Jun 2026 — check live news above for result
- CRDO: Reported 1 Jun, beat but fell 14% — WATCH until $190-210
- QCOM: Already reported Q2, weak Q3 guidance, Apple modem risk — max WATCH
- GOOGL: $80B share issue = dilution = max WATCH
- FCX: Mine production cut = fundamental problem = max WATCH

RULES:
1. Stocks with earnings 33-45 days away are PRIME BUY candidates right now
2. Stock up >8% today = max WATCH (too late to buy)
3. Only BUY if 15%+ gain path within 45 trading days
4. DOWNTREND = max WATCH. PULLBACK IN UPTREND = ideal BUY.
5. currentPrice MUST be exact dollar from PRICES above
6. Include WATCH cards for NVDA, MRVL even without near-term earnings
7. Plain English only. Short sentences. No jargon.
8. watchList: 5-8 most interesting. avoidList: 5-8 to avoid.

You MUST return EXACTLY 15 entries. Output COMPACT JSON — no spaces, no newlines. Keep ALL string values under 12 words. Rank ALL stocks from the prices list by opportunity score — include the best 15 across BUY and WATCH ratings. Count them. If you have fewer than 10 BUYs, fill remaining slots with WATCH cards for: NVDA, MRVL, AVGO, GEV, FSLR, ETN, CEG, PLTR — whatever is needed to reach 10.

Return ONLY this JSON (EXACTLY 15 opportunity cards — rank all universe stocks, best 15 only):
{"marketCondition":"BUY SELECTIVELY","cashRecommendation":"one sentence","cashPct":30,"regime":"one sentence","cio":{"bestTradeToday":"TICKER","bestRiskReward":"TICKER","finalMarketDecision":"BUY SELECTIVELY","watchList":[{"ticker":"","reason":"max 8 words"}],"avoidList":[{"ticker":"","reason":"max 8 words"}]},"opportunities":[{"ticker":"","company":"","action":"BUY","currentPrice":"","entryZone":"$X-$Y","stopLoss":"$X","takeProfit":"$X","expectedGain":"15%","riskReward":"3:1","allocation":"10%","whyWeLikeIt":"max 15 words","whatCouldGoWrong":"max 10 words","upcomingEvent":"","eventDate":"DD Mon YYYY","trend":"","entryQuality":"GOOD","returnGate":"PASS","cashChallenge":"PASS","opportunityScore":75}]}`


      // Direct browser API call — no Vercel timeout
      // Pre-fetch SMA for top 8 priority stocks BEFORE AI runs
      // This means the AI prompt includes real technical data for these stocks
      const TOP_PRIORITY = ['NVDA','AVGO','MRVL','ARM','VRT','GEV','META','PLTR']
        .filter(t => (stocks||[]).some(s => s.ticker === t))
      if (TOP_PRIORITY.length) {
        try {
          const techRes = await fetch('/api/technicals?symbols=' + TOP_PRIORITY.slice(0,5).join(','), { cache: 'no-store' })
          if (techRes.ok) {
            const techData = await techRes.json()
            if (techData?.technicals) {
              setTechMap(prev => ({ ...prev, ...techData.technicals }))
            }
          }
        } catch {}
      }

      const ai = repairJSON(await claude(prompt, 'cio'))

      // Ground all prices with verified live data
      const pm = Object.fromEntries((stocks||[]).map(s=>[s.ticker,s]))
      const grounded = (ai.opportunities||[]).map(o => {
        const live = pm[o.ticker]||{}
        return {
          ...o,
          // Map new plain-English field names back to display fields
          thesis:      o.whyWeLikeIt      || o.thesis      || '',
          invalidation:o.whatCouldGoWrong || o.invalidation || '',
          catalyst:    o.upcomingEvent     || o.catalyst     || '',
          catalystDate:o.eventDate         || o.catalystDate || '',
          company:                 live.name || o.company || o.ticker,
          // Always prefer verified live price
          currentPrice:            live.priceFormatted || (o.currentPrice && o.currentPrice !== 'N/A' ? o.currentPrice : '—'),
          change1d:                live.change1d || null,
          changePctToday:          live.changePct || 0,
          direction:               live.direction || 'up',
          bigMoverToday:           live.bigMoverToday || false,
          earningsDate:            live.earningsDate || null,
          earningsTradingDaysAway: live.earningsTradingDaysAway ?? null,
          earningsSource:          live.earningsSource || null,
          hasVerifiedEarnings:     live.hasVerifiedEarnings || false,
          // Verified technical data from market route
          trend:        live.trend        || o.trend        || null,
          setup:        live.setup        || o.setup        || null,
          entryQuality: live.entryQuality || o.entryQuality || null,
          sma20:        live.sma20        ?? null,
          sma50:        live.sma50        ?? null,
          sma200:       live.sma200       ?? null,
          pctAbove200:  live.pctAbove200  ?? null,
          nearestSupport:    live.nearestSupport    || null,
          suggestedStopLoss: live.suggestedStopLoss || null,
        }
      })

      setData(p=>({...p, opportunities:{ ...ai, opportunities:grounded, earningsCalendar, vix, vixRegime, sectors, meta:md.meta }}))
      setLastUp(p=>({...p, opportunities:new Date().toISOString()}))
      if (grounded[0]) setSelected(grounded[0])
      // Fetch SMA and news data in background — won't block anything
      const allTickers = (stocks||[]).map(s=>s.ticker)
      fetchTechnicals(allTickers)
      fetchNews(allTickers)
    } catch(e) {
      setErrors(p=>({...p,opportunities:e.message}))
    } finally {
      setLoading(p=>({...p,opportunities:false}))
      setLoadingStep('')
    }
  }, [market, claude])

  // ── Global macro ───────────────────────────────────────────────────────────
  const loadGlobal = useCallback(async () => {
    setLoading(p=>({...p,global:true})); setErrors(p=>({...p,global:null}))
    try {
      const md = await market('global')
      const idxLines  = md.indices?.map(m=>`${m.name} ${m.value} ${m.change}`).join(', ')
      const secLines  = md.sectors?.map(s=>s.label+' '+s.change).join(', ')
      const commLines = md.commodities?.map(c=>`${c.name} ${c.value} ${c.change}`).join(', ')
      const fxLines   = md.currencies?.map(c=>`${c.pair} ${c.value} ${c.change}`).join(', ')

      const prompt = `Today: ${new Date().toDateString()}
Global indices: ${idxLines||'N/A'}
Sector performance: ${secLines||'N/A'}
Commodities: ${commLines||'N/A'}
FX: ${fxLines||'N/A'}
VIX proxy: ${md.vix||'N/A'} (${md.vixRegime||'N/A'})

You explain financial markets in simple, plain English for beginners. No jargon. Based ONLY on the data above, return JSON:
{"sentiment":"RISK ON|RISK OFF|NEUTRAL","sentimentReason":"one plain sentence explaining what markets are doing today and why, no jargon","regimeAdvice":"one plain actionable sentence for someone new to investing — what should they do with their money today","keyRisk":"biggest thing that could cause markets to fall, explained simply in one sentence","keyOpportunity":"biggest thing that could push markets higher, explained simply in one sentence","macroEvents":[{"event":"event name in plain English","detail":"one plain sentence explaining why this matters to investors","impact":"HIGH|MEDIUM|LOW"}]}`

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
Sector performance today: ${md.sectors?.map(s=>s.label+' '+s.change).join(', ')||'N/A'}
Gold: ${md.commodities?.find(c=>c.name?.includes('Gold'))?.change||'N/A'}

You explain financial risks in plain, simple English for beginner investors with 1-4 week holding periods.
Using the live data above plus your knowledge, explain the key risks over the next 8 weeks.
Name specific upcoming events and dates. No jargon. Short sentences.
Return JSON:
{"overallRisk":"HIGH|ELEVATED|MODERATE|LOW","cashSuggestion":"X%","positionSizingAdvice":"one plain sentence — e.g. keep each stock position under 10% of your money","macroRisks":[{"risk":"risk name in plain English","detail":"plain sentence explaining why this could hurt stock prices — name specific dates or events","severity":"HIGH|MEDIUM|LOW","action":"plain sentence on what to do about it"}],"geopoliticalRisks":[{"risk":"","detail":"plain sentence","severity":"","action":"plain sentence"}],"sectorRisks":[{"sector":"sector name","risk":"plain sentence on what could go wrong","severity":"","action":"plain sentence on what to do"}],"hedgeIdeas":["plain sentence explaining a simple protective move and why"],"bestEnvironmentFor":["plain sentence describing what kind of stocks or trades work best right now"]}`

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
      const hist = getEH(opp.ticker)
      const text = await claude(`Today: ${new Date().toDateString()}
Stock: ${opp.ticker} — ${opp.company}
Current price: ${opp.currentPrice}
Next earnings results: ${opp.earningsDate||'date not yet confirmed'} (${opp.earningsTradingDaysAway??'?'} trading days away)${opp.earningsSource==='estimate'?' — estimated date':' — confirmed date'}
Why we like it: ${opp.thesis}
Upcoming event: ${opp.catalyst||'N/A'}
Past earnings reactions: ${hist ? hist.label + (hist.live ? ' [live data]' : '') : 'not available'}
Suggested buy range: ${opp.entryZone||'N/A'} · Exit if it drops to: ${opp.stopLoss||'N/A'} · Price target: ${opp.takeProfit||opp.expectedGain||'N/A'}

Write a clear, simple analysis for someone new to investing. Use short sentences. No jargon.
Cover exactly these four sections with these headings:

WHY BUY NOW
Explain in 2-3 simple sentences why this is a good moment to consider buying. What is about to happen that could push the price up?

THE UPSIDE
In 2-3 sentences, explain what the best-case scenario looks like and roughly how much the price could rise.

THE RISK
In 2-3 sentences, explain the main thing that could go wrong and cause the price to fall instead.

WHEN TO BUY
In 1-2 sentences, describe the exact situation or price level you should wait for before buying.

After each sentence, add (FACT), (ANALYSIS) or (OPINION) so the reader knows what type of claim it is.
Keep total response under 280 words. Plain English only — no trading jargon.`, 'deepdive')
      setDrill(text)
    } catch(e) { setDrill(`Error: ${e.message}`) }
    finally { setDrillLoad(false) }
  }, [claude])

  // ── Portfolio analysis ────────────────────────────────────────────────────
  const addHolding = useCallback(() => {
    const ticker = newTicker.trim().toUpperCase()
    const buyPrice = parseFloat(newBuyPrice)
    const shares = parseFloat(newShares) || 1
    if (!ticker || isNaN(buyPrice) || buyPrice <= 0) return
    setHoldings(prev => {
      const existing = prev.findIndex(h => h.ticker === ticker)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], buyPrice, shares, currency: newCurrency }
        return updated
      }
      return [...prev, { ticker, buyPrice, shares, currency: newCurrency, addedAt: new Date().toISOString() }]
    })
    setNewTicker(''); setNewBuyPrice(''); setNewShares('')
    setPortfolioResult(null)
  }, [newTicker, newBuyPrice, newShares, newCurrency])

  const removeHolding = useCallback((ticker) => {
    setHoldings(prev => prev.filter(h => h.ticker !== ticker))
    setPortfolioResult(null)
  }, [])

  const analysePortfolio = useCallback(async () => {
    if (!holdings.length) return
    setPortfolioLoading(true)
    setPortfolioError(null)
    setPortfolioResult(null)
    try {
      // Fetch only the prices we need — much faster than loading all 44 universe stocks
      const tickers = holdings.map(h => h.ticker)
      const [priceRes, marketRes] = await Promise.all([
        fetch(`/api/prices?symbols=${tickers.join(',')}`, { cache: 'no-store' }),
        fetch('/api/market?type=global', { cache: 'no-store' }),  // VIX + sectors only
      ])
      const priceData  = await priceRes.json()
      const marketData = await marketRes.json()
      const priceMap = {}
      Object.entries(priceData.prices || {}).forEach(([ticker, q]) => {
        if (q) priceMap[ticker] = q
      })
      // Attach vix/sectors from global endpoint
      priceData.vix      = marketData.vix
      priceData.vixRegime= marketData.vixRegime
      priceData.sectors  = marketData.sectors

      // Build holdings with live prices
      const enriched = holdings.map(h => {
        const live = priceMap[h.ticker]
        const livePrice = live?.price || null
        const gainPct = livePrice ? ((livePrice - h.buyPrice) / h.buyPrice * 100) : null
        const gainAbs = livePrice ? ((livePrice - h.buyPrice) * h.shares) : null
        const hist = getEH(h.ticker)
        return {
          ...h,
          livePrice,
          livePriceFormatted: livePrice ? `$${livePrice.toFixed(2)}` : 'Price unavailable',
          gainPct:     gainPct !== null ? parseFloat(gainPct.toFixed(2)) : null,
          gainAbs:     gainAbs !== null ? parseFloat(gainAbs.toFixed(2)) : null,
          totalValue:  livePrice ? livePrice * h.shares : null,
          change1d:    live?.change1d || null,
          direction:   live?.direction || null,
          earningsDate: null,                // earnings from calendar, not price feed
          earningsTradingDaysAway: null,
          earningsSource: null,
          earningsHistory: hist ? hist.label : null,
        }
      })

      // Build AI prompt
      const holdingsText = enriched.map(h => [
        `${h.ticker}: bought at ${h.currency}${h.buyPrice} × ${h.shares} shares`,
        h.livePrice ? `current price $${h.livePrice.toFixed(2)} (${h.gainPct >= 0 ? '+' : ''}${h.gainPct?.toFixed(1) || '?'}% gain, total P&L ${h.currency}${h.gainAbs?.toFixed(2) || '?'})` : 'price unavailable',
        h.change1d ? `today ${h.change1d}` : '',
        h.earningsDate ? `next earnings ${h.earningsDate} (${h.earningsTradingDaysAway}d away)` : 'no upcoming earnings confirmed',
        h.earningsHistory ? `past reactions: ${h.earningsHistory}` : '',
      ].filter(Boolean).join(' | ')).join('\n')

      const prompt = `Today: ${new Date().toDateString()}

PORTFOLIO HOLDINGS:
${holdingsText}

CURRENT MARKET CONTEXT:
VIX: ${marketData.vix || 'N/A'} (${marketData.vixRegime || 'N/A'})
Sector health: ${(marketData.sectors || []).map(s => s.label+' '+s.change).join(', ')}

RULES:
1. For each holding, give exactly one action: BUY MORE / HOLD / TRIM (sell some) / SELL ALL
2. BUY MORE only if: stock is down or flat, upcoming catalyst within 40 days, thesis intact, average down makes sense
3. TRIM if: stock is up 15%+ and catalyst is now priced in, or position is oversize
4. SELL ALL if: thesis broken, company fundamental problem, or better opportunity exists
5. HOLD if: catalyst still upcoming, thesis intact, position size reasonable
6. Be specific — name exact price levels and reasons in plain English
7. Consider the person's actual buy price — are they in profit or loss?
8. At the end, give an overall portfolio health summary and total estimated P&L

Write in plain English. No jargon. Short sentences. As if explaining to someone new to investing.

Return JSON:
{"portfolioSummary":"2 sentences on overall portfolio health","totalGainLossPct":"overall %","cashSuggestion":"how much cash to hold right now","holdings":[{"ticker":"","action":"BUY MORE|HOLD|TRIM|SELL ALL","confidence":"HIGH|MEDIUM|LOW","currentPrice":"","buyPrice":"","gainLossPct":"","recommendation":"2 plain sentences explaining exactly what to do and why","entryIfBuyMore":"price to buy more at if action is BUY MORE","exitIfSell":"price to sell at if trimming or selling","urgency":"NOW|THIS WEEK|NO RUSH"}]}`

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode: 'cio' }),
      })
      // Handle both text/plain (streaming) and JSON responses
      let rawText
      if (res.headers.get('content-type')?.includes('text/plain')) {
        rawText = await res.text()
      } else {
        const aiData = await res.json()
        if (!res.ok) throw new Error(aiData.error || 'AI error')
        rawText = aiData.content?.find(b => b.type === 'text')?.text || ''
      }
      if (!rawText) throw new Error('No response from AI')

      let parsed
      try {
        parsed = repairJSON(rawText)
      } catch {
        parsed = { portfolioSummary: rawText.slice(0, 200), holdings: [] }
      }

      setPortfolioResult({ ...parsed, enriched })
    } catch (e) {
      setPortfolioError(e.message)
    } finally {
      setPortfolioLoading(false)
    }
  }, [holdings, getEH])

  // ── T212 API functions ────────────────────────────────────────────────────
  const fetchT212 = useCallback(async () => {
    setT212Loading(true)
    setT212Error(null)
    try {
      const r = await fetch('/api/t212', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `T212 error ${r.status}`)
      setT212Data(d)
      setT212Result(null)  // clear previous analysis when data refreshes
    } catch (e) {
      setT212Error(e.message)
    } finally {
      setT212Loading(false)
    }
  }, [])

  const analyseT212 = useCallback(async () => {
    if (!t212Data?.positions?.length) return
    setT212AnalysisLoad(true)
    try {
      // Fetch only the prices for stocks we actually hold — much faster
      const t212Tickers = t212Data.positions.map(p => p.ticker)
      const [priceRes, marketRes] = await Promise.all([
        fetch(`/api/prices?symbols=${t212Tickers.join(',')}`, { cache: 'no-store' }),
        fetch('/api/market?type=global', { cache: 'no-store' }),  // VIX + sectors only
      ])
      const priceJson  = await priceRes.json()
      const marketData = await marketRes.json()
      const priceMap = {}
      Object.entries(priceJson.prices || {}).forEach(([ticker, q]) => {
        if (q) priceMap[ticker] = q
      })

      // Enrich T212 positions with Finnhub data
      // T212 already provides currentPrice — we use Finnhub for change1d and earnings
      const enriched = t212Data.positions.map(p => {
        const live = priceMap[p.ticker]  // from fast /api/prices endpoint
        const hist = getEH(p.ticker)
        return {
          ...p,
          finnhubPrice:    live?.price || null,
          change1d:        live?.change1d || null,
          earningsDate:    null,   // earnings come from calendar, added separately if needed
          earningsDays:    null,
          earningsSource:  null,
          earningsHistory: hist?.label || null,
          livePrice:       p.currentPrice || live?.price || null,
        }
      })

      // Build AI prompt
      const posLines = enriched.map(p =>
        `${p.ticker}: ${p.quantity} shares, avg buy price £${p.averagePrice}, current £${p.currentPrice?.toFixed(2)}, P&L £${p.ppl} (${p.gainPct >= 0 ? '+' : ''}${p.gainPct}%)` +
        (p.change1d ? `, today ${p.change1d}` : '') +
        (p.earningsDate ? `, earnings ${p.earningsDate} in ${p.earningsDays}d` : '') +
        (p.earningsHistory ? `, history: ${p.earningsHistory}` : '')
      ).join('\n')

      const pendingLines = (t212Data.pendingOrders || []).map(o =>
        `${o.side} ${o.quantity} ${o.ticker} @ £${o.limitPrice} (${o.orderType})`
      ).join('\n') || 'None'

      const prompt = `Today: ${new Date().toDateString()}
TRADING 212 LIVE PORTFOLIO (${t212Data.env || 'LIVE'} account):

CASH POSITION:
Free cash: £${t212Data.cash?.free || '?'}
Total invested: £${t212Data.cash?.invested || '?'}
Total portfolio value: £${t212Data.cash?.total || '?'}
Total P&L: £${t212Data.cash?.ppl || '?'}

CURRENT POSITIONS:
${posLines}

PENDING ORDERS:
${pendingLines}

MARKET CONTEXT:
VIX: ${marketData.vix || 'N/A'} (${marketData.vixRegime || 'N/A'})
Sectors today: ${(marketData.sectors || []).map(s => "${s.label} ${s.change}").join(', ')}

RULES:
1. Use earnings dates from calendar — stocks 33-45 days to earnings are PRIME BUY candidates
2. Stock up >8% today = max WATCH
3. Only BUY if 15%+ gain path exists within 45 trading days
4. DOWNTREND = max WATCH. PULLBACK IN UPTREND = ideal BUY entry.
5. currentPrice MUST be exact dollar from PRICES above
6. Include WATCH cards for NVDA, MRVL even without near-term earnings
7. Sort: BUYs first, then WATCHes by score

COVERAGE:
- watchList: 5-8 most interesting stocks not in opportunities
- avoidList: 5-8 stocks to avoid (gap-up, downtrend, broken thesis)

LANGUAGE: Plain English, short sentences, beginner-friendly.

Return ONLY this JSON (up to 10 cards):
{"marketCondition":"BUY SELECTIVELY","cashRecommendation":"one sentence","cashPct":30,"regime":"one sentence","cio":{"bestTradeToday":"TICKER","bestRiskReward":"TICKER","finalMarketDecision":"BUY SELECTIVELY","watchList":[{"ticker":"","reason":"max 8 words"}],"avoidList":[{"ticker":"","reason":"max 8 words"}]},"opportunities":[{"ticker":"","company":"","action":"BUY","currentPrice":"","entryZone":"$X-$Y","stopLoss":"$X","takeProfit":"$X","expectedGain":"15%","riskReward":"3:1","allocation":"10%","whyWeLikeIt":"max 15 words","whatCouldGoWrong":"max 10 words","upcomingEvent":"","eventDate":"DD Mon YYYY","trend":"","entryQuality":"GOOD","returnGate":"PASS","cashChallenge":"PASS","opportunityScore":75}]}` 

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode: 'cio' }),
      })
      let rawT212Text
      if (res.headers.get('content-type')?.includes('text/plain')) {
        rawT212Text = await res.text()
      } else {
        const aiData = await res.json()
        if (!res.ok) throw new Error(aiData.error || 'AI error')
        rawT212Text = aiData.content?.find(b => b.type === 'text')?.text || ''
      }
      if (!rawT212Text) throw new Error('No response from AI')

      let parsed
      try {
        parsed = repairJSON(rawT212Text)
      } catch {
        parsed = { portfolioHealth: 'GOOD', overallSummary: rawT212Text.slice(0, 200), holdings: [] }
      }

      setT212Result({ ...parsed, enriched, raw: t212Data })
    } catch (e) {
      setT212Error(e.message)
    } finally {
      setT212AnalysisLoad(false)
    }
  }, [t212Data, getEH])

  const loaders = { opportunities:loadOpps, global:loadGlobal, risk:loadRisk }

  // Per-card deep dive state
  const [cardDrills, setCardDrills]       = useState({})
  const [cardDrillLoad, setCardDrillLoad] = useState({})

  const handleCardDive = useCallback(async (opp) => {
    if (cardDrills[opp.ticker]) return
    setCardDrillLoad(p => ({ ...p, [opp.ticker]: true }))
    try {
      const hist = getEH(opp.ticker)
      const text = await claude(`Today: ${new Date().toDateString()}
Stock: ${opp.ticker} — ${opp.company}
Current price: ${opp.currentPrice}
Next earnings: ${opp.earningsDate ? ukDate(opp.earningsDate) : 'not yet confirmed'} (${opp.earningsTradingDaysAway??'?'} trading days away)
Why we like it: ${opp.thesis}
Upcoming event: ${opp.catalyst||'N/A'}
Past reactions: ${hist ? hist.label : 'not available'}
Buy range: ${opp.entryZone||'N/A'} · Exit if below: ${opp.stopLoss||'N/A'} · Target: ${opp.takeProfit||opp.expectedGain||'N/A'}

Write a simple, clear analysis for a beginner investor. Short sentences. No jargon.

WHY BUY NOW
2-3 sentences on why this is a good moment to consider buying.

THE UPSIDE
2-3 sentences on what the best case looks like and how much the price could rise.

THE RISK
2-3 sentences on what could go wrong.

WHEN TO BUY
1-2 sentences on the exact price or situation to wait for before buying.

Mark each sentence with (FACT), (ANALYSIS) or (OPINION). Under 260 words.`, 'deepdive')
      setCardDrills(p => ({ ...p, [opp.ticker]: text }))
    } catch(e) {
      setCardDrills(p => ({ ...p, [opp.ticker]: `Error: ${e.message}` }))
    } finally {
      setCardDrillLoad(p => ({ ...p, [opp.ticker]: false }))
    }
  }, [claude, cardDrills, getEH])

  useEffect(() => { fetchEarningsHistory() }, []) // eslint-disable-line
  useEffect(() => {
    try {
      if (sessionStorage.getItem('catalyst_portfolio_auth') === 'true') setPortfolioUnlocked(true)
      if (sessionStorage.getItem('catalyst_t212_auth')      === 'true') setT212Unlocked(true)
    } catch {}
  }, [])
  useEffect(() => {
    try {
      const saved = localStorage.getItem('catalyst_holdings')
      if (saved) setHoldings(JSON.parse(saved))
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('catalyst_holdings', JSON.stringify(holdings)) } catch {}
  }, [holdings])
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
  }, [activeTab]) // eslint-disable-line

  // ── CIO panel ──────────────────────────────────────────────────────────────
  function CIOPanelInner({ cio, marketCondition, vix, vixRegime, sectors, regime, cashPct, cashRecommendation }) {
    const condTone = marketCondition==='BUY AGGRESSIVELY'?'green':marketCondition==='BUY SELECTIVELY'?'blue':marketCondition==='WAIT'?'amber':'red'
    const vixTone  = vixRegime==='HIGH_FEAR'?'red':vixRegime==='ELEVATED'?'amber':'green'
    return (
      <div style={{ ...card({ marginBottom:14 }) }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', marginBottom:14, paddingBottom:12, borderBottom:`1px solid ${C.border}` }}>
          {marketCondition && <Pill tone={condTone} size="lg">{marketCondition}</Pill>}
          {vix && <Pill tone={vixTone} size="md">VIX {vix} · {vixRegime}</Pill>}
          {(sectors||[]).map((s,i) => <Pill key={i} tone={s.direction==='BULLISH'||s.direction==='up'?'green':'red'} size="sm">{s.label} {s.change}</Pill>)}
        </div>
        {cio && (
          <div style={{ display:'grid', gridTemplateColumns:mob?'1fr 1fr':'repeat(3,1fr)', gap:10, marginBottom:14 }}>
            {[['⚡ Best Buy Today',cio.bestTradeToday,'green'],['📐 Best Value Setup',cio.bestRiskReward,'blue'],['🎯 Overall Advice',cio.finalMarketDecision,condTone]].filter(([,v])=>v).map(([l,v,tone])=>(
              <div key={l} style={{ background:TONES[tone][1], borderRadius:10, padding:'10px 14px', border:`1px solid ${TONES[tone][0]}33` }}>
                <div style={{ color:C.muted, fontSize:11, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase', marginBottom:4 }}>{l}</div>
                <div style={{ color:TONES[tone][0], fontWeight:900, fontSize:18, fontFamily:FM }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {(cashRecommendation || regime) && (
          <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:cio?.watchList?.length||cio?.avoidList?.length?12:0, paddingBottom:cio?.watchList?.length||cio?.avoidList?.length?12:0, borderBottom:cio?.watchList?.length||cio?.avoidList?.length?`1px solid ${C.border}`:'none', flexWrap:'wrap' }}>
            {cashPct!=null && <Pill tone="amber" size="md">💰 {cashPct}% CASH</Pill>}
            <span style={{ color:C.sub, fontSize:13 }}>{regime || cashRecommendation}</span>
          </div>
        )}
        {cio?.watchList?.length > 0 && (
          <div style={{ marginBottom:cio?.avoidList?.length?10:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <div style={LBL}>👀 KEEP AN EYE ON THESE</div>
              <span style={{ color:C.muted, fontSize:11 }}>({cio.watchList.length} stocks)</span>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {cio.watchList.map((w,i)=>(
                <div key={i} style={{ background:C.amberBg, border:`1px solid ${C.amber}33`, borderRadius:8, padding:'5px 10px' }}>
                  <span style={{ color:C.amber, fontWeight:800, fontFamily:FM, fontSize:13 }}>{w.ticker||w}</span>
                  {w.reason && <span style={{ color:C.sub, fontSize:12 }}> — {w.reason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {cio?.avoidList?.length > 0 && (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <div style={LBL}>🚫 DON'T BUY THESE NOW</div>
              <span style={{ color:C.muted, fontSize:11 }}>({cio.avoidList.length} stocks)</span>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {cio.avoidList.map((w,i)=>(
                <div key={i} style={{ background:C.downBg, border:`1px solid ${C.down}33`, borderRadius:8, padding:'5px 10px' }}>
                  <span style={{ color:C.down, fontWeight:800, fontFamily:FM, fontSize:13 }}>{w.ticker||w}</span>
                  {w.reason && <span style={{ color:C.sub, fontSize:12 }}> — {w.reason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Earnings calendar ──────────────────────────────────────────────────────
  function EarningsCalendar({ calendar }) {
    if (!calendar?.length) return null
    const items = calendar.filter(e => (e.tradingDaysAway??-1) >= 0).slice(0,12)
    if (!items.length) return null
    return (
      <div style={{ ...card({ marginTop:18 }) }}>
        <div style={{ ...LBL, marginBottom:4 }}>📅 UPCOMING EARNINGS RESULTS — NEXT 60 DAYS</div>
        <div style={{ color:C.muted, fontSize:12, marginBottom:12 }}>Companies below are reporting their financial results soon. This is when big price moves happen.</div>
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
                  {e.source==='confirmed'  && <span style={{ background:C.upBg,    color:C.up,    fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:4 }}>✓</span>}
                  {e.source==='estimate'   && <span style={{ background:C.amberBg, color:C.amber, fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:4 }}>EST</span>}
                  {e.source==='conflicted' && <span style={{ background:C.downBg,  color:C.down,  fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:4 }}>⚠</span>}
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

  // ── renderOpps ─────────────────────────────────────────────────────────────
  function renderOpps() {
    const d = data.opportunities
    if (!d) return null
    const opps = d.opportunities||[]
    const visibleOpps = showAllOpps ? opps : opps.slice(0, 8)

    return (
      <>
        <CIOPanelInner cio={d.cio} marketCondition={d.marketCondition} vix={d.vix} vixRegime={d.vixRegime} sectors={d.sectors} regime={d.regime} cashPct={d.cashPct} cashRecommendation={d.cashRecommendation} />
        <div style={{ display:'grid', gridTemplateColumns:mob?'1fr':'minmax(0,1fr) minmax(310px,340px)', gap:18, alignItems:'start' }}>
          <div>
            <div style={{ display:'grid', gridTemplateColumns:mob?'1fr':opps.length>3?'repeat(2,1fr)':'1fr', gap:14 }}>
              {visibleOpps.length
                ? visibleOpps.map((o,i) => <OppCard key={o.ticker+i} opp={o} rank={i+1} active={selected?.ticker===o.ticker} onClick={handleClick} onDeepDive={handleCardDive} deepDiveLoading={!!cardDrillLoad[o.ticker]} deepDiveContent={cardDrills[o.ticker]} getEH={getEH} techMap={techMap} />)
                : (
                  <div style={{ ...card({ textAlign:'center', padding:48, gridColumn:'1/-1' }) }}>
                    <div style={{ fontSize:36, marginBottom:12 }}>💵</div>
                    <div style={{ color:C.text, fontWeight:700, fontSize:18, marginBottom:8 }}>No qualifying opportunities</div>
                    <div style={{ color:C.muted, fontSize:14, maxWidth:380, margin:'0 auto' }}>All candidates failed Return Gate or Cash Challenge. The AI recommends holding cash — this is a valid and correct outcome.</div>
                  </div>
                )
              }
            </div>
            {opps.length > 8 && (
              <button onClick={() => setShowAllOpps(s=>!s)} style={{ appearance:'none', background:C.card, border:'1.5px solid '+(showAllOpps?C.border:C.accent), color:showAllOpps?C.muted:C.accent, borderRadius:10, padding:'12px 24px', fontWeight:700, fontSize:14, cursor:'pointer', width:'100%', marginTop:14, marginBottom:4 }}>
                {showAllOpps ? '▲ Show less' : '▼ Show '+(opps.length-8)+' more opportunities'}
              </button>
            )}
            <EarningsCalendar calendar={d.earningsCalendar} />
          </div>
          {!mob && (
            <div style={{ ...card({ position:'sticky', top:16 }) }}>
              <div style={{ ...LBL, marginBottom:14 }}>SELECTED SETUP</div>
              {selected ? (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                    <div>
                      <div style={{ fontFamily:FM, fontWeight:900, fontSize:28, color:C.text }}>{selected.ticker}</div>
                      <div style={{ color:C.muted, fontSize:13 }}>{selected.company}</div>
                    </div>
                    <ActionBadge action={selected.action} size="lg" />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                    {[['Current Price',selected.currentPrice],['Target Price',selected.takeProfit||selected.expectedGain],['Exit if below',selected.stopLoss],['Reward vs Risk',selected.riskReward],['Buy between',selected.entryZone],['Portfolio %',selected.allocation]].map(([l,v]) => v ? (
                      <div key={l} style={{ background:C.bg, borderRadius:10, padding:'10px 12px' }}>
                        <div style={LBL}>{l}</div>
                        <div style={{ ...VAL, fontSize:14 }}>{v}</div>
                      </div>
                    ) : null)}
                  </div>
                  {selected.earningsDate && (
                    <div style={{ background:C.amberBg, borderRadius:10, padding:'10px 14px', marginBottom:10 }}>
                      <div style={LBL}>EARNINGS DATE{selected.earningsSource==='estimate'?' (EST)':' (VERIFIED)'}</div>
                      <div style={{ color:C.amber, fontWeight:900, fontSize:18, fontFamily:FM }}>{ukDate(selected.earningsDate)}</div>
                      <div style={{ color:C.amber, fontSize:13, marginTop:2 }}>{selected.earningsTradingDaysAway} trading days away</div>
                    </div>
                  )}
                  {selected.catalyst && (
                    <div style={{ marginBottom:10 }}>
                      <div style={LBL}>UPCOMING EVENT</div>
                      <div style={{ ...VAL, fontSize:14 }}>{selected.catalyst}</div>
                    </div>
                  )}
                  {selected.invalidation && (
                    <div style={{ background:C.downBg, borderRadius:10, padding:'10px 14px', marginBottom:14 }}>
                      <div style={LBL}>🚨 SELL IMMEDIATELY IF...</div>
                      <div style={{ color:C.down, fontSize:13, fontWeight:600 }}>{selected.invalidation}</div>
                    </div>
                  )}
                  <div style={{ height:1, background:C.border, margin:'12px 0' }} />
                  <div style={{ ...LBL, marginBottom:10 }}>DEEP DIVE ANALYSIS</div>
                  {drillLoad
                    ? <div style={{ color:C.muted, fontSize:13 }}>Analysing {selected.ticker}…</div>
                    : drill
                      ? <div style={{ color:C.sub, fontSize:14, lineHeight:1.75, whiteSpace:'pre-wrap' }}>{drill}</div>
                      : <button onClick={() => selected && deepDive(selected)} style={{ appearance:'none', background:C.accent, color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontWeight:700, fontSize:14, cursor:'pointer' }}>▶ Run deep dive</button>
                  }
                </>
              ) : <div style={{ color:C.muted, fontSize:14 }}>Tap an opportunity to see details.</div>}
            </div>
          )}
        </div>
        {mob && showOverlay && selected && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:200, overflowY:'auto', padding:16 }} onClick={e => { if(e.target===e.currentTarget) setShowOverlay(false) }}>
            <div style={{ maxWidth:500, margin:'0 auto' }}>
              <button onClick={() => setShowOverlay(false)} style={{ width:'100%', marginBottom:10, padding:'12px', background:C.card, border:`1px solid ${C.border}`, borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', color:C.sub, appearance:'none' }}>← Back</button>
              <div style={{ ...card() }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <span style={{ fontFamily:FM, fontWeight:900, fontSize:24 }}>{selected.ticker}</span>
                  <ActionBadge action={selected.action} size="lg" />
                </div>
                {drillLoad ? <div style={{ color:C.muted }}>Analysing…</div> : drill ? <div style={{ color:C.sub, fontSize:13, lineHeight:1.7, whiteSpace:'pre-wrap' }}>{drill}</div> : <button onClick={() => deepDive(selected)} style={{ appearance:'none', background:C.accent, color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontWeight:700, fontSize:14, cursor:'pointer' }}>▶ Deep dive</button>}
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // ── renderGlobal ───────────────────────────────────────────────────────────
  function renderGlobal() {
    const d = data.global
    if (!d) return null
    const sentTone = d.sentiment==='RISK ON'?'green':d.sentiment==='RISK OFF'?'red':'grey'
    const vixTone  = d.vixRegime==='HIGH_FEAR'?'red':d.vixRegime==='ELEVATED'?'amber':'green'
    return (
      <>
        <div style={{ ...card({ marginBottom:14 }), display:'grid', gridTemplateColumns:mob?'1fr':'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
          <div>
            <Pill tone={sentTone} size="lg" style={{ marginBottom:8 }}>{d.sentiment||'NEUTRAL'}</Pill>
            <div style={{ color:C.sub, fontSize:14, marginTop:8 }}>{d.sentimentReason}</div>
            {d.regimeAdvice && <div style={{ color:C.muted, fontSize:13, marginTop:6, fontStyle:'italic' }}>{d.regimeAdvice}</div>}
          </div>
          {d.vix && <div style={{ background:C.bg, borderRadius:12, padding:'12px 14px' }}><div style={LBL}>VIX</div><Pill tone={vixTone} size="lg">{d.vix} — {d.vixRegime}</Pill></div>}
          {d.keyRisk && <div style={{ background:C.downBg, borderRadius:12, padding:'12px 14px' }}><div style={LBL}>KEY RISK</div><div style={{ color:C.down, fontSize:13, fontWeight:600 }}>{d.keyRisk}</div></div>}
          {d.keyOpportunity && <div style={{ background:C.upBg, borderRadius:12, padding:'12px 14px' }}><div style={LBL}>KEY OPPORTUNITY</div><div style={{ color:C.up, fontSize:13, fontWeight:600 }}>{d.keyOpportunity}</div></div>}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:18 }}>
          {(d.indices||[]).map((m,i) => (
            <div key={i} style={{ ...card({ padding:14 }) }}>
              <div style={LBL}>{m.name}</div>
              <div style={{ color:C.text, fontFamily:FM, fontWeight:800, fontSize:19 }}>{m.value}</div>
              <div style={{ color:m.direction==='up'?C.up:C.down, fontFamily:FM, fontWeight:700, fontSize:13, marginTop:2 }}>{m.change}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:mob?'1fr':'repeat(auto-fit,minmax(280px,1fr))', gap:18 }}>
          <div style={card()}>
            <div style={{ ...LBL, marginBottom:14 }}>SECTOR PERFORMANCE TODAY</div>
            {(d.sectors||[]).map((s,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:i<d.sectors.length-1?`1px solid ${C.border}`:'none' }}>
                <span style={{ color:C.sub, fontSize:14 }}>{s.label}</span>
                <span style={{ color:s.direction==='up'?C.up:C.down, fontFamily:FM, fontWeight:700, fontSize:14 }}>{s.change}</span>
              </div>
            ))}
          </div>
          <div style={card()}>
            <div style={{ ...LBL, marginBottom:14 }}>COMMODITIES</div>
            {(d.commodities||[]).map((c,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:i<d.commodities.length-1?`1px solid ${C.border}`:'none' }}>
                <span style={{ color:C.sub, fontSize:14 }}>{c.name}</span>
                <span style={{ color:c.direction==='up'?C.up:C.down, fontFamily:FM, fontWeight:700 }}>{c.value} {c.change}</span>
              </div>
            ))}
            {d.currencies?.length>0 && (<>
              <div style={{ height:1, background:C.border, margin:'12px 0' }} />
              <div style={{ ...LBL, marginBottom:10 }}>FX</div>
              {d.currencies.map((c,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0' }}>
                  <span style={{ color:C.sub, fontSize:14, fontWeight:600 }}>{c.pair}</span>
                  <span style={{ color:C.text, fontFamily:FM, fontWeight:700 }}>{c.value} <span style={{ color:C.muted, fontSize:12 }}>{c.change}</span></span>
                </div>
              ))}
            </>)}
          </div>
          {d.macroEvents?.length>0 && (
            <div style={card()}>
              <div style={{ ...LBL, marginBottom:14 }}>MACRO EVENTS</div>
              {d.macroEvents.map((e,i) => (
                <div key={i} style={{ marginBottom:12 }}>
                  <div style={{ color:C.text, fontWeight:700, fontSize:14 }}>{e.event}</div>
                  {e.detail && <div style={{ color:C.muted, fontSize:13, marginTop:3 }}>{e.detail}</div>}
                  <div style={{ marginTop:6 }}><Pill tone={e.impact==='HIGH'?'red':e.impact==='MEDIUM'?'amber':'grey'} size="sm">{e.impact}</Pill></div>
                  {i<d.macroEvents.length-1 && <div style={{ height:1, background:C.border, margin:'12px 0' }} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    )
  }

  // ── renderRisk ─────────────────────────────────────────────────────────────
  function renderRisk() {
    const d = data.risk
    if (!d) return null
    const riskTone = d.overallRisk==='LOW'?'green':d.overallRisk==='MODERATE'?'amber':'red'
    const vixTone  = d.vixRegime==='HIGH_FEAR'?'red':d.vixRegime==='ELEVATED'?'amber':'green'
    return (
      <>
        <div style={{ ...card({ marginBottom:14, padding:'14px 18px' }), display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
          <Pill tone={riskTone} size="lg">RISK: {d.overallRisk||'MODERATE'}</Pill>
          {d.vix && <Pill tone={vixTone} size="md">VIX {d.vix} · {d.vixRegime}</Pill>}
          {d.cashSuggestion && <Pill tone="amber" size="md">💰 Hold {d.cashSuggestion} cash</Pill>}
          {d.positionSizingAdvice && <span style={{ color:C.sub, fontSize:14 }}>{d.positionSizingAdvice}</span>}
        </div>
        {(d.bestEnvironmentFor?.length||d.hedgeIdeas?.length) && (
          <div style={{ display:'grid', gridTemplateColumns:mob?'1fr':'1fr 1fr', gap:14, marginBottom:18 }}>
            {d.bestEnvironmentFor?.length>0 && <div style={{ ...card({ borderLeft:`3px solid ${C.up}` }) }}><div style={{ ...LBL, marginBottom:10 }}>✅ WORKS BEST NOW</div>{d.bestEnvironmentFor.map((t,i)=><div key={i} style={{ color:C.up, fontSize:14, fontWeight:600, marginBottom:6 }}>• {t}</div>)}</div>}
            {d.hedgeIdeas?.length>0 && <div style={{ ...card({ borderLeft:`3px solid ${C.amber}` }) }}><div style={{ ...LBL, marginBottom:10 }}>🛡 HEDGE IDEAS</div>{d.hedgeIdeas.map((h,i)=><div key={i} style={{ color:C.sub, fontSize:14, marginBottom:6 }}>• {h}</div>)}</div>}
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:mob?'1fr':'repeat(auto-fit,minmax(300px,1fr))', gap:18 }}>
          {[['⚠️ Macro Risks',d.macroRisks,r=>r.risk,r=>r.detail,r=>r.severity,r=>r.action],['🌍 Geopolitical',d.geopoliticalRisks,r=>r.risk,r=>r.detail,r=>r.severity,r=>r.action],['📊 Sector Risks',d.sectorRisks,r=>r.sector,r=>r.risk,r=>r.severity,r=>r.action]].map(([title,items,tFn,dFn,sFn,aFn])=>(
            <div key={title} style={card()}>
              <div style={{ ...LBL, marginBottom:14 }}>{title}</div>
              {!(items?.length) && <div style={{ color:C.muted, fontSize:13 }}>None identified</div>}
              {(items||[]).map((r,i)=>(
                <div key={i} style={{ marginBottom:12 }}>
                  <div style={{ color:C.text, fontWeight:700, fontSize:14 }}>{tFn(r)}</div>
                  <div style={{ color:C.muted, fontSize:13, marginTop:3 }}>{dFn(r)}</div>
                  {aFn(r) && <div style={{ color:C.accent, fontSize:13, marginTop:4, fontWeight:600 }}>→ {aFn(r)}</div>}
                  <div style={{ marginTop:6 }}><Pill tone={sFn(r)==='HIGH'?'red':sFn(r)==='MEDIUM'?'amber':'grey'} size="sm">{sFn(r)}</Pill></div>
                  {i<(items?.length||0)-1 && <div style={{ height:1, background:C.border, margin:'12px 0' }} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </>
    )
  }

  // ── renderPortfolio ────────────────────────────────────────────────────────
  function renderPortfolio() {
    if (!portfolioUnlocked) {
      return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:400, padding:24 }}>
          <div style={{ ...card({ maxWidth:380, width:'100%', textAlign:'center', padding:36 }) }}>
            <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
            <div style={{ color:C.text, fontWeight:800, fontSize:20, marginBottom:8 }}>Portfolio is protected</div>
            <div style={{ color:C.muted, fontSize:14, marginBottom:24, lineHeight:1.6 }}>Enter your password to continue.</div>
            <input type="password" value={passwordInput} onChange={e=>{setPasswordInput(e.target.value);setPasswordError(false)}} onKeyDown={e=>e.key==='Enter'&&handlePasswordSubmit()} placeholder="Enter password" autoFocus style={{ width:'100%', padding:'12px 16px', borderRadius:10, border:`2px solid ${passwordError?C.down:C.border}`, fontSize:16, fontFamily:FM, outline:'none', background:C.bg, marginBottom:12, boxSizing:'border-box', textAlign:'center', letterSpacing:4 }} />
            {passwordError && <div style={{ color:C.down, fontSize:13, marginBottom:12, fontWeight:600 }}>Incorrect password.</div>}
            <button onClick={handlePasswordSubmit} style={{ appearance:'none', background:C.accent, color:'#fff', border:'none', borderRadius:10, padding:'12px 24px', fontWeight:800, fontSize:15, cursor:'pointer', width:'100%' }}>Unlock Portfolio</button>
          </div>
        </div>
      )
    }
    const result = portfolioResult
    const actionColor = a => a==='BUY MORE'?C.up:a==='HOLD'?C.accent:a==='TRIM'?C.amber:C.down
    const actionBg    = a => a==='BUY MORE'?C.upBg:a==='HOLD'?C.accentBg:a==='TRIM'?C.amberBg:C.downBg
    return (
      <div>
        <div style={{ ...card({ marginBottom:18 }) }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <div style={{ color:C.text, fontWeight:800, fontSize:18 }}>💼 My Holdings</div>
            <button onClick={()=>{setPortfolioUnlocked(false);setPasswordInput('');try{sessionStorage.removeItem('catalyst_portfolio_auth')}catch{}}} style={{ appearance:'none', background:'none', border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 12px', color:C.muted, fontSize:12, cursor:'pointer', fontWeight:600 }}>🔒 Lock</button>
          </div>
          <div style={{ color:C.muted, fontSize:13, marginBottom:18 }}>Enter each stock you own, what you paid, and how many shares.</div>
          <div style={{ display:'grid', gridTemplateColumns: mob ? '1fr 1fr' : '2fr 1.5fr 1fr 1fr auto', gap:10, marginBottom:14, alignItems:'end' }}>
            <div><div style={LBL}>TICKER</div><input value={newTicker} onChange={e=>setNewTicker(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&addHolding()} placeholder="e.g. NVDA" style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:15, fontFamily:FM, fontWeight:700, outline:'none', boxSizing:'border-box', background:C.bg }} /></div>
            <div><div style={LBL}>PRICE PAID ($)</div><input value={newBuyPrice} onChange={e=>setNewBuyPrice(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addHolding()} placeholder="450.00" type="number" style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:15, fontFamily:FM, outline:'none', boxSizing:'border-box', background:C.bg }} /></div>
            <div><div style={LBL}>SHARES</div><input value={newShares} onChange={e=>setNewShares(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addHolding()} placeholder="10" type="number" style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:15, fontFamily:FM, outline:'none', boxSizing:'border-box', background:C.bg }} /></div>
            <div><div style={LBL}>CURRENCY</div><select value={newCurrency} onChange={e=>setNewCurrency(e.target.value)} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:FB, outline:'none', background:C.bg }}><option>USD</option><option>GBP</option><option>EUR</option></select></div>
            <button onClick={addHolding} style={{ appearance:'none', background:C.accent, color:'#fff', border:'none', borderRadius:8, padding:'11px 18px', fontWeight:700, fontSize:14, cursor:'pointer' }}>+ Add</button>
          </div>
          {holdings.length > 0 && (
            <div style={{ display:'grid', gap:8, marginBottom:18 }}>
              {holdings.map((h,i) => {
                const r = result?.enriched?.find(e=>e.ticker===h.ticker)
                const ai = result?.holdings?.find(x=>x.ticker===h.ticker)
                const gainPct = r?.gainPct
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, background: gainPct!=null?(gainPct>=0?C.upBg:C.downBg):C.bg, borderRadius:10, padding:'10px 14px', flexWrap:'wrap' }}>
                    <span style={{ fontFamily:FM, fontWeight:900, fontSize:17, color:C.text, minWidth:60 }}>{h.ticker}</span>
                    <span style={{ color:C.muted, fontSize:13 }}>{h.currency}{h.buyPrice} × {h.shares}</span>
                    {r?.livePrice && <><span style={{ color:C.sub, fontSize:13 }}>→ ${r.livePrice.toFixed(2)}</span><span style={{ color:gainPct>=0?C.up:C.down, fontWeight:800, fontSize:14, fontFamily:FM }}>{gainPct>=0?'+':''}{gainPct?.toFixed(1)}%</span></>}
                    {ai && <span style={{ background:actionBg(ai.action), color:actionColor(ai.action), borderRadius:8, padding:'4px 12px', fontWeight:800, fontSize:13 }}>{ai.action}</span>}
                    <button onClick={()=>removeHolding(h.ticker)} style={{ marginLeft:'auto', appearance:'none', background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:18, padding:'0 4px' }}>×</button>
                  </div>
                )
              })}
            </div>
          )}
          {holdings.length > 0 && <button onClick={analysePortfolio} disabled={portfolioLoading} style={{ appearance:'none', background:portfolioLoading?C.border:C.accent, color:portfolioLoading?C.muted:'#fff', border:'none', borderRadius:10, padding:'12px 24px', fontWeight:800, fontSize:15, cursor:portfolioLoading?'not-allowed':'pointer', width:mob?'100%':'auto' }}>{portfolioLoading?'⟳ Analysing…':'⚡ Analyse my portfolio'}</button>}
          {portfolioError && <div style={{ color:C.down, fontSize:13, marginTop:12 }}>Error: {portfolioError}</div>}
        </div>
        {result && (
          <>
            {result.portfolioSummary && <div style={{ ...card({ marginBottom:14, borderLeft:`4px solid ${C.gold}` }) }}><div style={{ color:C.gold, fontWeight:800, fontSize:13, marginBottom:10 }}>📊 PORTFOLIO SUMMARY</div><div style={{ color:C.sub, fontSize:15, lineHeight:1.6, marginBottom:10 }}>{result.portfolioSummary}</div>{result.cashSuggestion && <Pill tone="amber" size="md">💰 {result.cashSuggestion}</Pill>}</div>}
            <div style={{ display:'grid', gridTemplateColumns:mob?'1fr':'repeat(auto-fill,minmax(340px,1fr))', gap:14 }}>
              {(result.holdings||[]).map((h,i)=>{
                const enriched = result.enriched?.find(e=>e.ticker===h.ticker)
                const gainPct = parseFloat(h.gainLossPct)||enriched?.gainPct
                return (
                  <div key={i} style={{ ...card({ borderLeft:`5px solid ${actionColor(h.action)}` }) }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12, flexWrap:'wrap', gap:8 }}>
                      <div><span style={{ fontFamily:FM, fontWeight:900, fontSize:24, color:C.text }}>{h.ticker}</span>{h.urgency==='NOW'&&<span style={{ marginLeft:8, fontSize:11, fontWeight:700, color:C.down }}>🔴 ACT NOW</span>}{h.urgency==='THIS WEEK'&&<span style={{ marginLeft:8, fontSize:11, fontWeight:700, color:C.amber }}>🟡 THIS WEEK</span>}</div>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        {gainPct!=null&&<span style={{ color:gainPct>=0?C.up:C.down, fontFamily:FM, fontWeight:800, fontSize:16 }}>{gainPct>=0?'+':''}{typeof gainPct==='number'?gainPct.toFixed(1):gainPct}%</span>}
                        <span style={{ background:actionBg(h.action), color:actionColor(h.action), borderRadius:10, padding:'6px 14px', fontWeight:800, fontSize:14 }}>{h.action}</span>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                      {[['You Paid',h.buyPrice],['Price Now',h.currentPrice||enriched?.livePriceFormatted]].map(([l,v])=>v?<div key={l} style={{ background:C.bg, borderRadius:8, padding:'8px 12px' }}><div style={LBL}>{l}</div><div style={{ ...VAL, fontSize:14 }}>{v}</div></div>:null)}
                      {h.action==='BUY MORE'&&h.entryIfBuyMore&&<div style={{ background:C.upBg, borderRadius:8, padding:'8px 12px' }}><div style={LBL}>BUY MORE AT</div><div style={{ color:C.up, fontWeight:800, fontSize:15 }}>{h.entryIfBuyMore}</div></div>}
                      {(h.action==='TRIM'||h.action==='SELL ALL')&&h.exitIfSell&&<div style={{ background:C.amberBg, borderRadius:8, padding:'8px 12px' }}><div style={LBL}>{h.action==='TRIM'?'SELL SOME AT':'SELL ALL AT'}</div><div style={{ color:C.amber, fontWeight:800, fontSize:15 }}>{h.exitIfSell}</div></div>}
                    </div>
                    <div style={{ color:C.sub, fontSize:14, lineHeight:1.65, marginBottom:enriched?.earningsDate?10:0 }}>{h.recommendation}</div>
                    {enriched?.earningsDate&&enriched.earningsTradingDaysAway>=0&&<Pill tone={enriched.earningsTradingDaysAway<=10?'amber':'blue'} size="sm">📅 Earnings in {enriched.earningsTradingDaysAway}d · {ukDate(enriched.earningsDate)}</Pill>}
                    {h.confidence&&<div style={{ marginTop:10 }}><Pill tone={h.confidence==='HIGH'?'green':h.confidence==='MEDIUM'?'amber':'grey'} size="sm">{h.confidence} confidence</Pill></div>}
                  </div>
                )
              })}
            </div>
          </>
        )}
        {!holdings.length && <div style={{ ...card({ textAlign:'center', padding:48 }) }}><div style={{ fontSize:40, marginBottom:12 }}>💼</div><div style={{ color:C.text, fontWeight:700, fontSize:18, marginBottom:8 }}>No holdings yet</div><div style={{ color:C.muted, fontSize:14, maxWidth:340, margin:'0 auto' }}>Add your first stock above — enter the ticker, price paid and shares, then click Analyse.</div></div>}
      </div>
    )
  }

  // ── renderT212 ─────────────────────────────────────────────────────────────
  function renderT212() {
    const actionColor = a => a==='BUY MORE'?C.up:a==='HOLD'?C.accent:a==='TRIM'?C.amber:C.down
    const actionBg    = a => a==='BUY MORE'?C.upBg:a==='HOLD'?C.accentBg:a==='TRIM'?C.amberBg:C.downBg
    const healthColor = h => h==='STRONG'?C.up:h==='GOOD'?C.accent:h==='CAUTION'?C.amber:C.down

    if (!t212Unlocked) {
      return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:400, padding:24 }}>
          <div style={{ ...card({ maxWidth:400, width:'100%', textAlign:'center', padding:36 }) }}>
            <div style={{ fontSize:40, marginBottom:16 }}>🏦</div>
            <div style={{ color:C.text, fontWeight:800, fontSize:20, marginBottom:8 }}>T212 Live Portfolio</div>
            <div style={{ color:C.muted, fontSize:14, marginBottom:24, lineHeight:1.6 }}>Enter your password to view live positions.</div>
            <input type="password" value={t212PwInput} onChange={e=>{setT212PwInput(e.target.value);setT212PwError(false)}} onKeyDown={e=>{if(e.key==='Enter'){if(t212PwInput===PORTFOLIO_PASSWORD){setT212Unlocked(true);setT212PwError(false);try{sessionStorage.setItem('catalyst_t212_auth','true')}catch{}}else{setT212PwError(true);setT212PwInput('')}}}} placeholder="Enter password" autoFocus style={{ width:'100%', padding:'12px 16px', borderRadius:10, border:`2px solid ${t212PwError?C.down:C.border}`, fontSize:16, fontFamily:FM, outline:'none', background:C.bg, marginBottom:12, boxSizing:'border-box', textAlign:'center', letterSpacing:4 }} />
            {t212PwError && <div style={{ color:C.down, fontSize:13, marginBottom:12, fontWeight:600 }}>Incorrect password.</div>}
            <button onClick={()=>{if(t212PwInput===PORTFOLIO_PASSWORD){setT212Unlocked(true);try{sessionStorage.setItem('catalyst_t212_auth','true')}catch{}}else{setT212PwError(true);setT212PwInput('')}}} style={{ appearance:'none', background:C.accent, color:'#fff', border:'none', borderRadius:10, padding:'12px 24px', fontWeight:800, fontSize:15, cursor:'pointer', width:'100%' }}>Unlock</button>
          </div>
        </div>
      )
    }

    return (
      <div>
        <div style={{ ...card({ marginBottom:14, padding:'14px 18px' }), display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ color:C.text, fontWeight:800, fontSize:18 }}>🏦 Trading 212 Live Portfolio</div>
            <div style={{ color:C.muted, fontSize:12, marginTop:2 }}>{t212Data ? `${t212Data.env||'LIVE'} · Updated ${new Date(t212Data.fetchedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}` : 'Not loaded'}</div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={fetchT212} disabled={t212Loading} style={{ appearance:'none', background:C.accent, color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontWeight:700, fontSize:13, cursor:'pointer' }}>{t212Loading?'⟳ Loading…':'⟳ Refresh'}</button>
            {t212Data && !t212AnalysisLoad && <button onClick={analyseT212} style={{ appearance:'none', background:C.up, color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontWeight:700, fontSize:13, cursor:'pointer' }}>⚡ Analyse</button>}
            {t212AnalysisLoad && <span style={{ color:C.muted, fontSize:13, padding:'9px 0' }}>⟳ Analysing…</span>}
            <button onClick={()=>{setT212Unlocked(false);setT212PwInput('');try{sessionStorage.removeItem('catalyst_t212_auth')}catch{}}} style={{ appearance:'none', background:'none', border:`1px solid ${C.border}`, borderRadius:8, padding:'9px 12px', color:C.muted, fontSize:12, cursor:'pointer', fontWeight:600 }}>🔒 Lock</button>
          </div>
        </div>

        {t212Error?.includes('credentials not configured') && (
          <div style={{ ...card({ borderLeft:`4px solid ${C.amber}`, marginBottom:14 }) }}>
            <div style={{ color:C.amber, fontWeight:800, fontSize:15, marginBottom:8 }}>⚙️ Setup required</div>
            <div style={{ color:C.sub, fontSize:14, lineHeight:1.85 }}>
              Trading 212 requires two credentials — a Key and a Secret.<br/><br/>
              <strong>Step 1:</strong> T212 app → Settings → API (Beta) → Generate API key<br/>
              <strong>Step 2:</strong> Copy BOTH the Key and Secret (secret shown only once)<br/>
              <strong>Step 3:</strong> Vercel → Environment Variables:<br/>
              <code style={{ background:C.bg, padding:'2px 6px', borderRadius:4, display:'block', margin:'4px 0' }}>TRADING212_API_KEY = your key</code>
              <code style={{ background:C.bg, padding:'2px 6px', borderRadius:4, display:'block', margin:'4px 0' }}>TRADING212_API_SECRET = your secret</code>
              <strong>Step 4:</strong> Redeploy
            </div>
          </div>
        )}

        {t212Error && !t212Error.includes('credentials') && <div style={{ ...card({ borderLeft:`4px solid ${C.down}`, marginBottom:14 }), padding:'14px 18px' }}><div style={{ color:C.down, fontWeight:700 }}>Error: {t212Error}</div></div>}

        {!t212Data && !t212Loading && !t212Error && (
          <div style={{ ...card({ textAlign:'center', padding:48 }) }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🏦</div>
            <div style={{ color:C.text, fontWeight:700, fontSize:18, marginBottom:8 }}>Ready to connect</div>
            <button onClick={fetchT212} style={{ appearance:'none', background:C.accent, color:'#fff', border:'none', borderRadius:10, padding:'12px 24px', fontWeight:800, fontSize:15, cursor:'pointer' }}>Load my T212 portfolio</button>
          </div>
        )}

        {t212Loading && <div style={{ ...card({ textAlign:'center', padding:40 }) }}><div style={{ color:C.muted, fontSize:14 }}>⟳ Fetching positions from Trading 212…</div></div>}

        {t212Data?.cash && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:14 }}>
            {[['Free Cash',`£${t212Data.cash.free}`,C.up],['Invested',`£${t212Data.cash.invested}`,C.accent],['Total Value',`£${t212Data.cash.total}`,C.text],['Total P&L',`£${t212Data.cash.ppl}`,parseFloat(t212Data.cash.ppl)>=0?C.up:C.down]].map(([lbl,val,color])=>(
              <div key={lbl} style={{ ...card({ padding:14 }) }}><div style={LBL}>{lbl}</div><div style={{ color, fontFamily:FM, fontWeight:800, fontSize:20 }}>{val}</div></div>
            ))}
          </div>
        )}

        {t212Result && (
          <div style={{ ...card({ marginBottom:14, borderLeft:`4px solid ${healthColor(t212Result.portfolioHealth)}` }) }}>
            <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>
              <Pill tone={t212Result.portfolioHealth==='STRONG'?'green':t212Result.portfolioHealth==='GOOD'?'blue':t212Result.portfolioHealth==='CAUTION'?'amber':'red'} size="lg">{t212Result.portfolioHealth||'ANALYSED'}</Pill>
              {t212Result.topAction && <span style={{ color:C.sub, fontSize:14, fontWeight:600 }}>→ {t212Result.topAction}</span>}
            </div>
            {t212Result.overallSummary && <div style={{ color:C.sub, fontSize:14, lineHeight:1.6, marginBottom:8 }}>{t212Result.overallSummary}</div>}
            {t212Result.cashAdvice && <div style={{ color:C.muted, fontSize:13 }}>{t212Result.cashAdvice}</div>}
          </div>
        )}

        {t212Data?.positions?.length > 0 && (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center' }}>
              <span style={{ color:C.muted, fontSize:13, fontWeight:600 }}>View:</span>
              {['pies','stocks'].map(mode => (
                <button key={mode} onClick={() => setT212ViewMode(mode)} style={{ appearance:'none', border:`1.5px solid ${t212ViewMode===mode?C.accent:C.border}`, background:t212ViewMode===mode?C.accent:C.card, color:t212ViewMode===mode?'#fff':C.sub, borderRadius:8, padding:'7px 14px', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  {mode==='pies'?'🥧 By Pie':'📋 All Stocks'}
                </button>
              ))}
            </div>

            {t212ViewMode === 'stocks' && (
              <div style={{ display:'grid', gridTemplateColumns:mob?'1fr':'repeat(auto-fill,minmax(300px,1fr))', gap:12, marginBottom:18 }}>
                {t212Data.positions.map((p,i) => {
                  const ai = t212Result?.holdings?.find(h=>h.ticker===p.ticker)
                  return (
                    <div key={i} style={{ ...card({ borderLeft:`5px solid ${ai?actionColor(ai.action):(p.gainPct>=0?C.up:C.down)}` }) }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                        <div><span style={{ fontFamily:FM, fontWeight:900, fontSize:22, color:C.text }}>{p.ticker}</span><span style={{ color:C.muted, fontSize:12, marginLeft:8 }}>{p.quantity} shares</span>{p.pieName&&<span style={{ color:C.accent, fontSize:11, marginLeft:8 }}>🥧 {p.pieName}</span>}</div>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}><span style={{ color:p.gainPct>=0?C.up:C.down, fontFamily:FM, fontWeight:800, fontSize:15 }}>{p.gainPct>=0?'+':''}{p.gainPct}%</span>{ai&&<span style={{ background:actionBg(ai.action), color:actionColor(ai.action), borderRadius:8, padding:'4px 10px', fontWeight:800, fontSize:12 }}>{ai.action}</span>}</div>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                        {[['Bought',`£${p.averagePrice?.toFixed(2)}`],['Now',`£${p.currentPrice?.toFixed(2)}`],['P&L',`${p.ppl>=0?'+':''}£${p.ppl}`]].map(([l,v])=>(
                          <div key={l} style={{ background:C.bg, borderRadius:8, padding:'8px 10px' }}><div style={{ ...LBL, fontSize:10 }}>{l}</div><div style={{ fontFamily:FM, fontWeight:700, fontSize:14 }}>{v}</div></div>
                        ))}
                      </div>
                      {ai?.recommendation && <div style={{ color:C.sub, fontSize:13, lineHeight:1.6 }}>{ai.recommendation}</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {t212ViewMode === 'pies' && (() => {
              const pieGroups = {}, directHoldings = []
              t212Data.positions.forEach(p => { if(p.pieName){if(!pieGroups[p.pieName])pieGroups[p.pieName]=[];pieGroups[p.pieName].push(p)}else directHoldings.push(p) })
              const pieData = {}
              ;(t212Data.pies||[]).forEach(pie=>{pieData[pie.name]=pie})

              const StockCard = ({p}) => {
                const ai = t212Result?.holdings?.find(h=>h.ticker===p.ticker)
                return (
                  <div style={{ background:C.bg, borderRadius:12, padding:14, borderLeft:`4px solid ${ai?actionColor(ai.action):(p.gainPct>=0?C.up:C.down)}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8, flexWrap:'wrap', gap:6 }}>
                      <div><span style={{ fontFamily:FM, fontWeight:900, fontSize:16, color:C.text }}>{p.ticker}</span><span style={{ color:C.muted, fontSize:11, marginLeft:6 }}>{p.quantity?.toFixed?.(4)||p.quantity}</span></div>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}><span style={{ color:p.gainPct>=0?C.up:C.down, fontFamily:FM, fontWeight:800, fontSize:13 }}>{p.gainPct>=0?'+':''}{p.gainPct}%</span>{ai&&<span style={{ background:actionBg(ai.action), color:actionColor(ai.action), borderRadius:6, padding:'3px 8px', fontWeight:800, fontSize:11 }}>{ai.action}</span>}</div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:ai?.recommendation?8:0 }}>
                      {[['Bought',`£${p.averagePrice?.toFixed(2)}`],['Now',`£${p.currentPrice?.toFixed(2)}`],['Value',`£${p.totalValue?.toFixed(2)}`]].map(([l,v])=>(
                        <div key={l} style={{ background:C.card, borderRadius:6, padding:'6px 8px' }}><div style={{ ...LBL, fontSize:9 }}>{l}</div><div style={{ fontFamily:FM, fontWeight:700, fontSize:12 }}>{v}</div></div>
                      ))}
                    </div>
                    {ai?.recommendation && <div style={{ color:C.sub, fontSize:12, lineHeight:1.5 }}>{ai.recommendation}</div>}
                  </div>
                )
              }

              return (
                <div style={{ display:'grid', gap:16, marginBottom:18 }}>
                  {Object.entries(pieGroups).map(([pieName, stocks]) => {
                    const pd = pieData[pieName]
                    const isOpen = expandedPies[pieName] !== false
                    const totalPPL = pd?.ppl ?? stocks.reduce((s,p)=>s+p.ppl,0)
                    const totalVal = pd?.totalValue ?? stocks.reduce((s,p)=>s+p.totalValue,0)
                    const gainPct  = pd?.gainPct ?? (stocks.reduce((s,p)=>s+p.gainPct,0)/stocks.length)
                    const pplColor = totalPPL>=0?C.up:C.down
                    const stockActions = stocks.map(p=>t212Result?.holdings?.find(h=>h.ticker===p.ticker)?.action).filter(Boolean)
                    const pieVerdict = stockActions.some(a=>a==='SELL ALL')?'SELL ALL':stockActions.some(a=>a==='TRIM')?'TRIM':stockActions.some(a=>a==='BUY MORE')?'BUY MORE':'HOLD'
                    return (
                      <div key={pieName} style={{ ...card({ padding:0, overflow:'hidden' }) }}>
                        <button onClick={()=>setExpandedPies(prev=>({...prev,[pieName]:!isOpen}))} style={{ appearance:'none', width:'100%', background:'none', border:'none', cursor:'pointer', padding:'16px 18px', textAlign:'left' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <span style={{ fontSize:20 }}>🥧</span>
                              <div><div style={{ color:C.text, fontWeight:800, fontSize:17 }}>{pieName}</div><div style={{ color:C.muted, fontSize:12, marginTop:2 }}>{stocks.length} stocks</div></div>
                            </div>
                            <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                              <div style={{ textAlign:'right' }}>
                                <div style={{ color:C.text, fontFamily:FM, fontWeight:800, fontSize:18 }}>£{totalVal?.toFixed(2)}</div>
                                <div style={{ color:pplColor, fontFamily:FM, fontWeight:700, fontSize:13 }}>{totalPPL>=0?'+':''}£{totalPPL?.toFixed(2)} ({gainPct>=0?'+':''}{gainPct?.toFixed(1)}%)</div>
                              </div>
                              {t212Result && <span style={{ background:actionBg(pieVerdict), color:actionColor(pieVerdict), borderRadius:8, padding:'6px 12px', fontWeight:800, fontSize:13 }}>{pieVerdict}</span>}
                              <span style={{ color:C.muted, fontSize:18 }}>{isOpen?'▲':'▼'}</span>
                            </div>
                          </div>
                        </button>
                        {isOpen && (
                          <div style={{ padding:'0 14px 14px' }}>
                            {t212Result && <div style={{ background:C.bg, borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:13, color:C.sub }}><strong>Summary:</strong> {stockActions.filter(a=>a==='BUY MORE').length} BUY MORE · {stockActions.filter(a=>a==='HOLD').length} HOLD · {stockActions.filter(a=>a==='TRIM').length} TRIM · {stockActions.filter(a=>a==='SELL ALL').length} SELL</div>}
                            <div style={{ display:'grid', gridTemplateColumns:mob?'1fr':'repeat(auto-fill,minmax(240px,1fr))', gap:10 }}>
                              {stocks.map((p,i)=><StockCard key={i} p={p}/>)}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {directHoldings.length>0 && (
                    <div style={{ ...card({ padding:0, overflow:'hidden' }) }}>
                      <button onClick={()=>setExpandedPies(prev=>({...prev,'__direct__':!(prev['__direct__']!==false)}))} style={{ appearance:'none', width:'100%', background:'none', border:'none', cursor:'pointer', padding:'16px 18px', textAlign:'left' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}><span style={{ fontSize:20 }}>📋</span><div><div style={{ color:C.text, fontWeight:800, fontSize:17 }}>Direct Holdings</div><div style={{ color:C.muted, fontSize:12 }}>{directHoldings.length} stocks</div></div></div>
                          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                            <div style={{ textAlign:'right' }}><div style={{ color:C.text, fontFamily:FM, fontWeight:800, fontSize:18 }}>£{directHoldings.reduce((s,p)=>s+p.totalValue,0).toFixed(2)}</div></div>
                            <span style={{ color:C.muted, fontSize:18 }}>{expandedPies['__direct__']===false?'▼':'▲'}</span>
                          </div>
                        </div>
                      </button>
                      {expandedPies['__direct__']!==false && <div style={{ padding:'0 14px 14px', display:'grid', gridTemplateColumns:mob?'1fr':'repeat(auto-fill,minmax(240px,1fr))', gap:10 }}>{directHoldings.map((p,i)=><div key={i} style={{ ...card(), borderLeft:`4px solid ${p.gainPct>=0?C.up:C.down}` }}><div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ fontFamily:FM, fontWeight:900, fontSize:18 }}>{p.ticker}</span><span style={{ color:p.gainPct>=0?C.up:C.down, fontWeight:800 }}>{p.gainPct>=0?'+':''}{p.gainPct}%</span></div><div style={{ color:C.muted, fontSize:12, marginTop:4 }}>£{p.averagePrice?.toFixed(2)} → £{p.currentPrice?.toFixed(2)} · P&L {p.ppl>=0?'+':''}£{p.ppl}</div></div>)}</div>}
                    </div>
                  )}
                </div>
              )
            })()}
          </>
        )}

        {t212Data?.pendingOrders?.length > 0 && (
          <div style={{ ...card({ marginBottom:14 }) }}>
            <div style={{ ...LBL, marginBottom:12 }}>⏳ PENDING ORDERS</div>
            <div style={{ display:'grid', gap:8 }}>
              {t212Data.pendingOrders.map((o,i) => {
                const advice = t212Result?.pendingOrdersAdvice?.find(a=>a.ticker===o.ticker)
                const verdictColor = advice?.verdict==='KEEP'?C.up:advice?.verdict==='CANCEL'?C.down:C.amber
                return (
                  <div key={i} style={{ display:'flex', gap:10, alignItems:'center', background:C.bg, borderRadius:8, padding:'10px 14px', flexWrap:'wrap' }}>
                    <span style={{ background:o.side==='BUY'?C.upBg:C.amberBg, color:o.side==='BUY'?C.up:C.amber, borderRadius:6, padding:'3px 8px', fontWeight:800, fontSize:12 }}>{o.side}</span>
                    <span style={{ fontFamily:FM, fontWeight:800, fontSize:15 }}>{o.ticker}</span>
                    <span style={{ color:C.sub, fontSize:13 }}>{o.quantity} shares @ £{o.limitPrice}</span>
                    {advice && <><span style={{ color:verdictColor, fontWeight:800, fontSize:13 }}>{advice.verdict}</span><span style={{ color:C.muted, fontSize:12 }}>{advice.reason}</span></>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── renderContent ──────────────────────────────────────────────────────────
  function renderContent() {
    if (activeTab === 'portfolio') return renderPortfolio()
    if (activeTab === 't212')      return renderT212()

    const isLoad = loading[activeTab]
    const err    = errors[activeTab]
    const d      = data[activeTab]

    if (isLoad) return (
      <div style={{ ...card({ minHeight:320 }), display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14 }}>
        <div style={{ width:44, height:44, border:`3px solid ${C.border}`, borderTop:`3px solid ${C.accent}`, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <div style={{ color:C.text, fontWeight:700, fontSize:16 }}>{loadingStep || (activeTab==='opportunities'?'Running full analysis…':'Loading…')}</div>
        {activeTab==='opportunities' && (
          <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'center', marginTop:4 }}>
            {[['Fetching live prices…','~3s',loadingStep!=='Fetching live prices…'],['Building AI analysis…','~15s',false]].map(([step,time,done])=>(
              <div key={step} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:14, width:16, textAlign:'center' }}>{done?'✓':loadingStep===step?'⟳':'○'}</span>
                <span style={{ color:done?C.up:loadingStep===step?C.accent:C.muted, fontSize:13 }}>{step}</span>
                <span style={{ color:C.muted, fontSize:11 }}>{time}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ color:C.muted, fontSize:12, marginTop:4 }}>{activeTab==='opportunities'?'SMA trend badges load in background after cards appear':'Fetching live market data'}</div>
      </div>
    )

    if (err) return (
      <div style={{ ...card({ borderLeft:`4px solid ${C.down}` }), padding:24 }}>
        <div style={{ color:C.down, fontWeight:700, fontSize:16, marginBottom:8 }}>Error</div>
        <div style={{ color:C.sub, fontSize:14, marginBottom:16, whiteSpace:'pre-wrap' }}>{err}</div>
        <button onClick={refresh} style={{ appearance:'none', background:C.down, color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontWeight:700, fontSize:14, cursor:'pointer' }}>Retry</button>
      </div>
    )

    if (!d) return <div style={{ ...card({ minHeight:200 }), display:'grid', placeItems:'center' }}><div style={{ color:C.muted }}>Loading…</div></div>

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
        @media print {
          body { background:#fff !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          .no-print { display:none !important; }
        }
      `}</style>

      <div style={{ maxWidth:1560, margin:'0 auto', padding: mob ? '10px 12px' : '14px 24px' }}>
        <div style={{ ...card({ marginBottom:14, padding: mob ? '12px 14px' : '14px 22px' }), display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontWeight:900, fontSize: mob?20:26, color:C.accent, letterSpacing:-0.5 }}>CATALYST</div>
            <div style={{ color:C.muted, fontSize:11, fontWeight:600, letterSpacing:0.5, marginTop:2 }}>TRADING INTELLIGENCE · {new Date().toDateString().toUpperCase()}</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }} className="no-print">
            {lastUp[activeTab] && <span style={{ color:C.muted, fontSize:11 }}>Updated {ts(lastUp[activeTab])}</span>}
            <button onClick={() => window.print()} style={{ appearance:'none', background:'#fff', color:C.accent, border:`1.5px solid ${C.accent}`, borderRadius:10, padding: mob ? '8px 12px' : '10px 16px', fontWeight:700, fontSize: mob?12:13, cursor:'pointer' }}>{mob ? '⬇ PDF' : '⬇ Export PDF'}</button>
            <button onClick={refresh} style={{ appearance:'none', background:C.accent, color:'#fff', border:'none', borderRadius:10, padding: mob ? '8px 14px' : '10px 18px', fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'0 2px 8px rgba(37,99,235,0.25)' }}>↻ Refresh</button>
          </div>
        </div>

        <div className="no-print" style={{ display:'flex', gap:6, marginBottom:16, overflowX:'auto', WebkitOverflowScrolling:'touch', paddingBottom:4 }}>
          {TABS.map(t => {
            const active = activeTab===t.key
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ appearance:'none', border: `1.5px solid ${active ? C.accent : C.border}`, background: active ? C.accent : C.card, color: active ? '#fff' : C.sub, borderRadius:10, padding: mob ? '9px 14px' : '11px 18px', cursor:'pointer', fontWeight:700, fontSize: mob?13:14, whiteSpace:'nowrap', flexShrink:0, boxShadow: active ? '0 2px 8px rgba(37,99,235,0.2)' : 'none', transition:'all 0.15s' }}>
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
