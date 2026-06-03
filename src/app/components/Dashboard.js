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
      .replace(/,\s*}/g, '}')       // trailing commas in objects
      .replace(/,\s*\]/g, ']')       // trailing commas in arrays
      .replace(/[
