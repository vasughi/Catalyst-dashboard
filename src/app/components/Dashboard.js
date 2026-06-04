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
// ── Company names lookup — used in Stock Analyser prompt ────────────────────────────
const KNOWN_NAMES = {
  NVDA:'NVIDIA',AVGO:'Broadcom',AMD:'AMD',TSM:'TSMC',MRVL:'Marvell',ARM:'Arm',
  QCOM:'Qualcomm',INTC:'Intel',MU:'Micron',AMAT:'Applied Materials',
  MSFT:'Microsoft',GOOGL:'Alphabet',META:'Meta',AMZN:'Amazon',AAPL:'Apple',
  TSLA:'Tesla',NFLX:'Netflix',PLTR:'Palantir',ORCL:'Oracle',NOW:'ServiceNow',
  CRM:'Salesforce',SNOW:'Snowflake',DDOG:'Datadog',NET:'Cloudflare',
  ADBE:'Adobe',CRWD:'CrowdStrike',PANW:'Palo Alto',ZS:'Zscaler',FTNT:'Fortinet',
  OKTA:'Okta',LMT:'Lockheed',RTX:'RTX Corp',NOC:'Northrop Grumman',
  AXON:'Axon',GD:'Gen Dynamics',VRT:'Vertiv',ETN:'Eaton',GEV:'GE Vernova',
  CEG:'Constellation Energy',VST:'Vistra',FSLR:'First Solar',ENPH:'Enphase',
  FCX:'Freeport-McMoRan',CCJ:'Cameco',RKLB:'RocketLab',ASTS:'AST SpaceMobile',
  IONQ:'IonQ',RGTI:'Rigetti',QUBT:'QuEra',IBM:'IBM',CRDO:'Credo Technology',
  ANET:'Arista Networks',SMCI:'SuperMicro',DELL:'Dell',CRWV:'CoreWeave',
  AVAV:'AeroVironment',KTOS:'Kratos Defense',ONDS:'Ondas',AMPX:'Amprius',
  MXL:'MaxLinear',DOCU:'DocuSign',CFLT:'Confluent',COIN:'Coinbase',
}

// ── EARNINGS HISTORY REFERENCE ───────────────────────────────────────────────
// UNIVERSE is now only used as a reference for the EH earnings history display.
// The actual stock discovery is handled by market-route.js QUALITY_UNIVERSE.
// Add new tickers to QUALITY_UNIVERSE in market-route.js for discovery.
// Add their EH history below to improve AI analysis quality.
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
  MRVL:  { avg: 16.2, beats: 4, label: '16.2% avg · 4/4 beats — next: est 20 Aug 2026' },
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
  MU:    { avg: 13.4, beats: 4, label: '13.4% avg · 4/4 beats — HBM/AI memory surge' },
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
  // Cybersecurity additions
  NET:   { avg: 12.8, beats: 4, label: '12.8% avg · 4/4 beats' },
  OKTA:  { avg: 10.2, beats: 3, label: '10.2% avg · 3/4 beats' },
  FTNT:  { avg: 7.1,  beats: 3, label: '7.1% avg · 3/4 beats' },
  CRWD:  { avg: 8.2,  beats: 4, label: '8.2% avg · 4/4 beats' },
  // Quantum computing
  IONQ:  { avg: 18.2, beats: 3, label: '18.2% avg · 3/4 beats — high volatility' },
  RGTI:  { avg: 22.4, beats: 3, label: '22.4% avg · 3/4 beats — high volatility' },
  QUBT:  { avg: 19.1, beats: 2, label: '19.1% avg · 2/4 beats' },
  QMCO:  { avg: 15.3, beats: 3, label: '15.3% avg · 3/4 beats' },
  IBM:   { avg: 6.2,  beats: 4, label: '6.2% avg · 4/4 beats — low volatility' },
  // Cloud / SaaS additions
  SNOW:  { avg: 18.4, beats: 4, label: '18.4% avg · 4/4 beats' },
  DDOG:  { avg: 14.2, beats: 4, label: '14.2% avg · 4/4 beats' },
  NET:   { avg: 12.8, beats: 4, label: '12.8% avg · 4/4 beats' },
  ORCL:  { avg: 11.2, beats: 4, label: '11.2% avg · 4/4 beats' },
  ADBE:  { avg: 7.8,  beats: 3, label: '7.8% avg · 3/4 beats' },
  CRM:   { avg: 8.6,  beats: 4, label: '8.6% avg · 4/4 beats' },
  AMZN:  { avg: 7.9,  beats: 4, label: '7.9% avg · 4/4 beats' },
  TSLA:  { avg: 9.1,  beats: 3, label: '9.1% avg · 3/4 beats' },
  NFLX:  { avg: 10.4, beats: 4, label: '10.4% avg · 4/4 beats' },
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
    // Works whether opportunities is first or last in the JSON
    try {
      const oppArrayMatch = fixed.includes('"opportunities"')
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
  { key:'portfolio',     label:'🔍 Stock Analyser' },
  { key:'global',        label:'🌍 Global Macro' },
  { key:'risk',          label:'⚠️ Risk' },
  { key:'t212',          label:'🏦 T212 Live' },
]

// ── Core watchlist — always visible on Opportunities tab ──────────────────────
// These are your mandatory stocks — you can always eyeball them
// regardless of what the AI picks for the main 10 cards
const CORE_WATCHLIST = {
  'AI & Semis':   ['NVDA','AVGO','MRVL','ARM','PLTR','META','AMD'],
  'Cybersecurity':['CRWD','PANW','ZS','NET','FTNT','S'],
  'Quantum':      ['IONQ','RGTI','QUBT','IBM','QMCO'],
  'Power/Energy': ['VRT','GEV','ETN','CEG','VST'],
  'Defence':      ['LMT','AXON','NOC','RTX'],
  'My Holdings':  ['NVDA','AVGO','CRDO','CRWV','ASTS'],
}

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
  const [showAllOpps,        setShowAllOpps]        = useState(false)
  const [expandedWatchlist,  setExpandedWatchlist]  = useState(false)
  // Portfolio password gate — stored in sessionStorage (cleared on browser close)
  const [loadingStep, setLoadingStep] = useState('')
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
  const [t212PriceCache,  setT212PriceCache]  = useState({})  // T212-sourced prices — always accurate
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
      // Destructure FIRST before using stocks
      const { stocks, earningsCalendar, vix, vixRegime, sectors } = md
      // Log discovery stats
      if (md.meta?.discoveredFromCalendar) {
        console.log('[CATALYST] Discovered', md.meta.discoveredFromCalendar, 'stocks from live calendar out of', md.meta.calendarScanned, 'scanned')
      }
      // Override Finnhub prices with T212 prices where available (T212 is always accurate)
      const enrichedStocks = (stocks||[]).map(s => {
        const t212p = t212PriceCache[s.ticker]
        if (t212p && t212p.price > 0) {
          return { ...s, price: t212p.price, priceFormatted: '$'+t212p.price.toFixed(2), priceSource: 'T212' }
        }
        return { ...s, priceSource: 'Finnhub' }
      })

      // Build stock lines for prompt
      // Only include stocks with valid live prices in the AI prompt
      const stockLines = enrichedStocks.filter(s => s.price && s.price > 0).map(s => {
        const hist = getEH(s.ticker)
        const parts = [
          s.ticker+'('+s.name+')'+(s.discoveredFromCalendar?' [CAL]':'')+(s.priceSource==='T212'?' [T212]':' [FH]')+': $'+s.price?.toFixed(2)+' '+s.change1d,
          s.hasVerifiedEarnings
            ? ('EARNINGS='+s.earningsDate+' in_'+s.earningsTradingDaysAway+'d'+(s.earningsSource==='estimate'?' [EST]':' [VERIFIED]')+(s.epsEstimate?' EPS=$'+s.epsEstimate:''))
            : 'NO_EARNINGS',
          s.bigMoverToday ? 'GAP_UP>8%_APPLY_PENALTY' : '',
          hist ? 'HIST:'+hist.label+(hist.live?' [LIVE]':'') : '',
          // Technicals — live SMA data from /api/technicals
          // Shows: trend, entry quality, % above/below 200 SMA, calculated stop
          (()=>{const t=techMap[s.ticker]||{}; return[
            t.trend             ? 'TREND:'+t.trend               : '',
            t.entryQuality      ? 'ENTRY:'+t.entryQuality        : '',
            t.sma200            ? 'SMA200:$'+t.sma200+(t.pctAbove200!=null?'('+(t.pctAbove200>=0?'+':'')+t.pctAbove200+'%)':'') : '',
            t.sma50             ? 'SMA50:$'+t.sma50+(t.pctAbove50!=null?'('+(t.pctAbove50>=0?'+':'')+t.pctAbove50+'%)':'')     : '',
            t.suggestedStopLoss ? 'CALC_STOP:$'+t.suggestedStopLoss+'('+t.distToStopPct+'%_below)' : '',
          ].filter(Boolean).join(' | ')})(),
        ]
        return parts.filter(Boolean).join(' | ')
      }).join('\\n')

      const sectorLines = (sectors||[]).map(s=>s.label+': '+s.change+' ('+s.direction+')').join(', ')

      // Build earnings history lines — use discovered stocks, not hardcoded list
      // This means any auto-discovered stock (e.g. PANW, ORCL) gets its history shown
      const ehLines = enrichedStocks.map(s => {
        const h = getEH(s.ticker)
        if (!h) return null
        return s.ticker+': '+h.label+(h.live?' [LIVE]':' [CACHED]')
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

DISCOVERED STOCKS (auto-detected from earnings calendar + quality filter):
Note: [CAL] = auto-discovered from live Finnhub earnings calendar (not on fixed list). These are event-driven opportunities surfaced by scanning all 500+ upcoming earnings.
${stockLines}

EARNINGS DATES (next 60 days):
${calLines||'None confirmed yet'}

EARNINGS HISTORY:
${ehLines || Object.entries(EH).map(([k,v])=>(k+': '+v.label)).join(' | ')}

LIVE NEWS + ANALYST DATA (auto-fetched):
${newsLines || 'Loading in background — refresh for live data'}

KNOWN EVENTS:
- ORCL: Reports Jun 10 2026 confirmed — 9 days, strong AI cloud growth, BUY candidate
- DOCU: Reports Jun 4 tonight — BUY if guidance strong, WATCH if billings disappoint
- AVGO: Reported 3 Jun, beat revenue 48% YoY ($22.19B) BUT Q3 guidance disappointed — stock fell 15% after-hours to ~$413. Wait for stabilisation before buying. max WATCH.\n'
      '
- MU: Reporting Jun 24 2026 — stock at $1079 all-time high on HBM/AI memory demand. 4/4 beats. Prime catalyst play.\n'
      '
- CRDO: Reported 1 Jun, beat but fell 14% on inline guidance — WATCH until stabilises
- QCOM: Already reported Q2, weak Q3 guidance, Apple modem risk — max WATCH
- GOOGL: $80B share issue = dilution = max WATCH
- FCX: Mine production cut = fundamental problem = max WATCH
- NOC: Q1 guidance miss, stock fell 16% since — max WATCH
- LMT: 4.2% avg earnings move — cannot reach 15% gate — max WATCH
RULES:
1. Stocks with earnings 33-45 days away are PRIME BUY candidates — especially [CAL] auto-discovered ones
2. Stock up >8% today = max WATCH
3. Only BUY if 15%+ gain path within 45 trading days
4. TREND:DOWNTREND = max WATCH — never BUY a downtrend
5. TREND:PULLBACK_IN_UPTREND = ideal entry — prioritise these for BUY
6. If SMA200 available: use CALC_STOP as stop loss, calculate R/R from real numbers
7. If TREND not provided: estimate from price action and news context
8. currentPrice MUST be exact dollar from PRICES above — if a stock shows no price, EXCLUDE it from recommendations entirely
9. Plain English only. Short sentences. No jargon.
10. watchList: 5-8 most interesting. avoidList: 5-8 to avoid.

EXACTLY 10 entries. COMPACT JSON, no spaces. Max 10 words per string. Start with opportunities array. Rank all stocks, best 10. Count them. If you have fewer than 10 BUYs, fill remaining slots with WATCH cards for: NVDA, MRVL, AVGO, GEV, FSLR, ETN, CEG, PLTR — whatever is needed to reach 10.

Return ONLY this JSON (EXACTLY 10 opportunity cards — rank all universe stocks, best 10 only):
{"opportunities":[{"ticker":"","company":"","action":"BUY","currentPrice":"","entryZone":"$X-$Y","stopLoss":"$X","takeProfit":"$X","expectedGain":"15%","riskReward":"3:1","allocation":"10%","whyWeLikeIt":"max 10 words","whatCouldGoWrong":"max 8 words","upcomingEvent":"","eventDate":"DD Mon YYYY","trend":"","entryQuality":"GOOD","returnGate":"PASS","cashChallenge":"PASS","opportunityScore":75}],"marketCondition":"BUY SELECTIVELY","cashRecommendation":"one sentence","cashPct":30,"regime":"one sentence","cio":{"bestTradeToday":"TICKER","bestRiskReward":"TICKER","finalMarketDecision":"BUY SELECTIVELY","watchList":[{"ticker":"","reason":"max 6 words"}],"avoidList":[{"ticker":"","reason":"max 6 words"}]}}`


      // Direct browser API call — no Vercel timeout
      // Pre-fetch SMA for discovered stocks BEFORE AI runs
      // Fetch top 10 by priority (stocks sorted by earnings proximity)
      // Split into 2 parallel calls of 5 to stay within technicals route cap
      const topTickers = (stocks||[]).slice(0, 10).map(s => s.ticker)
      if (topTickers.length) {
        try {
          const batch1 = topTickers.slice(0, 5)
          const batch2 = topTickers.slice(5, 10)
          const fetches = [
            fetch('/api/technicals?symbols=' + batch1.join(','), { cache: 'no-store' }),
            batch2.length ? fetch('/api/technicals?symbols=' + batch2.join(','), { cache: 'no-store' }) : null,
          ].filter(Boolean)
          const results = await Promise.allSettled(fetches)
          for (const r of results) {
            if (r.status === 'fulfilled' && r.value.ok) {
              const techData = await r.value.json()
              if (techData?.technicals) {
                setTechMap(prev => ({ ...prev, ...techData.technicals }))
              }
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
      const allTickers = enrichedStocks.map(s=>s.ticker)
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
    const ticker = newTicker.trim().toUpperCase()
    if (!ticker) return
    setPortfolioLoading(true)
    setPortfolioError(null)
    setPortfolioResult(null)
    try {
      // Fetch live price, SMA technicals, news+analyst, market context — all parallel
      const [priceRes, techRes, newsRes, marketRes] = await Promise.allSettled([
        fetch('/api/prices?symbols=' + ticker, { cache:'no-store' }),
        fetch('/api/technicals?symbols=' + ticker, { cache:'no-store' }),
        fetch('/api/news?symbols=' + ticker, { cache:'no-store' }),
        fetch('/api/market?type=global', { cache:'no-store' }),
      ])

      const priceData  = priceRes.status==='fulfilled'  && priceRes.value.ok  ? await priceRes.value.json()  : {}
      const techData   = techRes.status==='fulfilled'   && techRes.value.ok   ? await techRes.value.json()   : {}
      const newsData   = newsRes.status==='fulfilled'   && newsRes.value.ok   ? await newsRes.value.json()   : {}
      const marketData = marketRes.status==='fulfilled' && marketRes.value.ok ? await marketRes.value.json() : {}

      const q  = priceData.prices?.[ticker]
      const tc = techData.technicals?.[ticker] || {}
      const nd = newsData.results?.[ticker] || {}
      // Use T212 price cache as fallback if Finnhub fails drift check
      const t212cached = t212PriceCache[ticker]
      const livePrice  = q?.price || t212cached?.price || null
      const hist       = getEH(ticker)

      if (!livePrice) throw new Error(`No live price for ${ticker} — Finnhub returned invalid data. Try loading your T212 tab first (provides accurate prices for your holdings), or check the ticker is a valid US stock symbol.`)

      // Build prompt — same quality as Opportunities tab
      const entryPrice = newBuyPrice ? parseFloat(newBuyPrice) : livePrice
      const gainIfEntry = livePrice ? ((livePrice - entryPrice) / entryPrice * 100).toFixed(1) : null

      const prompt = `TODAY: ${new Date().toDateString()}

STOCK TO ANALYSE: ${ticker}
${KNOWN_NAMES[ticker] ? 'Company: '+KNOWN_NAMES[ticker] : ''}
Live price: $${livePrice?.toFixed(2)}
Today's change: ${q?.change1d || 'N/A'}
${newBuyPrice ? 'User price (bought or target entry): '+newCurrency+newBuyPrice+(gainIfEntry ? ' ('+(parseFloat(gainIfEntry)>=0?'+':'')+gainIfEntry+'% vs current)' : '') : ''}

TECHNICAL ANALYSIS (computed from real 220-day price history):
Trend: ${tc.trend || 'unknown — SMA still loading, estimate from price action'}
Setup type: ${tc.setup || 'unknown'}
Entry quality: ${tc.entryQuality || 'unknown'}
SMA200: ${tc.sma200 ? '$'+tc.sma200+' (price is '+(tc.pctAbove200>=0?'+':'')+tc.pctAbove200+'% above/below)' : 'not yet loaded'}
SMA50:  ${tc.sma50  ? '$'+tc.sma50+' (price is '+(tc.pctAbove50>=0?'+':'')+tc.pctAbove50+'% above/below)'  : 'not yet loaded'}
Nearest support: ${tc.nearestSupport || 'not available'}
Calculated stop loss: ${tc.suggestedStopLoss ? '$'+tc.suggestedStopLoss+' ('+tc.distToStopPct+'% below current)' : 'not available'}

EARNINGS DATA:
Historical avg move: ${hist ? hist.label : 'not in database — research manually'}
Last reported earnings: ${nd.lastEarnings ? '('+(nd.lastEarnings.beat?'BEAT':'MISS')+' by '+nd.lastEarnings.surprise+', period '+nd.lastEarnings.period+')' : 'not available'}
Next earnings: unknown — check Finnhub calendar manually if critical

ANALYST COVERAGE:
${nd.analyst ? 'Current consensus: '+nd.analyst.consensus+' ('+nd.analyst.strongBuy+' strong buy, '+nd.analyst.buy+' buy, '+nd.analyst.hold+' hold, '+nd.analyst.sell+' sell — '+nd.analyst.total+' analysts total, data from '+nd.analyst.period+')' : 'No analyst data available from Finnhub'}

RECENT NEWS (last 5 days from Finnhub):
${nd.news?.length ? nd.news.map(n => n.date+': '+n.headline).join('\n') : 'No recent news found'}

MARKET CONTEXT RIGHT NOW:
VIX: ${marketData.vix || 'N/A'} — ${marketData.vixRegime==='HIGH_FEAR'?'Market fearful, reduce position sizes':marketData.vixRegime==='ELEVATED'?'Elevated uncertainty, be selective':'Market calm, normal position sizing'}
Sectors today: ${(marketData.sectors||[]).map(s=>s.label+' '+s.change).join(' | ')}

ANALYSIS RULES — follow strictly:
1. ACTION must be one of: STRONG BUY / BUY / WATCH / AVOID
2. BUY: uptrend + good entry + catalyst (earnings 15-45 days out OR strong momentum + analyst upgrades)
3. WATCH: good company, good trend, but no near-term catalyst or entry is extended
4. AVOID: downtrend (below 200 SMA), post-earnings gap >10%, broken thesis, fundamental problem
5. STRONG BUY: only if earnings within 10 days + uptrend + excellent entry quality
6. If TREND is DOWNTREND: maximum rating is WATCH — never recommend BUY in downtrend
7. If TREND is PULLBACK IN UPTREND: this is IDEAL entry — weight strongly toward BUY
8. Stop loss: use CALC_STOP if available (real support level). If not, use 7-10% below entry
9. R/R: calculate from (takeProfit - entryZone_mid) / (entryZone_mid - stopLoss). Minimum 2:1 for BUY
10. If user gave a price: assess whether it's a good entry vs current price and trend
11. currentPrice MUST be $${livePrice?.toFixed(2)} — do not change this
12. Plain English. Short sentences. No jargon. Write for a beginner investor.

Return ONLY compact JSON (no spaces, no newlines):
{"opportunities":[{"ticker":"${ticker}","company":"","action":"BUY|WATCH|AVOID","currentPrice":"$${livePrice?.toFixed(2)}","entryZone":"$X-$Y","stopLoss":"$X","takeProfit":"$X","expectedGain":"X%","riskReward":"X:1","allocation":"X%","whyWeLikeIt":"plain English max 20 words","whatCouldGoWrong":"plain English max 15 words","upcomingEvent":"next catalyst","eventDate":"DD Mon YYYY or TBC","trend":"from data","entryQuality":"from data","trendComment":"one plain sentence on chart setup","returnGate":"PASS|FAIL","cashChallenge":"PASS|FAIL","opportunityScore":0}]}`


      const ai = repairJSON(await claude(prompt, 'analyser'))
      setPortfolioResult({ ...ai, deepDive: null })
    } catch(e) {
      setPortfolioError(e.message)
    } finally {
      setPortfolioLoading(false)
    }
  }, [newTicker, newBuyPrice, newCurrency, getEH, claude])

  // ── T212 API functions ────────────────────────────────────────────────────
  const fetchT212 = useCallback(async () => {
    setT212Loading(true)
    setT212Error(null)
    try {
      const r = await fetch('/api/t212', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `T212 error ${r.status}`)
      setT212Data(d)
      setT212Result(null)
      // Cache T212 prices — these are always accurate (direct from T212)
      if (d.positions?.length) {
        const priceCache = {}
        d.positions.forEach(p => {
          if (p.ticker && p.currentPrice > 0) {
            priceCache[p.ticker] = {
              price:     p.currentPrice,
              changePct: p.gainPct || 0,
              source:    'T212',
            }
          }
        })
        setT212PriceCache(priceCache)
      }
    } catch (e) {
      setT212Error(e.message)
    } finally {
      setT212Loading(false)
    }
  }, [])

  const analyseT212 = useCallback(async () => {
    if (!t212Data?.positions?.length) return
    setT212AnalysisLoad(true)
    setT212Error(null)
    try {
      // Cap at 20 most valuable positions to keep prompt size manageable
      const sorted   = [...t212Data.positions].sort((a,b) => (b.totalValue||0)-(a.totalValue||0))
      const top20    = sorted.slice(0, 20)
      const tickers  = top20.map(p => p.ticker)

      // Parallel fetch — all in one go
      const [priceRes, techRes, newsRes, marketRes, calRes] = await Promise.allSettled([
        fetch('/api/prices?symbols='    + tickers.join(','),            { cache:'no-store' }),
        fetch('/api/technicals?symbols='+ tickers.slice(0,5).join(','), { cache:'no-store' }),
        fetch('/api/news?symbols='      + tickers.slice(0,8).join(','), { cache:'no-store' }),
        fetch('/api/market?type=global',                                { cache:'no-store' }),
        fetch('/api/market?type=opportunities',                         { cache:'no-store' }),
      ])

      const priceData  = priceRes.status==='fulfilled'  && priceRes.value.ok  ? await priceRes.value.json()  : {}
      const localTechMap = techRes.status==='fulfilled'  && techRes.value.ok   ? (await techRes.value.json())?.technicals||{} : {}
      const localNewsMap = newsRes.status==='fulfilled'  && newsRes.value.ok   ? (await newsRes.value.json())?.results||{}    : {}
      const marketData = marketRes.status==='fulfilled' && marketRes.value.ok ? await marketRes.value.json() : {}

      // Update React state for card display
      if (Object.keys(localTechMap).length) setTechMap(prev => ({...prev,...localTechMap}))
      if (Object.keys(localNewsMap).length) setNewsData(prev => ({...prev,...localNewsMap}))

      // Deduplicate positions — combine pie + direct holdings of same ticker
      const deduped = []
      const seen = {}
      top20.forEach(p => {
        if (seen[p.ticker]) {
          seen[p.ticker].totalValue = (seen[p.ticker].totalValue||0) + (p.totalValue||0)
          seen[p.ticker].ppl        = (seen[p.ticker].ppl||0)        + (p.ppl||0)
        } else {
          seen[p.ticker] = { ...p }
          deduped.push(seen[p.ticker])
        }
      })

      // Calculate total portfolio value for position sizing
      const totalPortfolioValue = deduped.reduce((s,p) => s+(p.totalValue||0), 0) || 1

      // Build earnings context from parallel calendar fetch
      const earningsContext = {}
      if (calRes.status === 'fulfilled' && calRes.value.ok) {
        try {
          const calData = await calRes.value.json()
          ;(calData.earningsCalendar||[]).forEach(e => {
            if (seen[e.ticker]) earningsContext[e.ticker] = e
          })
        } catch {}
      }

      // Build rich position lines
      const posLines = deduped.map(p => {
        const tc   = localTechMap[p.ticker] || {}
        const nd   = localNewsMap[p.ticker] || {}
        const eh   = getEH(p.ticker)
        const live = priceData.prices?.[p.ticker]
        const pct  = ((p.totalValue||0) / totalPortfolioValue * 100).toFixed(1)
        const ec   = earningsContext[p.ticker]
        const parts = [
          p.ticker + ':£' + (p.averagePrice||0).toFixed(0) + '→£' + (p.currentPrice||0).toFixed(0)
            + ' (' + (p.gainPct>=0?'+':'') + p.gainPct + '%) £' + (p.totalValue||0).toFixed(0)
            + ' (' + pct + '% of portfolio)',
          live?.changePct !== undefined ? 'today:' + (live.changePct>=0?'+':'') + live.changePct + '%' : '',
          ec ? 'EARNINGS:' + ec.date + ' in ' + ec.tradingDaysAway + 'd' : '',
          tc.trend ? 'TREND:' + tc.trend : '',
          tc.pctAbove200 != null ? 'vs200SMA:' + (tc.pctAbove200>=0?'+':'') + tc.pctAbove200 + '%' : '',
          tc.suggestedStopLoss ? 'STOP:£' + tc.suggestedStopLoss : '',
          nd.analyst ? 'Analysts:' + nd.analyst.consensus + '(' + nd.analyst.buy + 'buy/' + nd.analyst.hold + 'hold/' + nd.analyst.sell + 'sell)' : '',
          nd.lastEarnings ? 'LastEPS:' + (nd.lastEarnings.beat?'BEAT':'MISS') + nd.lastEarnings.surprise : '',
          nd.news?.[0] ? 'News:' + nd.news[0].headline.slice(0,60) : '',
          eh ? eh.label.split('·')[0].trim() : '',
        ]
        return parts.filter(Boolean).join(' | ')
      }).join('\n')

      // Build pie summary
      const pieLines = Object.entries(
        t212Data.positions.reduce((acc,p) => {
          if (p.pieName) {
            if (!acc[p.pieName]) acc[p.pieName] = {value:0,ppl:0}
            acc[p.pieName].value += p.totalValue||0
            acc[p.pieName].ppl   += p.ppl||0
          }
          return acc
        }, {})
      ).map(([name,d]) => name+': £'+d.value.toFixed(0)+' ('+(d.ppl>=0?'+':'')+'£'+d.ppl.toFixed(0)+')').join('\n')

      const pendingLines = (t212Data.pendingOrders||[]).map(o =>
        o.side+' '+o.quantity+' '+o.ticker+' @£'+o.limitPrice
      ).join(' | ') || 'None'

      const prompt = `Today: ${new Date().toDateString()}
UK Trading 212 account. All amounts in GBP (£).

CASH: Free £${t212Data.cash?.free||'?'} | Invested £${t212Data.cash?.invested||'?'} | Total £${t212Data.cash?.total||'?'} | P&L £${t212Data.cash?.ppl||'?'}

TOP 20 POSITIONS BY VALUE:
${posLines}

PIE GROUPS:
${pieLines || 'No pies'}

PENDING ORDERS: ${pendingLines}

VIX: ${marketData.vix||'N/A'} (${marketData.vixRegime||'N/A'})
Sectors: ${(marketData.sectors||[]).map(s=>s.label+' '+s.change).join(' | ')}

Return ONLY compact JSON:
{"portfolioHealth":"STRONG|GOOD|CAUTION|WEAK","overallSummary":"2 sentences","cashAdvice":"one sentence","topAction":"most urgent action","pies":[{"name":"","verdict":"HOLD|TRIM|ADD","reason":"max 10 words"}],"holdings":[{"ticker":"","action":"BUY MORE|HOLD|TRIM|SELL ALL","urgency":"NOW|THIS WEEK|NO RUSH","recommendation":"max 15 words","entryIfBuyMore":"","exitIfSell":""}],"pendingOrdersAdvice":[{"ticker":"","verdict":"KEEP|CANCEL","reason":"max 8 words"}]}`

      const rawText = await claude(prompt, 't212')
      const parsed  = repairJSON(rawText)
      setT212Result({ ...parsed, enriched: top20.map(p => ({
        ...p,
        livePriceFormatted: priceData.prices?.[p.ticker] ? '£'+priceData.prices[p.ticker].price.toFixed(2) : null
      }))})
    } catch(e) {
      setT212Error('Analysis failed: ' + e.message)
    } finally {
      setT212AnalysisLoad(false)
    }
  }, [t212Data, getEH, claude])


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

  // ── Core Watchlist Panel ──────────────────────────────────────────────────
  // expandedWatchlist state lives at Dashboard level to avoid hooks-in-nested-fn error
  function CoreWatchlistPanel({ priceMap }) {
    if (!priceMap || !Object.keys(priceMap).length) return null

    return (
      <div style={{ ...card({ marginBottom:14 }), padding:'12px 16px' }}>
        <button
          onClick={() => setExpandedWatchlist(e => !e)}
          style={{ appearance:'none', background:'none', border:'none', cursor:'pointer', width:'100%', textAlign:'left', padding:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}
        >
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:14, fontWeight:800, color:C.accent }}>📌 CORE WATCHLIST</span>
            <span style={{ color:C.muted, fontSize:12 }}>Your mandatory stocks — always visible</span>
          </div>
          <span style={{ color:C.muted, fontSize:16 }}>{expandedWatchlist ? '▲' : '▼'}</span>
        </button>

        {expandedWatchlist && (
          <div style={{ marginTop:12, display:'grid', gap:10 }}>
            {Object.entries(CORE_WATCHLIST).map(([group, tickers]) => (
              <div key={group}>
                <div style={{ ...LBL, marginBottom:6 }}>{group}</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {tickers.map(ticker => {
                    const q = priceMap[ticker]
                    const eh = getEH(ticker)
                    const up = q?.changePct >= 0
                    return (
                      <div key={ticker} style={{
                        background: q ? (up ? C.upBg : C.downBg) : C.bg,
                        border: `1px solid ${q ? (up ? C.up+'33' : C.down+'33') : C.border}`,
                        borderRadius:8, padding:'6px 10px', minWidth:90,
                      }}>
                        <div style={{ fontFamily:FM, fontWeight:800, fontSize:14, color:C.text }}>{ticker}</div>
                        {q ? (
                          <>
                            <div style={{ fontFamily:FM, fontWeight:700, fontSize:13 }}>${q.price?.toFixed(2)}</div>
                            <div style={{ color:up?C.up:C.down, fontSize:12, fontWeight:700 }}>{up?'+':''}{q.changePct?.toFixed(2)}%</div>
                          </>
                        ) : (
                          <div style={{ color:C.muted, fontSize:11 }}>Loading…</div>
                        )}
                        {eh && <div style={{ color:C.purple, fontSize:10, marginTop:2 }}>{eh.avg}% avg</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── renderOpps ─────────────────────────────────────────────────────────────
  function renderOpps() {
    const d = data.opportunities
    if (!d) return null
    const opps = d.opportunities||[]
    const visibleOpps = showAllOpps ? opps : opps.slice(0, 8)  // show 8, button reveals remaining

    return (
      <>
        <CIOPanelInner cio={d.cio} marketCondition={d.marketCondition} vix={d.vix} vixRegime={d.vixRegime} sectors={d.sectors} regime={d.regime} cashPct={d.cashPct} cashRecommendation={d.cashRecommendation} />
        <CoreWatchlistPanel priceMap={(() => {
          const m = {}
          ;(d.stocks||[]).forEach(s => { m[s.ticker] = s })
          return m
        })()} />
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
  // ── Stock Analyser (was My Portfolio) ────────────────────────────────────
  function renderPortfolio() {
    const actionColor = a => a==='BUY'||a==='STRONG BUY'?C.up:a==='WATCH'?C.amber:a==='AVOID'?C.down:C.accent
    const actionBg    = a => a==='BUY'||a==='STRONG BUY'?C.upBg:a==='WATCH'?C.amberBg:a==='AVOID'?C.downBg:C.accentBg

    return (
      <div>
        {/* Header */}
        <div style={{ ...card({ marginBottom:18 }), padding:'16px 20px' }}>
          <div style={{ color:C.text, fontWeight:800, fontSize:20, marginBottom:4 }}>🔍 Stock Analyser</div>
          <div style={{ color:C.muted, fontSize:14, lineHeight:1.6 }}>
            Enter any ticker to get a full AI analysis — BUY / WATCH / AVOID rating, entry price, stop loss, target, and deep dive. Works for stocks you own or ones you're considering.
          </div>
        </div>

        {/* Input form */}
        <div style={{ ...card({ marginBottom:18 }) }}>
          <div style={{ display:'grid', gridTemplateColumns: mob ? '1fr' : '2fr 2fr 1fr auto', gap:12, alignItems:'end', marginBottom:8 }}>
            <div>
              <div style={LBL}>TICKER SYMBOL</div>
              <input
                value={newTicker}
                onChange={e => setNewTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key==='Enter' && analysePortfolio()}
                placeholder="e.g. NVDA, AAPL, IONQ"
                style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:16, fontFamily:FM, fontWeight:700, outline:'none', boxSizing:'border-box', background:C.bg }}
              />
            </div>
            <div>
              <div style={LBL}>PRICE (optional — your buy price or target entry)</div>
              <input
                value={newBuyPrice}
                onChange={e => setNewBuyPrice(e.target.value)}
                onKeyDown={e => e.key==='Enter' && analysePortfolio()}
                placeholder="e.g. 450.00 — leave blank for current price"
                type="number"
                style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:15, fontFamily:FM, outline:'none', boxSizing:'border-box', background:C.bg }}
              />
            </div>
            <div>
              <div style={LBL}>CURRENCY</div>
              <select value={newCurrency} onChange={e => setNewCurrency(e.target.value)} style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:FB, outline:'none', background:C.bg }}>
                <option>USD</option><option>GBP</option><option>EUR</option>
              </select>
            </div>
            <button
              onClick={analysePortfolio}
              disabled={portfolioLoading || !newTicker.trim()}
              style={{ appearance:'none', background:portfolioLoading||!newTicker.trim()?C.border:C.accent, color:portfolioLoading||!newTicker.trim()?C.muted:'#fff', border:'none', borderRadius:10, padding:'11px 20px', fontWeight:800, fontSize:15, cursor:portfolioLoading||!newTicker.trim()?'not-allowed':'pointer', whiteSpace:'nowrap' }}
            >
              {portfolioLoading ? '⟳ Analysing…' : '⚡ Analyse'}
            </button>
          </div>
          {portfolioError && <div style={{ color:C.down, fontSize:13, marginTop:8 }}>Error: {portfolioError}</div>}
          <div style={{ color:C.muted, fontSize:12, marginTop:4 }}>
            Enter any stock — we fetch the live price, SMA trends, analyst ratings, recent news, earnings history and run a full AI analysis.
          </div>
        </div>

        {/* Result card */}
        {portfolioResult && (() => {
          const r = portfolioResult
          const opps = r.opportunities || []
          const opp = opps[0]
          if (!opp) return <div style={{ ...card(), color:C.muted }}>No analysis returned — try again.</div>
          return (
            <div>
              {/* Main analysis card — styled like OppCard */}
              <div style={{ ...card({ borderLeft:`6px solid ${actionColor(opp.action)}`, marginBottom:14 }) }}>
                {/* Header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, flexWrap:'wrap', gap:10 }}>
                  <div>
                    <div style={{ fontFamily:FM, fontWeight:900, fontSize:32, color:C.text }}>{opp.ticker}</div>
                    <div style={{ color:C.muted, fontSize:14 }}>{opp.company}</div>
                    {newBuyPrice && <div style={{ color:C.sub, fontSize:13, marginTop:4 }}>Your price: {newCurrency}{newBuyPrice}</div>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
                    <span style={{ background:actionBg(opp.action), color:actionColor(opp.action), borderRadius:12, padding:'8px 20px', fontWeight:900, fontSize:18 }}>
                      {opp.action}
                    </span>
                    <div style={{ fontFamily:FM, fontWeight:800, fontSize:24, color:C.text }}>{opp.currentPrice}</div>
                  </div>
                </div>

                {/* Trend badges */}
                {/* Only show if real SMA values — filter AI placeholder text */}
                {(() => { const VALID_TRENDS=['UPTREND','PULLBACK','RECOVERING','DOWNTREND']; const VALID_ENTRY=['EXCELLENT','GOOD','AVERAGE','POOR','FAIR']; const t=opp.trend; const e=opp.entryQuality; const showT=t&&VALID_TRENDS.some(v=>t.toUpperCase().includes(v)); const showE=e&&VALID_ENTRY.includes(e.toUpperCase()); if(!showT&&!showE) return null; return (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                    {showT && <Pill tone={t.includes('STRONG UP')?'green':t.includes('PULLBACK')?'blue':t.includes('RECOVER')?'amber':'red'} size="sm">📈 {t}</Pill>}
                    {showE && <Pill tone={e==='EXCELLENT'?'green':e==='GOOD'?'blue':e==='AVERAGE'?'grey':'red'} size="sm">Entry: {e}</Pill>}
                  </div>
                )})()}

                {/* Price grid */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10, marginBottom:14 }}>
                  {[
                    ['Entry Zone', opp.entryZone],
                    ['Stop Loss',  opp.stopLoss],
                    ['Target',     opp.takeProfit],
                    ['Expected',   opp.expectedGain],
                    ['Risk/Reward',opp.riskReward],
                    ['Allocation', opp.allocation],
                  ].filter(([,v]) => v).map(([l,v]) => (
                    <div key={l} style={{ background:C.bg, borderRadius:10, padding:'10px 12px' }}>
                      <div style={LBL}>{l}</div>
                      <div style={{ ...VAL, fontSize:15 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Gates */}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                  <GateBadge label="15%+ PATH EXISTS" pass={opp.returnGate==='PASS'?true:opp.returnGate==='FAIL'?false:null}/>
                  <GateBadge label="BEATS HOLDING CASH" pass={opp.cashChallenge==='PASS'?true:opp.cashChallenge==='FAIL'?false:null}/>
                  <Pill tone="green" size="sm">✓ LIVE PRICE</Pill>
                </div>

                {/* Why + Risk */}
                <div style={{ display:'grid', gridTemplateColumns:mob?'1fr':'1fr 1fr', gap:12, marginBottom:14 }}>
                  <div style={{ background:C.upBg, borderRadius:10, padding:'12px 14px' }}>
                    <div style={{ ...LBL, marginBottom:6 }}>WHY WE LIKE IT</div>
                    <div style={{ color:C.sub, fontSize:14, lineHeight:1.6 }}>{opp.whyWeLikeIt}</div>
                  </div>
                  <div style={{ background:C.downBg, borderRadius:10, padding:'12px 14px' }}>
                    <div style={{ ...LBL, marginBottom:6 }}>WHAT COULD GO WRONG</div>
                    <div style={{ color:C.sub, fontSize:14, lineHeight:1.6 }}>{opp.whatCouldGoWrong}</div>
                  </div>
                </div>

                {/* Upcoming event */}
                {opp.eventDate && (
                  <div style={{ background:C.amberBg, borderRadius:10, padding:'10px 14px', marginBottom:12 }}>
                    <div style={LBL}>UPCOMING CATALYST</div>
                    <div style={{ color:C.amber, fontWeight:800, fontSize:16, fontFamily:FM }}>{opp.upcomingEvent}</div>
                    <div style={{ color:C.amber, fontSize:13 }}>{opp.eventDate}</div>
                  </div>
                )}

                {/* Score */}
                {opp.opportunityScore && (
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ color:C.muted, fontSize:13 }}>AI Confidence Score</div>
                    <ScoreBar score={opp.opportunityScore} />
                    <div style={{ fontFamily:FM, fontWeight:800, fontSize:18, color:C.accent }}>{opp.opportunityScore}</div>
                  </div>
                )}
              </div>

              {/* Deep dive section */}
              <div style={card()}>
                <div style={{ ...LBL, marginBottom:12 }}>🔬 DEEP DIVE ANALYSIS</div>
                {r.deepDive ? (
                  <div style={{ color:C.sub, fontSize:14, lineHeight:1.8, whiteSpace:'pre-wrap' }}>{r.deepDive}</div>
                ) : portfolioLoading ? (
                  <div style={{ color:C.muted }}>⟳ Running deep dive…</div>
                ) : (
                  <button
                    onClick={async () => {
                      setPortfolioLoading(true)
                      try {
                        const text = await claude(
                          `Stock: ${opp.ticker} — ${opp.company}\nCurrent price: ${opp.currentPrice}\nRating: ${opp.action}\nEntry zone: ${opp.entryZone}\nStop loss: ${opp.stopLoss}\nTarget: ${opp.takeProfit}\nWhy: ${opp.whyWeLikeIt}\nRisk: ${opp.whatCouldGoWrong}\nUpcoming: ${opp.upcomingEvent||'N/A'} on ${opp.eventDate||'TBC'}\n\nWrite a clear, plain-English deep dive for a beginner investor. Short sentences. No jargon. Cover: why now, the upside case, the risk, and exactly what to watch for. Label each sentence (FACT), (ANALYSIS) or (OPINION). Under 280 words.`,
                          'deepdive'
                        )
                        setPortfolioResult(prev => ({ ...prev, deepDive: text }))
                      } catch(e) {
                        setPortfolioResult(prev => ({ ...prev, deepDive: 'Error: ' + e.message }))
                      } finally {
                        setPortfolioLoading(false)
                      }
                    }}
                    style={{ appearance:'none', background:C.accent, color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontWeight:700, fontSize:14, cursor:'pointer' }}
                  >
                    ▶ Run deep dive
                  </button>
                )}
              </div>
            </div>
          )
        })()}

        {/* Empty state */}
        {!portfolioResult && !portfolioLoading && (
          <div style={{ ...card({ textAlign:'center', padding:56 }) }}>
            <div style={{ fontSize:48, marginBottom:14 }}>🔍</div>
            <div style={{ color:C.text, fontWeight:700, fontSize:20, marginBottom:8 }}>Analyse any stock</div>
            <div style={{ color:C.muted, fontSize:14, maxWidth:420, margin:'0 auto', lineHeight:1.7 }}>
              Enter a ticker above and click Analyse. You'll get a full BUY / WATCH / AVOID verdict with entry price, stop loss, target, and deep dive — powered by live prices, SMA trends, analyst ratings and earnings history.
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderT212() {
    const PORTFOLIO_PASSWORD = process.env.NEXT_PUBLIC_PORTFOLIO_PASSWORD || 'catalyst2026'
    const ac  = a => a==='BUY MORE'?C.up  : a==='HOLD'?C.accent : a==='TRIM'?C.amber : C.down
    const abg = a => a==='BUY MORE'?C.upBg: a==='HOLD'?C.accentBg: a==='TRIM'?C.amberBg: C.downBg
    const hc  = h => h==='STRONG'?C.up:h==='GOOD'?C.accent:h==='CAUTION'?C.amber:C.down

    // ── Password gate ──────────────────────────────────────────────────────────
    if (!t212Unlocked) return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:400 }}>
        <div style={{ ...card({ maxWidth:400, width:'100%', textAlign:'center', padding:36 }) }}>
          <div style={{ fontSize:40, marginBottom:16 }}>🏦</div>
          <div style={{ color:C.text, fontWeight:800, fontSize:20, marginBottom:20 }}>T212 Live Portfolio</div>
          <input type="password" value={t212PwInput}
            onChange={e=>{setT212PwInput(e.target.value);setT212PwError(false)}}
            onKeyDown={e=>{if(e.key==='Enter'){if(t212PwInput===PORTFOLIO_PASSWORD){setT212Unlocked(true);try{sessionStorage.setItem('catalyst_t212_auth','true')}catch{}}else{setT212PwError(true);setT212PwInput('')}}}}
            placeholder="Password" autoFocus
            style={{ width:'100%', padding:'12px', borderRadius:10, border:`2px solid ${t212PwError?C.down:C.border}`, fontSize:16, outline:'none', background:C.bg, marginBottom:12, boxSizing:'border-box', textAlign:'center', letterSpacing:4 }}
          />
          {t212PwError && <div style={{ color:C.down, fontSize:13, marginBottom:12 }}>Wrong password</div>}
          <button onClick={()=>{if(t212PwInput===PORTFOLIO_PASSWORD){setT212Unlocked(true);try{sessionStorage.setItem('catalyst_t212_auth','true')}catch{}}else{setT212PwError(true);setT212PwInput('')}}}
            style={{ appearance:'none', background:C.accent, color:'#fff', border:'none', borderRadius:10, padding:'12px', fontWeight:800, fontSize:15, cursor:'pointer', width:'100%' }}>
            Unlock
          </button>
        </div>
      </div>
    )

    // ── Compact stock card ─────────────────────────────────────────────────────
    const StockCard = ({p}) => {
      const ai  = t212Result?.holdings?.find(h=>h.ticker===p.ticker)
      const tc  = techMap[p.ticker]  || {}
      const nd  = newsData[p.ticker] || {}
      const eh  = getEH(p.ticker)
      const up  = p.gainPct >= 0
      const col = ai ? ac(ai.action) : (up ? C.up : C.down)
      return (
        <div style={{ background:C.bg, borderRadius:10, padding:'10px 12px', borderLeft:`3px solid ${col}`, display:'flex', flexDirection:'column', gap:4 }}>
          {/* Row 1: ticker + % + action */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontFamily:FM, fontWeight:800, fontSize:15, color:C.text }}>{p.ticker}</span>
            <div style={{ display:'flex', gap:5, alignItems:'center' }}>
              <span style={{ color:up?C.up:C.down, fontWeight:700, fontSize:13 }}>{up?'+':''}{p.gainPct}%</span>
              {ai && <span style={{ background:abg(ai.action), color:ac(ai.action), borderRadius:5, padding:'2px 7px', fontWeight:800, fontSize:11 }}>{ai.action}</span>}
              {ai?.urgency==='NOW' && <span style={{ color:C.down, fontSize:10, fontWeight:700 }}>🔴</span>}
            </div>
          </div>
          {/* Row 2: prices + value */}
          <div style={{ display:'flex', gap:8, fontSize:12, color:C.muted }}>
            <span>£{p.averagePrice?.toFixed(2)} → £{p.currentPrice?.toFixed(2)}</span>
            <span style={{ color:C.sub, fontWeight:600 }}>£{p.totalValue?.toFixed(0)}</span>
          </div>
          {/* Row 3: AI recommendation */}
          {ai?.recommendation && <div style={{ color:C.sub, fontSize:11, lineHeight:1.4 }}>{ai.recommendation}</div>}
          {/* Row 4: entry/exit if applicable */}
          {ai?.action==='BUY MORE' && ai.entryIfBuyMore && (
            <div style={{ color:C.up, fontSize:11, fontWeight:600 }}>↗ Buy more at: {ai.entryIfBuyMore}</div>
          )}
          {(ai?.action==='TRIM'||ai?.action==='SELL ALL') && ai.exitIfSell && (
            <div style={{ color:C.amber, fontSize:11, fontWeight:600 }}>↘ {ai.action==='TRIM'?'Trim':'Exit'} at: {ai.exitIfSell}</div>
          )}
          {/* Row 5: SMA trend */}
          {tc.trend && tc.trend!=='UNKNOWN' && (
            <div style={{ fontSize:10, color:tc.trend==='STRONG UPTREND'?C.up:tc.trend.includes('PULLBACK')?C.accent:tc.trend==='RECOVERING'?C.amber:C.down, fontWeight:600 }}>
              📈 {tc.trend}
            </div>
          )}
          {/* Row 6: news */}
          {nd.news?.[0] && <div style={{ color:C.muted, fontSize:10, lineHeight:1.3, fontStyle:'italic' }}>{nd.news[0].headline?.slice(0,70)}…</div>}
          {/* Row 7: EH */}
          {eh && <div style={{ color:C.purple, fontSize:10, fontWeight:600 }}>{eh.label}</div>}
        </div>
      )
    }

    // ── Pie card ───────────────────────────────────────────────────────────────
    const PieCard = ({pieName, stocks}) => {
      const isOpen    = expandedPies[pieName] !== false
      const totalVal  = stocks.reduce((s,p)=>s+(p.totalValue||0),0)
      const totalPPL  = stocks.reduce((s,p)=>s+(p.ppl||0),0)
      const gainPct   = totalVal > 0 ? (totalPPL / (totalVal - totalPPL) * 100) : 0
      const pieAI     = t212Result?.pies?.find(x=>x.name===pieName)
      const col       = pieAI?.verdict==='ADD'?C.up:pieAI?.verdict==='TRIM'?C.amber:pieAI?.verdict==='HOLD'?C.accent:C.muted
      const stockActs = stocks.map(p=>t212Result?.holdings?.find(h=>h.ticker===p.ticker)?.action).filter(Boolean)
      return (
        <div style={{ ...card({ padding:0, overflow:'hidden', marginBottom:12 }) }}>
          {/* Pie header */}
          <button onClick={()=>setExpandedPies(prev=>({...prev,[pieName]:!isOpen}))}
            style={{ appearance:'none', width:'100%', background:C.card, border:'none', cursor:'pointer', padding:'14px 16px', textAlign:'left', borderLeft:`4px solid ${col}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:18 }}>🥧</span>
                <div>
                  <div style={{ color:C.text, fontWeight:800, fontSize:15 }}>{pieName}</div>
                  <div style={{ color:C.muted, fontSize:12 }}>{stocks.length} stocks · {isOpen?'collapse':'expand'}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:FM, fontWeight:800, fontSize:16, color:C.text }}>£{totalVal.toFixed(0)}</div>
                  <div style={{ fontFamily:FM, fontWeight:700, fontSize:12, color:totalPPL>=0?C.up:C.down }}>
                    {totalPPL>=0?'+':''}£{totalPPL.toFixed(0)} ({gainPct>=0?'+':''}{gainPct.toFixed(1)}%)
                  </div>
                </div>
                {pieAI && (
                  <div style={{ background:col+'22', border:`1px solid ${col}`, borderRadius:8, padding:'4px 10px', textAlign:'center' }}>
                    <div style={{ color:col, fontWeight:800, fontSize:13 }}>{pieAI.verdict}</div>
                    {pieAI.reason && <div style={{ color:C.muted, fontSize:10 }}>{pieAI.reason}</div>}
                  </div>
                )}
                <span style={{ color:C.muted, fontSize:16 }}>{isOpen?'▲':'▼'}</span>
              </div>
            </div>
            {/* Stock action summary */}
            {t212Result && stockActs.length > 0 && (
              <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                {['BUY MORE','HOLD','TRIM','SELL ALL'].map(a => {
                  const count = stockActs.filter(x=>x===a).length
                  if (!count) return null
                  return <span key={a} style={{ background:abg(a), color:ac(a), borderRadius:5, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{count} {a}</span>
                })}
              </div>
            )}
          </button>
          {/* Pie stocks grid */}
          {isOpen && (
            <div style={{ padding:'10px 12px', display:'grid', gridTemplateColumns:mob?'1fr 1fr':'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
              {stocks.map((p,i)=><StockCard key={i} p={p}/>)}
            </div>
          )}
        </div>
      )
    }

    // ── Main render ────────────────────────────────────────────────────────────
    const { pies: pieGroups, direct } = t212Data?.positions
      ? (() => {
          const pg = {}, dr = []
          t212Data.positions.forEach(p => {
            if (p.pieName) { if(!pg[p.pieName])pg[p.pieName]=[]; pg[p.pieName].push(p) }
            else dr.push(p)
          })
          return { pies:pg, direct:dr }
        })()
      : { pies:{}, direct:[] }

    return (
      <div>
        {/* ── Header bar ──────────────────────────────────────────────────── */}
        <div style={{ ...card({ marginBottom:14, padding:'12px 16px' }), display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
          <div>
            <span style={{ color:C.text, fontWeight:800, fontSize:17 }}>🏦 Trading 212 Live</span>
            <span style={{ color:C.muted, fontSize:12, marginLeft:8 }}>
              {t212Data ? `${t212Data.env||'LIVE'} · ${new Date(t212Data.fetchedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}` : 'Not loaded'}
            </span>
          </div>
          <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
            <button onClick={fetchT212} disabled={t212Loading}
              style={{ appearance:'none', background:C.accent, color:'#fff', border:'none', borderRadius:8, padding:'8px 14px', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {t212Loading?'⟳ Loading…':'⟳ Refresh'}
            </button>
            {t212Data && !t212AnalysisLoad && (
              <button onClick={analyseT212}
                style={{ appearance:'none', background:C.up, color:'#fff', border:'none', borderRadius:8, padding:'8px 14px', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                ⚡ Analyse
              </button>
            )}
            {t212AnalysisLoad && <span style={{ color:C.muted, fontSize:13, padding:'8px 0' }}>⟳ AI analysing…</span>}
            <button onClick={()=>{setT212Unlocked(false);setT212PwInput('');try{sessionStorage.removeItem('catalyst_t212_auth')}catch{}}}
              style={{ appearance:'none', background:'none', border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 10px', color:C.muted, fontSize:12, cursor:'pointer' }}>
              🔒
            </button>
          </div>
        </div>

        {/* Error / setup */}
        {t212Error && (
          <div style={{ ...card({ borderLeft:`4px solid ${C.down}`, marginBottom:14, padding:'12px 16px' }) }}>
            <div style={{ color:C.down, fontWeight:700, marginBottom:4 }}>
              {t212Error.includes('credentials') ? '⚙️ Setup required' : '⚠️ Error'}
            </div>
            <div style={{ color:C.sub, fontSize:13, lineHeight:1.7 }}>
              {t212Error.includes('credentials') ? (
                <>Add TRADING212_API_KEY and TRADING212_API_SECRET to Vercel env vars, then redeploy.</>
              ) : t212Error}
            </div>
          </div>
        )}

        {!t212Data && !t212Loading && !t212Error && (
          <div style={{ ...card({ textAlign:'center', padding:40 }) }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🏦</div>
            <button onClick={fetchT212}
              style={{ appearance:'none', background:C.accent, color:'#fff', border:'none', borderRadius:10, padding:'12px 24px', fontWeight:800, fontSize:15, cursor:'pointer' }}>
              Load my portfolio
            </button>
          </div>
        )}

        {t212Loading && <div style={{ ...card({ textAlign:'center', padding:32 }) }}><div style={{ color:C.muted }}>⟳ Fetching from Trading 212…</div></div>}

        {/* ── Cash summary ──────────────────────────────────────────────── */}
        {t212Data?.cash && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
            {[['Free Cash',`£${t212Data.cash.free}`,C.up],['Invested',`£${t212Data.cash.invested}`,C.accent],['Total',`£${t212Data.cash.total}`,C.text],['P&L',`£${t212Data.cash.ppl}`,parseFloat(t212Data.cash.ppl)>=0?C.up:C.down]].map(([l,v,c])=>(
              <div key={l} style={{ ...card({ padding:'10px 12px' }) }}>
                <div style={LBL}>{l}</div>
                <div style={{ color:c, fontFamily:FM, fontWeight:800, fontSize:mob?16:18 }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── AI portfolio summary ───────────────────────────────────────── */}
        {t212Result && (
          <div style={{ ...card({ marginBottom:14, borderLeft:`4px solid ${hc(t212Result.portfolioHealth)}` }) }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
              <Pill tone={t212Result.portfolioHealth==='STRONG'?'green':t212Result.portfolioHealth==='GOOD'?'blue':t212Result.portfolioHealth==='CAUTION'?'amber':'red'} size="lg">
                {t212Result.portfolioHealth||'ANALYSED'}
              </Pill>
              {t212Result.topAction && <span style={{ color:C.sub, fontSize:14, fontWeight:600 }}>→ {t212Result.topAction}</span>}
            </div>
            {t212Result.overallSummary && <div style={{ color:C.sub, fontSize:14, lineHeight:1.6, marginBottom:6 }}>{t212Result.overallSummary}</div>}
            {t212Result.cashAdvice && <div style={{ color:C.amber, fontSize:13, fontWeight:600 }}>{t212Result.cashAdvice}</div>}
          </div>
        )}

        {/* ── Positions ─────────────────────────────────────────────────── */}
        {t212Data?.positions?.length > 0 && (
          <>
            {/* View toggle */}
            <div style={{ display:'flex', gap:7, marginBottom:12, alignItems:'center' }}>
              <span style={{ color:C.muted, fontSize:13 }}>View:</span>
              {['pies','stocks'].map(m=>(
                <button key={m} onClick={()=>setT212ViewMode(m)}
                  style={{ appearance:'none', border:`1.5px solid ${t212ViewMode===m?C.accent:C.border}`, background:t212ViewMode===m?C.accent:C.card, color:t212ViewMode===m?'#fff':C.sub, borderRadius:7, padding:'6px 12px', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                  {m==='pies'?'🥧 By Pie':'📋 All Holdings'}
                </button>
              ))}
            </div>

            {/* By Pie view */}
            {t212ViewMode==='pies' && (
              <div>
                {Object.entries(pieGroups).map(([name,stocks])=><PieCard key={name} pieName={name} stocks={stocks}/>)}
                {direct.length>0 && (
                  <div style={{ ...card({ padding:0, overflow:'hidden' }) }}>
                    <button onClick={()=>setExpandedPies(p=>({...p,'__direct__':!(p['__direct__']!==false)}))}
                      style={{ appearance:'none', width:'100%', background:C.card, border:'none', cursor:'pointer', padding:'14px 16px', textAlign:'left', borderLeft:`4px solid ${C.muted}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span>📋</span>
                          <div>
                            <div style={{ color:C.text, fontWeight:800, fontSize:15 }}>Direct Holdings</div>
                            <div style={{ color:C.muted, fontSize:12 }}>{direct.length} stocks</div>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontFamily:FM, fontWeight:800, fontSize:16 }}>£{direct.reduce((s,p)=>s+(p.totalValue||0),0).toFixed(0)}</div>
                            <div style={{ fontSize:12, color:direct.reduce((s,p)=>s+(p.ppl||0),0)>=0?C.up:C.down, fontFamily:FM, fontWeight:700 }}>
                              {direct.reduce((s,p)=>s+(p.ppl||0),0)>=0?'+':''}£{direct.reduce((s,p)=>s+(p.ppl||0),0).toFixed(0)}
                            </div>
                          </div>
                          <span style={{ color:C.muted }}>{expandedPies['__direct__']===false?'▼':'▲'}</span>
                        </div>
                      </div>
                    </button>
                    {expandedPies['__direct__']!==false && (
                      <div style={{ padding:'10px 12px', display:'grid', gridTemplateColumns:mob?'1fr 1fr':'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
                        {direct.map((p,i)=><StockCard key={i} p={p}/>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* All Holdings view */}
            {t212ViewMode==='stocks' && (
              <div style={{ display:'grid', gridTemplateColumns:mob?'1fr 1fr':'repeat(auto-fill,minmax(200px,1fr))', gap:8, marginBottom:16 }}>
                {t212Data.positions.map((p,i)=><StockCard key={i} p={p}/>)}
              </div>
            )}
          </>
        )}

        {/* ── Pending orders ─────────────────────────────────────────────── */}
        {t212Data?.pendingOrders?.length>0 && (
          <div style={{ ...card({ marginBottom:14 }) }}>
            <div style={{ ...LBL, marginBottom:10 }}>⏳ PENDING ORDERS</div>
            <div style={{ display:'grid', gap:6 }}>
              {t212Data.pendingOrders.map((o,i)=>{
                const advice = t212Result?.pendingOrdersAdvice?.find(a=>a.ticker===o.ticker)
                return (
                  <div key={i} style={{ display:'flex', gap:8, alignItems:'center', background:C.bg, borderRadius:8, padding:'8px 12px', flexWrap:'wrap' }}>
                    <span style={{ background:o.side==='BUY'?C.upBg:C.amberBg, color:o.side==='BUY'?C.up:C.amber, borderRadius:5, padding:'2px 7px', fontWeight:800, fontSize:12 }}>{o.side}</span>
                    <span style={{ fontFamily:FM, fontWeight:800, fontSize:14 }}>{o.ticker}</span>
                    <span style={{ color:C.sub, fontSize:12 }}>{o.quantity} @ £{o.limitPrice}</span>
                    {advice && <><span style={{ color:advice.verdict==='KEEP'?C.up:C.down, fontWeight:700, fontSize:12 }}>{advice.verdict}</span><span style={{ color:C.muted, fontSize:11 }}>{advice.reason}</span></>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }


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
