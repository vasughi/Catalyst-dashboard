/**
 * CATALYST — src/app/api/macro/route.js
 *
 * Shared macro context block — fetched ONCE, injected into ALL AI prompts.
 *
 * Provides what the opportunities/analyser/T212/risk tabs were missing:
 *   - Bond yields (US 10Y, 2Y) — risk-free rate, recession signal
 *   - Oil (WTI) — geopolitical risk proxy, cost-push inflation signal
 *   - Gold — fear/safe-haven demand
 *   - DXY (dollar index) — strong dollar = headwind for risk assets
 *   - VIX — fear gauge
 *   - Key macro calendar — Fed dates, CPI, jobs — hardcoded + updated regularly
 *   - Geopolitical flags — major active risks
 *
 * All data sources: TwelveData (same key as market route) + Finnhub fallback.
 * Cached 15 minutes — cheap, fast, doesn't need to be live-live.
 *
 * Runtime: Node.js, maxDuration 30s (short fetches only)
 */

import { NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

const TD_KEY = process.env.TWELVE_DATA_API_KEY
const FH_KEY = process.env.FINNHUB_API_KEY
const TD_BASE = 'https://api.twelvedata.com'
const FH_BASE = 'https://finnhub.io/api/v1'

function resp(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=300', // 15min cache
    },
  })
}

async function tdQuote(symbol, type = 'etf') {
  if (!TD_KEY) return null
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 5000)
    const r = await fetch(
      `${TD_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${TD_KEY}`,
      { cache: 'no-store', signal: controller.signal }
    )
    if (!r.ok) return null
    const d = await r.json()
    if (d.status === 'error' || !d.close) return null
    const price = parseFloat(d.close)
    const prev  = parseFloat(d.previous_close)
    const chg   = parseFloat(d.percent_change || 0)
    if (!price || price <= 0) return null
    return { price, prev, changePct: parseFloat(chg.toFixed(2)), symbol }
  } catch { return null }
}

async function fhQuote(symbol) {
  if (!FH_KEY) return null
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 4000)
    const r = await fetch(
      `${FH_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${FH_KEY}`,
      { cache: 'no-store', signal: controller.signal }
    )
    if (!r.ok) return null
    const d = await r.json()
    if (!d.c || d.c === 0) return null
    return { price: d.c, prev: d.pc, changePct: parseFloat((d.dp ?? 0).toFixed(2)), symbol }
  } catch { return null }
}

async function quote(symbol) {
  const td = await tdQuote(symbol)
  if (td) return td
  return fhQuote(symbol)
}

// ── Upcoming macro calendar ────────────────────────────────────────────────────
// UPDATE QUARTERLY — these are the structural macro events that matter for
// swing trading. Fed dates are published a year in advance. CPI is ~2nd week
// of each month. NFP is ~first Friday. OpEx is 3rd Friday of expiry months.
//
// HOW TO UPDATE:
//   1. After each FOMC: add next two FOMC dates
//   2. Monthly: add next CPI date (released ~10th of following month)
//   3. Quarterly: add Q-end dates, update OpEx dates
//   4. Remove any dates that are now in the past (daysAway < -3)
//
// Do NOT add stock-specific commentary here — that comes from live news feed.
// Do NOT add geopolitical event dates here — those are in GEO_FLAGS above.
const MACRO_CALENDAR = [
  // ── Fed (published a year ahead at federalreserve.gov) ───────────────────
  { date: '2026-06-17', event: 'FOMC Rate Decision', type: 'FED',
    detail: 'Fed rate decision + press conference. Rate-sensitive stocks (growth, REITs, utilities) most affected.',
    impact: 'HIGH', sector: 'ALL' },
  { date: '2026-07-28', event: 'FOMC Rate Decision', type: 'FED',
    detail: 'Fed rate decision. First Q3 meeting — key for rate cut timing signals.',
    impact: 'HIGH', sector: 'ALL' },
  { date: '2026-09-15', event: 'FOMC Rate Decision', type: 'FED',
    detail: 'September FOMC — historically significant for policy pivots.',
    impact: 'HIGH', sector: 'ALL' },
  { date: '2026-11-04', event: 'FOMC Rate Decision', type: 'FED',
    detail: 'November FOMC — post-election meeting, often sets year-end tone.',
    impact: 'HIGH', sector: 'ALL' },
  // ── Inflation / CPI (released ~10th of following month by BLS) ───────────
  { date: '2026-06-10', event: 'US CPI Release (May data)', type: 'INFLATION',
    detail: 'Monthly inflation print. Hot = Fed hawkish = risk-off. Cool = cut hopes = risk-on.',
    impact: 'HIGH', sector: 'ALL' },
  { date: '2026-07-14', event: 'US CPI Release (Jun data)', type: 'INFLATION',
    detail: 'Pre-FOMC inflation data — heavily watched for July meeting.',
    impact: 'HIGH', sector: 'ALL' },
  { date: '2026-08-12', event: 'US CPI Release (Jul data)', type: 'INFLATION',
    detail: 'Pre-September FOMC inflation read.',
    impact: 'HIGH', sector: 'ALL' },
  // ── Jobs / NFP (first Friday of each month) ───────────────────────────────
  { date: '2026-07-10', event: 'US Jobs Report (Jun data)', type: 'JOBS',
    detail: 'Non-farm payrolls. Strong jobs = Fed holds. Weak jobs = cut probability rises.',
    impact: 'HIGH', sector: 'ALL' },
  { date: '2026-08-07', event: 'US Jobs Report (Jul data)', type: 'JOBS',
    detail: 'Jobs data ahead of September FOMC.',
    impact: 'HIGH', sector: 'ALL' },
  // ── Options Expiry / Seasonality ─────────────────────────────────────────
  { date: '2026-06-19', event: 'June OpEx — Triple Witching', type: 'TECHNICAL',
    detail: 'Quarterly options, futures, and index derivatives all expire. Week before is typically volatile.',
    impact: 'MEDIUM', sector: 'ALL' },
  { date: '2026-06-30', event: 'Q2 End — Window Dressing', type: 'TECHNICAL',
    detail: 'Quarter-end. Fund managers buy recent winners to show in portfolios. Can amplify momentum.',
    impact: 'LOW', sector: 'ALL' },
  { date: '2026-07-17', event: 'July OpEx', type: 'TECHNICAL',
    detail: 'Monthly options expiry. Market typically makes a directional move into expiry week.',
    impact: 'LOW', sector: 'ALL' },
  { date: '2026-09-18', event: 'September OpEx — Triple Witching', type: 'TECHNICAL',
    detail: 'Quarterly expiry. Q3 end volatility.',
    impact: 'MEDIUM', sector: 'ALL' },
]

// ── Structural geopolitical themes — updated quarterly, not daily ──────────────
// These are sector-level patterns that persist for months, not day-by-day updates.
// For today's specific news, the AI reads live Finnhub headlines in the prompt.
const GEO_FLAGS = [
  {
    risk: 'Middle East Conflict (Iran-Israel-US)',
    severity: 'HIGH',
    bullish: ['Defence stocks (RTX, LMT, NOC, KTOS)', 'Oil (XLE)', 'Gold'],
    bearish: ['Semis (supply chain risk)', 'Airlines', 'Consumer discretionary'],
    detail: 'Active conflict in the region. Strait of Hormuz oil shipping risk. European rearmament accelerating. Direct procurement cycle for US defence primes.',
  },
  {
    risk: 'US Trade Policy / Tariffs',
    severity: 'HIGH',
    bullish: ['US domestic manufacturers', 'Reshoring plays', 'US-listed defence'],
    bearish: ['TSMC-dependent companies (NVDA, AVGO)', 'Global supply chains'],
    detail: 'Semiconductor tariffs a recurring risk. Check current status in live news. AI infrastructure buildout faces cost headwinds when tariffs active.',
  },
  {
    risk: 'China-Taiwan Geopolitical Risk',
    severity: 'MEDIUM',
    bullish: ['US domestic chip makers', 'Reshoring beneficiaries'],
    bearish: ['TSMC', 'TSMC-dependent AI companies'],
    detail: 'Structural background risk. Any escalation causes immediate NVDA/AVGO selloff. Monitor quarterly — not a daily trading factor unless news breaks.',
  },
  {
    risk: 'European Rearmament Cycle',
    severity: 'MEDIUM',
    bullish: ['US defence primes (RTX, LMT, NOC)', 'Drone manufacturers (KTOS, AVAV)'],
    bearish: [],
    detail: 'Multi-year structural tailwind. EU defence spending rising sharply. US defence companies are primary beneficiaries of European procurement.',
  },
]

// ── Structural Trump/US policy themes — updated quarterly ────────────────────
// These are the durable policy directions that affect sector allocation.
// For current status of any specific policy, the AI reads live news in the prompt.
const TRUMP_DYNAMICS = [
  {
    policy: 'AI Infrastructure Push (Project Stargate)',
    impact: 'BULLISH',
    sectors: ['AI Infrastructure', 'Data Centres', 'Power Grid'],
    detail: 'Large federal AI infrastructure commitment. Structural tailwind for data centre power (VRT, ETN, GEV, CEG) and AI silicon (NVDA, MRVL). Multi-year duration.',
  },
  {
    policy: 'Semiconductor Tariff Risk',
    impact: 'WATCH',
    sectors: ['Semiconductors', 'AI Hardware'],
    detail: 'Tariffs on semiconductors are a recurring lever. When active: headwind for NVDA, AVGO, TSMC-dependent cos. Check live news for current status.',
  },
  {
    policy: 'Defence & Pentagon Spending',
    impact: 'BULLISH',
    sectors: ['Defence', 'Aerospace', 'Drones'],
    detail: 'Elevated defence budgets + active conflicts = strong procurement cycle. RTX, LMT, KTOS, AVAV, RCAT are structural beneficiaries.',
  },
  {
    policy: 'Deregulation & M&A Environment',
    impact: 'BULLISH',
    sectors: ['Fintech', 'Banking', 'Tech M&A'],
    detail: 'Less aggressive antitrust enforcement. M&A activity returning. Benefits COIN, HOOD, SQ and any potential acquisition targets.',
  },
]

function tradingDaysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr), now = new Date()
  if (target < now) return -1
  let days = 0, cur = new Date(now)
  while (cur < target) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) days++
  }
  return days
}

export async function GET() {
  // Fetch all macro instruments in parallel
  // Proxies for bond yields since most free APIs don't give direct yields:
  // TLT = 20Y Treasury ETF (inverse of 10Y yield — when TLT falls, yields rise)
  // SHY = 1-3Y Treasury ETF (proxy for 2Y yield)
  // UUP = dollar index ETF (DXY proxy)
  // GLD = gold ETF
  // USO = oil ETF (WTI proxy)
  // VIXY = VIX proxy
  // IEF = 7-10Y Treasury ETF (best 10Y proxy)

  const [tlt, ief, shy, uup, gld, uso, vixy, xau] = await Promise.all([
    quote('TLT'),   // 20Y Treasury — long-duration risk proxy
    quote('IEF'),   // 7-10Y Treasury — best 10Y yield proxy
    quote('SHY'),   // 2Y Treasury proxy
    quote('UUP'),   // Dollar index proxy
    quote('GLD'),   // Gold
    quote('USO'),   // WTI Oil
    quote('VIXY'),  // VIX proxy
    quote('XAUUSD'), // Gold spot fallback
  ])

  // Build yield interpretation
  // IEF moves inversely to 10Y yield — when IEF falls, 10Y yield rises
  // IEF around $92-96 typically corresponds to 10Y yield of ~4.2-4.8%
  const yieldContext = ief
    ? ief.changePct < -0.3
      ? 'RISING (bond selloff — tightening financial conditions)'
      : ief.changePct > 0.3
      ? 'FALLING (bond rally — easing financial conditions)'
      : 'STABLE'
    : 'UNKNOWN'

  // Dollar context
  const dxContext = uup
    ? uup.changePct > 0.3
      ? 'STRENGTHENING (headwind for risk assets, commodities, EM)'
      : uup.changePct < -0.3
      ? 'WEAKENING (tailwind for risk assets, commodities)'
      : 'STABLE'
    : 'UNKNOWN'

  // Oil context
  const oilContext = uso
    ? uso.changePct > 2
      ? 'SURGING (geopolitical risk premium — inflation concern)'
      : uso.changePct > 0.5
      ? 'RISING (mild geopolitical bid)'
      : uso.changePct < -2
      ? 'FALLING (demand concerns)'
      : 'STABLE'
    : 'UNKNOWN'

  // Gold context
  const goldQ = gld || xau
  const goldContext = goldQ
    ? goldQ.changePct > 0.5
      ? 'RISING (safe-haven demand — risk-off signal)'
      : goldQ.changePct < -0.5
      ? 'FALLING (risk-on, less fear)'
      : 'STABLE'
    : 'UNKNOWN'

  // VIX level
  const vix = vixy?.price ?? null
  const vixRegime = vix
    ? vix > 30 ? 'EXTREME_FEAR'
    : vix > 25 ? 'HIGH_FEAR'
    : vix > 20 ? 'ELEVATED'
    : vix > 15 ? 'NORMAL'
    : 'COMPLACENT'
    : 'UNKNOWN'

  // ── Upcoming macro events (next 45 days, sorted by proximity) ─────────────
  const today = new Date()
  const upcomingEvents = MACRO_CALENDAR
    .map(e => ({ ...e, daysAway: tradingDaysUntil(e.date) }))
    .filter(e => e.daysAway !== null && e.daysAway >= -1 && e.daysAway <= 45)
    .sort((a, b) => a.daysAway - b.daysAway)

  // ── Build the shared macro context text block ──────────────────────────────
  // This is injected verbatim into every AI prompt — the single source of truth
  const marketIntelBlock = buildMacroBlock({
    ief, tlt, shy, uup, gld: goldQ, uso, vixy,
    yieldContext, dxContext, oilContext, goldContext,
    vix, vixRegime, upcomingEvents,
  })

  return resp({
    fetchedAt: new Date().toISOString(),
    // Raw data
    bonds:  { ief, tlt, shy, yieldContext },
    dollar: { uup, dxContext },
    oil:    { uso, oilContext },
    gold:   { gld: goldQ, goldContext },
    vix,
    vixRegime,
    // Structured context
    upcomingEvents,
    geoFlags:      GEO_FLAGS,
    trumpDynamics: TRUMP_DYNAMICS,
    // The pre-built text block — inject directly into prompts
    macroBlock: marketIntelBlock,
  })
}

function buildMacroBlock({ ief, tlt, uup, gld, uso, vixy, yieldContext, dxContext, oilContext, goldContext, vix, vixRegime, upcomingEvents }) {
  const lines = []

  lines.push('═══ MACRO CONTEXT (use this in all analysis) ═══')

  // Fear gauge
  lines.push(`FEAR GAUGE: VIX ${vix ? vix.toFixed(1) : 'N/A'} (${vixRegime})${
    vixRegime === 'EXTREME_FEAR' ? ' — CASH IS KING. Only highest-conviction positions.'
    : vixRegime === 'HIGH_FEAR'  ? ' — Reduce position sizes 30-40%. Be selective.'
    : vixRegime === 'ELEVATED'   ? ' — Tighten entry criteria. Prefer defence/non-tech.'
    : vixRegime === 'NORMAL'     ? ' — Normal risk environment. Standard position sizing.'
    : ''
  }`)

  // Bond yields (IEF proxy)
  if (ief) {
    lines.push(`BOND YIELDS (10Y proxy): ${yieldContext}. IEF ${ief.changePct >= 0 ? '+' : ''}${ief.changePct}% today. ${
      yieldContext.includes('RISING') ? 'Rising yields = headwind for growth/tech stocks. Favour value/defence.' :
      yieldContext.includes('FALLING') ? 'Falling yields = tailwind for growth. Tech and semis benefit.' :
      'Stable yields = neutral for equities.'
    }`)
  }

  // Dollar
  if (uup) {
    lines.push(`DOLLAR (DXY proxy): ${dxContext}. UUP ${uup.changePct >= 0 ? '+' : ''}${uup.changePct}% today. ${
      dxContext.includes('STRENGTHENING') ? 'Strong dollar hurts multinational earnings, commodities, EM.' :
      dxContext.includes('WEAKENING') ? 'Weak dollar boosts commodity prices and international revenue stocks.' : ''
    }`)
  }

  // Oil
  if (uso) {
    lines.push(`OIL (WTI proxy): ${oilContext}. USO ${uso.changePct >= 0 ? '+' : ''}${uso.changePct}% today. ${
      oilContext.includes('SURGING') ? 'Iran conflict Strait of Hormuz risk. Buy: RTX, LMT, XLE. Watch: airlines, logistics.' :
      oilContext.includes('RISING') ? 'Mild geopolitical bid. Monitor for Strait of Hormuz escalation.' :
      oilContext.includes('FALLING') ? 'Oil demand concerns. Positive for tech/manufacturing cost margins.' : ''
    }`)
  }

  // Gold
  if (gld) {
    lines.push(`GOLD: ${goldContext}. GLD ${gld.changePct >= 0 ? '+' : ''}${gld.changePct}% today. ${
      goldContext.includes('RISING') ? 'Risk-off safe-haven demand. Confirms defensive rotation is right call.' :
      goldContext.includes('FALLING') ? 'Risk appetite returning. Supports growth stock rotation.' : ''
    }`)
  }

  // Upcoming events — the most critical missing piece
  lines.push('')
  lines.push('KEY UPCOMING EVENTS (factor these into timing):')
  upcomingEvents.slice(0, 10).forEach(e => {
    const urgency = e.daysAway <= 0 ? '[TODAY/PAST]'
      : e.daysAway <= 3  ? `[URGENT — ${e.daysAway}d]`
      : e.daysAway <= 7  ? `[THIS WEEK — ${e.daysAway}d]`
      : e.daysAway <= 14 ? `[NEXT 2 WEEKS — ${e.daysAway}d]`
      : `[${e.daysAway}d]`
    lines.push(`  ${urgency} ${e.event} (${e.date}): ${e.detail} [IMPACT: ${e.impact}]`)
  })

  // Geopolitical flags
  lines.push('')
  lines.push('GEOPOLITICAL RISKS ACTIVE NOW:')
  GEO_FLAGS.filter(g => g.status === 'ACTIVE' || g.status === 'ACCELERATING').forEach(g => {
    lines.push(`  ${g.risk} [${g.severity}]: ${g.detail}`)
    if (g.bullish.length) lines.push(`    → BULLISH: ${g.bullish.join(', ')}`)
    if (g.bearish.length) lines.push(`    → BEARISH: ${g.bearish.join(', ')}`)
  })

  // Trump dynamics
  lines.push('')
  lines.push('TRUMP POLICY DYNAMICS (direct market movers):')
  TRUMP_DYNAMICS.forEach(t => {
    lines.push(`  ${t.policy} [${t.status}] [${t.impact}]: ${t.detail}`)
  })

  lines.push('═══ END MACRO CONTEXT ═══')

  return lines.join('\n')
}
