'use client'
import { useState, useCallback } from 'react'

const C = {
  bg:'#0a0e17', card:'#111827', border:'#1f2937',
  text:'#e2e8f0', muted:'#6b7280',
  up:'#10b981', down:'#ef4444', flat:'#6b7280', accent:'#00d4aa'
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function repairJSON(str) {
  let s = str.replace(/```json|```/g,'').trim()
  const start = s.indexOf('{')
  if (start === -1) throw new Error('No JSON found in response')
  s = s.slice(start)
  const opens = []
  let inStr = false, esc = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (esc) { esc=false; continue }
    if (c==='\\'&&inStr) { esc=true; continue }
    if (c==='"') { inStr=!inStr; continue }
    if (inStr) continue
    if (c==='{'||c==='[') opens.push(c==='{'?'}':']')
    if (c==='}'||c===']') opens.pop()
  }
  try { return JSON.parse(s) } catch {}
  const fixed = s.replace(/,\s*([}\]])/g,'$1').trimEnd() + opens.reverse().join('')
  try { return JSON.parse(fixed) } catch(e) { throw new Error('Could not parse AI response') }
}

// ── UI Components ─────────────────────────────────────────────────────────────
const Badge = ({children,color}) => (
  <span style={{background:color+'22',color,border:`1px solid ${color}55`,borderRadius:4,padding:'2px 8px',fontSize:11,fontWeight:700,letterSpacing:0.5,textTransform:'uppercase',whiteSpace:'nowrap'}}>{children}</span>
)
const Card = ({children,style={}}) => (
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:20,...style}}>{children}</div>
)
const SH = ({t}) => <div style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:12,textTransform:'uppercase'}}>{t}</div>
const HR = ({i,n}) => i<n-1?<div style={{borderBottom:`1px solid ${C.border}`}}/>:null

const Spinner = ({color='#00d4aa'}) => (
  <span style={{display:'inline-block',animation:'spin 1s linear infinite',color,fontSize:18}}>⟳</span>
)

function StatusBadge({step}) {
  const steps = ['Fetching live market data…','Analysing with AI…','Done']
  return (
    <div style={{textAlign:'center',padding:'60px 20px'}}>
      <div style={{marginBottom:16}}><Spinner color={C.accent}/></div>
      <div style={{color:C.accent,fontWeight:600,marginBottom:6}}>{steps[step]||steps[0]}</div>
      <div style={{color:C.muted,fontSize:12}}>
        {step===0&&'Connecting to Yahoo Finance for real prices'}
        {step===1&&'Sending real data to AI for analysis'}
      </div>
      <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:20}}>
        {steps.slice(0,2).map((s,i)=>(
          <div key={i} style={{width:8,height:8,borderRadius:4,background:i<=step?C.accent:C.border,transition:'background 0.3s'}}/>
        ))}
      </div>
    </div>
  )
}

const ErrorState = ({error,onRetry}) => (
  <div style={{textAlign:'center',padding:'60px 20px'}}>
    <div style={{fontSize:32,marginBottom:12}}>⚠️</div>
    <div style={{color:C.down,fontWeight:600,marginBottom:8}}>Could not fetch data</div>
    <div style={{color:C.muted,fontSize:13,marginBottom:20,maxWidth:480,margin:'0 auto 20px'}}>{error}</div>
    <button onClick={onRetry} style={{background:C.down+'22',border:`1px solid ${C.down}55`,color:C.down,borderRadius:6,padding:'8px 20px',cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>Try Again</button>
  </div>
)

const EmptyState = ({label,color,onLoad}) => (
  <div style={{textAlign:'center',padding:'80px 20px'}}>
    <div style={{fontSize:44,marginBottom:16}}>{label.split(' ')[0]}</div>
    <div style={{color:C.text,fontWeight:600,marginBottom:8,fontSize:16}}>{label.replace(/^.\s/,'')}</div>
    <div style={{color:C.muted,fontSize:14,marginBottom:28}}>Click to fetch live market data</div>
    <button onClick={onLoad} style={{background:color+'22',border:`1px solid ${color}`,color,borderRadius:8,padding:'12px 32px',cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit'}}>⟳ Load Live Data</button>
  </div>
)

const RefreshBtn = ({onClick,loading}) => (
  <button onClick={onClick} disabled={loading} style={{background:loading?'#1f2937':C.accent+'22',border:`1px solid ${C.accent}55`,color:loading?C.muted:C.accent,borderRadius:6,padding:'6px 14px',cursor:loading?'not-allowed':'pointer',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:6,fontFamily:'inherit'}}>
    <span style={{display:'inline-block',animation:loading?'spin 1s linear infinite':'none'}}>↻</span>
    {loading?'Loading…':'Refresh'}
  </button>
)

// ── Section views ─────────────────────────────────────────────────────────────
function GlobalView({data}) {
  const dir = d=>d==='up'?C.up:d==='down'?C.down:C.flat
  const sc = data.sentiment==='RISK ON'?C.up:data.sentiment==='RISK OFF'?C.down:C.flat
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <Card>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <Badge color={sc}>{data.sentiment||'NEUTRAL'}</Badge>
          <span style={{color:C.muted,fontSize:13}}>{data.sentimentReason}</span>
        </div>
      </Card>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
        {[{title:'Markets',items:data.markets},{title:'Commodities',items:data.commodities}].map(g=>g.items?.length>0&&(
          <Card key={g.title}>
            <SH t={g.title}/>
            {g.items.map((it,i)=>(
              <div key={i}>
                <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0'}}>
                  <span style={{color:C.text,fontSize:13}}>{it.name}</span>
                  <div style={{textAlign:'right'}}>
                    <div style={{color:C.text,fontWeight:600,fontSize:13}}>{it.value}</div>
                    <div style={{color:dir(it.direction),fontSize:11}}>{it.change}</div>
                  </div>
                </div>
                <HR i={i} n={g.items.length}/>
              </div>
            ))}
          </Card>
        ))}
        {(data.currencies?.length>0||data.bonds?.length>0)&&(
          <Card>
            <SH t="FX & Bonds"/>
            {[...(data.currencies||[]).map(c=>({label:c.pair,value:c.value,sub:c.change})),...(data.bonds||[]).map(b=>({label:b.name,value:b.yield,sub:b.change}))].map((r,i,arr)=>(
              <div key={i}>
                <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0'}}>
                  <span style={{color:C.muted,fontSize:12}}>{r.label}</span>
                  <span style={{color:C.text,fontWeight:600,fontSize:12}}>{r.value} <span style={{color:C.muted,fontSize:11}}>{r.sub}</span></span>
                </div>
                <HR i={i} n={arr.length}/>
              </div>
            ))}
          </Card>
        )}
      </div>
      {data.macroEvents?.length>0&&(
        <Card>
          <SH t="Key Events This Week"/>
          {data.macroEvents.map((e,i)=>{
            const ic=e.impact==='HIGH'?C.down:e.impact==='MEDIUM'?'#f59e0b':C.muted
            return(<div key={i}><div style={{display:'flex',gap:12,alignItems:'center',padding:'8px 0'}}><span style={{color:C.accent,fontSize:12,minWidth:90}}>{e.date}</span><span style={{color:C.text,fontSize:13,flex:1}}>{e.event}</span><Badge color={ic}>{e.impact}</Badge></div><HR i={i} n={data.macroEvents.length}/></div>)
          })}
        </Card>
      )}
    </div>
  )
}

function USView({data}) {
  const dir=d=>d==='up'?C.up:d==='down'?C.down:C.flat
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <Card>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <Badge color={data.outlook==='BULLISH'?C.up:data.outlook==='BEARISH'?C.down:C.flat}>{data.outlook||'NEUTRAL'}</Badge>
          <span style={{color:C.muted,fontSize:13}}>{data.outlookReason}</span>
        </div>
      </Card>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
        {data.futures?.length>0&&(
          <Card>
            <SH t="Futures (Live)"/>
            {data.futures.map((f,i)=>(
              <div key={i}>
                <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0'}}>
                  <span style={{color:C.text,fontSize:13}}>{f.index}</span>
                  <div style={{textAlign:'right'}}>
                    <div style={{color:C.text,fontWeight:700,fontSize:13}}>{f.value}</div>
                    <div style={{color:dir(f.direction),fontSize:11}}>{f.change}</div>
                  </div>
                </div>
                <HR i={i} n={data.futures.length}/>
              </div>
            ))}
          </Card>
        )}
        {data.gainers?.length>0&&(
          <Card>
            <SH t="Top Gainers Today"/>
            {data.gainers.map((m,i)=>(
              <div key={i}>
                <div style={{padding:'7px 0'}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:C.text,fontWeight:700,fontSize:13}}>{m.ticker}</span>
                    <span style={{color:C.up,fontWeight:700}}>{m.change}</span>
                  </div>
                  <div style={{color:C.muted,fontSize:11,marginTop:1}}>{m.company} · {m.price}</div>
                </div>
                <HR i={i} n={data.gainers.length}/>
              </div>
            ))}
          </Card>
        )}
        {data.losers?.length>0&&(
          <Card>
            <SH t="Top Losers Today"/>
            {data.losers.map((m,i)=>(
              <div key={i}>
                <div style={{padding:'7px 0'}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:C.text,fontWeight:700,fontSize:13}}>{m.ticker}</span>
                    <span style={{color:C.down,fontWeight:700}}>{m.change}</span>
                  </div>
                  <div style={{color:C.muted,fontSize:11,marginTop:1}}>{m.company} · {m.price}</div>
                </div>
                <HR i={i} n={data.losers.length}/>
              </div>
            ))}
          </Card>
        )}
      </div>
      {data.earningsThisWeek?.length>0&&(
        <Card>
          <SH t="Earnings This Week"/>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
            {data.earningsThisWeek.map((e,i)=>(
              <div key={i} style={{background:'#0a0e17',borderRadius:6,padding:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{color:C.text,fontWeight:700}}>{e.ticker}</span>
                  <span style={{color:C.accent,fontSize:12}}>{e.date}</span>
                </div>
                <div style={{color:C.muted,fontSize:11}}>{e.expectedReaction}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {data.catalysts?.length>0&&(
        <Card>
          <SH t="Key Catalysts"/>
          {data.catalysts.map((cat,i)=>{
            const ic=cat.impact==='HIGH'?C.down:cat.impact==='MEDIUM'?'#f59e0b':C.muted
            return(<div key={i}><div style={{display:'flex',gap:10,alignItems:'flex-start',padding:'7px 0'}}><Badge color={ic}>{cat.impact}</Badge><div><div style={{color:C.muted,fontSize:11}}>{cat.type}</div><div style={{color:C.text,fontSize:13}}>{cat.detail}</div></div></div><HR i={i} n={data.catalysts.length}/></div>)
          })}
        </Card>
      )}
    </div>
  )
}

function EuropeView({data}) {
  const dir=d=>d==='up'?C.up:d==='down'?C.down:C.flat
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <Card>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <Badge color={data.outlook==='BULLISH'?C.up:data.outlook==='BEARISH'?C.down:C.flat}>{data.outlook||'NEUTRAL'}</Badge>
          <span style={{color:C.muted,fontSize:13}}>{data.outlookReason}</span>
        </div>
      </Card>
      {data.indices?.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
          {data.indices.map((f,i)=>(
            <Card key={i} style={{textAlign:'center'}}>
              <div style={{color:C.muted,fontSize:11,marginBottom:6}}>{f.index}</div>
              <div style={{color:C.text,fontWeight:800,fontSize:20,marginBottom:4}}>{f.value}</div>
              <div style={{color:dir(f.direction),fontSize:13,fontWeight:600}}>{f.change}</div>
            </Card>
          ))}
        </div>
      )}
      {data.earningsThisWeek?.length>0&&(
        <Card>
          <SH t="European Earnings This Week"/>
          {data.earningsThisWeek.map((e,i)=>(
            <div key={i}><div style={{display:'flex',justifyContent:'space-between',padding:'7px 0'}}><span style={{color:C.text,fontWeight:700}}>{e.ticker}</span><span style={{color:C.muted,fontSize:12}}>{e.company}</span><span style={{color:C.accent,fontSize:12}}>{e.date}</span></div><HR i={i} n={data.earningsThisWeek.length}/></div>
          ))}
        </Card>
      )}
      {data.catalysts?.length>0&&(
        <Card>
          <SH t="European Catalysts"/>
          {data.catalysts.map((cat,i)=>{
            const ic=cat.impact==='HIGH'?C.down:cat.impact==='MEDIUM'?'#f59e0b':C.muted
            return(<div key={i}><div style={{display:'flex',gap:10,alignItems:'flex-start',padding:'7px 0'}}><Badge color={ic}>{cat.impact}</Badge><div style={{color:C.text,fontSize:13}}>{cat.detail}</div></div><HR i={i} n={data.catalysts.length}/></div>)
          })}
        </Card>
      )}
    </div>
  )
}

function OppCard({opp,onClick}) {
  const ac=opp.action==='STRONG BUY'?C.up:opp.action==='BUY'?'#4f9eff':'#f59e0b'
  const rc=opp.riskLevel==='HIGH'?C.down:opp.riskLevel==='MEDIUM'?'#f59e0b':C.up
  const bnc=opp.buyNow==='YES'?C.up:opp.buyNow==='WAIT'?'#f59e0b':C.down
  return (
    <div onClick={()=>onClick(opp)} onMouseEnter={e=>e.currentTarget.style.background='#1a2332'} onMouseLeave={e=>e.currentTarget.style.background=C.card}
      style={{background:C.card,border:`1px solid ${ac}33`,borderLeft:`3px solid ${ac}`,borderRadius:10,padding:18,cursor:'pointer',transition:'background 0.15s',position:'relative'}}>
      <span style={{position:'absolute',top:14,right:14,color:C.muted,fontSize:11}}>Click for deep dive →</span>
      <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8,marginBottom:12}}>
        <span style={{color:C.muted,fontSize:12,fontWeight:700}}>#{opp.rank}</span>
        <span style={{color:C.text,fontWeight:800,fontSize:17}}>{opp.ticker}</span>
        <span style={{color:C.muted,fontSize:12}}>{opp.company}</span>
        <Badge color={ac}>{opp.action}</Badge>
        <Badge color={rc}>{opp.riskLevel} RISK</Badge>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
        {[{label:'Live Price',value:opp.currentPrice,color:C.text},{label:'Target',value:opp.takeProfit,color:C.up},{label:'Stop Loss',value:opp.stopLoss,color:C.down},{label:'Buy Now?',value:opp.buyNow,color:bnc}].map(s=>(
          <div key={s.label} style={{background:'#0a0e17',borderRadius:6,padding:10,textAlign:'center'}}>
            <div style={{color:C.muted,fontSize:10,marginBottom:3}}>{s.label}</div>
            <div style={{color:s.color,fontWeight:700,fontSize:13}}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{color:C.muted,fontSize:12,marginBottom:4}}><span style={{color:C.accent}}>Expected: </span>{opp.expectedGain} · Confidence {opp.confidence}/10 · R/R {opp.riskReward}</div>
      <div style={{color:C.muted,fontSize:12,marginBottom:6}}><span style={{color:'#f59e0b'}}>Catalyst: </span>{opp.catalyst} · {opp.catalystDate}</div>
      <div style={{color:C.text,fontSize:12,lineHeight:1.6}}>{opp.thesis}</div>
    </div>
  )
}

function OppView({data,onStockClick}) {
  const mc={'BUY AGGRESSIVELY':C.up,'BUY SELECTIVELY':'#4f9eff',WAIT:'#f59e0b','HOLD CASH':C.down}
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <Card>
        <div style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:16}}>
          <div><div style={{color:C.muted,fontSize:11,marginBottom:4}}>MARKET CONDITION</div><Badge color={mc[data.marketCondition]||C.muted}>{data.marketCondition||'UNKNOWN'}</Badge></div>
          <div style={{textAlign:'center'}}><div style={{color:C.muted,fontSize:11,marginBottom:4}}>LIVE OPPORTUNITIES</div><div style={{color:C.accent,fontWeight:800,fontSize:28}}>{(data.opportunities||[]).length}</div></div>
          <div style={{maxWidth:300}}><div style={{color:C.muted,fontSize:11,marginBottom:4}}>CASH</div><div style={{color:C.text,fontSize:13}}>{data.cashRecommendation}</div></div>
        </div>
      </Card>
      <div style={{background:'#00d4aa11',border:'1px solid #00d4aa33',borderRadius:8,padding:'8px 14px',fontSize:12,color:C.accent}}>
        ✓ Prices sourced live from Yahoo Finance · Analysis by AI
      </div>
      {(data.opportunities||[]).length===0
        ?<Card style={{textAlign:'center',padding:40}}><div style={{color:'#f59e0b'}}>No opportunities passed all gates today. Hold cash.</div></Card>
        :(data.opportunities||[]).map((opp,i)=><OppCard key={i} opp={{...opp,rank:i+1}} onClick={onStockClick}/>)
      }
    </div>
  )
}

function CatView({data}) {
  const tc={Earnings:'#4f9eff',Contract:C.up,'Product Launch':'#a78bfa',Policy:'#f59e0b','M&A':C.accent,Government:'#f87171',Other:C.muted}
  return (
    <Card style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr>{['Date','Ticker','Company','Type','Detail','Impact','Action'].map(h=><th key={h} style={{color:C.muted,fontWeight:600,fontSize:11,textAlign:'left',padding:'8px 12px',borderBottom:`1px solid ${C.border}`,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
        <tbody>
          {(data.catalysts||[]).map((c,i)=>{
            const ic=c.expectedImpact==='HIGH'?C.down:c.expectedImpact==='MEDIUM'?'#f59e0b':C.muted
            const oc=c.opportunity==='BUY BEFORE'?C.up:c.opportunity==='WATCH'?'#f59e0b':C.muted
            return(<tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
              <td style={{padding:'10px 12px',color:C.accent,fontWeight:600,whiteSpace:'nowrap'}}>{c.date}</td>
              <td style={{padding:'10px 12px',color:C.text,fontWeight:700}}>{c.ticker}</td>
              <td style={{padding:'10px 12px',color:C.muted}}>{c.company}</td>
              <td style={{padding:'10px 12px'}}><Badge color={tc[c.type]||C.muted}>{c.type}</Badge></td>
              <td style={{padding:'10px 12px',color:C.text,maxWidth:220}}>{c.detail}</td>
              <td style={{padding:'10px 12px'}}><Badge color={ic}>{c.expectedImpact}</Badge></td>
              <td style={{padding:'10px 12px'}}><Badge color={oc}>{c.opportunity}</Badge></td>
            </tr>)
          })}
        </tbody>
      </table>
    </Card>
  )
}

function RiskView({data}) {
  const oc={HIGH:C.down,ELEVATED:'#f59e0b',MODERATE:'#4f9eff',LOW:C.up}
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <Card style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{color:C.muted,fontSize:11,marginRight:8}}>OVERALL RISK</div>
        <Badge color={oc[data.overallRisk]||C.muted}>{data.overallRisk||'UNKNOWN'}</Badge>
      </Card>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
        {[{title:'Macro Risks',items:data.macroRisks},{title:'Geopolitical',items:data.geopoliticalRisks},{title:'Sector Risks',items:data.sectorRisks}].filter(g=>g.items?.length>0).map(g=>(
          <Card key={g.title}>
            <SH t={g.title}/>
            {g.items.map((it,i)=>{
              const sc=it.severity==='HIGH'?C.down:it.severity==='MEDIUM'?'#f59e0b':C.muted
              return(<div key={i}><div style={{padding:'8px 0'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{color:C.text,fontSize:13,fontWeight:600}}>{it.risk||it.sector}</span><Badge color={sc}>{it.severity}</Badge></div><div style={{color:C.muted,fontSize:12}}>{it.detail||it.risk}</div></div><HR i={i} n={g.items.length}/></div>)
            })}
          </Card>
        ))}
      </div>
      {data.hedgeIdeas?.length>0&&<Card><SH t="Hedge Ideas"/>{data.hedgeIdeas.map((h,i)=><div key={i} style={{padding:'5px 0',color:C.text,fontSize:13,borderBottom:i<data.hedgeIdeas.length-1?`1px solid ${C.border}`:'none'}}>· {h}</div>)}</Card>}
    </div>
  )
}

function DeepModal({opp,onClose,onRefresh,loading,content}) {
  const ac=opp.action==='STRONG BUY'?C.up:'#4f9eff'
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'#000000cc',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,width:'100%',maxWidth:820,maxHeight:'90vh',overflow:'auto',padding:28}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:10}}>
            <span style={{color:C.text,fontWeight:800,fontSize:22}}>{opp.ticker}</span>
            <span style={{color:C.muted,fontSize:14}}>{opp.company}</span>
            <Badge color={ac}>{opp.action}</Badge>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10,marginBottom:20}}>
          {[{label:'Live Price',value:opp.currentPrice,color:C.text},{label:'Entry Zone',value:opp.entryZone,color:'#4f9eff'},{label:'Stop Loss',value:opp.stopLoss,color:C.down},{label:'Target',value:opp.takeProfit,color:C.up},{label:'Allocation',value:opp.allocation,color:C.accent},{label:'R/R',value:opp.riskReward,color:'#4f9eff'}].map(s=>(
            <div key={s.label} style={{background:'#0a0e17',borderRadius:8,padding:12,textAlign:'center'}}>
              <div style={{color:C.muted,fontSize:10,marginBottom:3}}>{s.label}</div>
              <div style={{color:s.color,fontWeight:700,fontSize:14}}>{s.value}</div>
            </div>
          ))}
        </div>
        <Card style={{marginBottom:12}}><SH t="Thesis"/><div style={{color:C.text,fontSize:14,lineHeight:1.7}}>{opp.thesis}</div></Card>
        <Card style={{marginBottom:12}}><SH t="Catalyst"/><div style={{color:C.accent,fontSize:14,fontWeight:600}}>{opp.catalyst}</div><div style={{color:C.muted,fontSize:13,marginTop:4}}>Expected: {opp.catalystDate}</div></Card>
        <Card style={{marginBottom:16,borderColor:C.down+'44'}}><SH t="⚠ What Would Change My Mind"/><div style={{color:C.text,fontSize:13,lineHeight:1.6}}>{opp.invalidation}</div></Card>
        {loading?<div style={{textAlign:'center',padding:30}}><Spinner/><div style={{color:C.muted,fontSize:13,marginTop:8}}>Analysing {opp.ticker}…</div></div>:content&&<Card><SH t="Deep Dive Analysis"/><div style={{color:C.text,fontSize:13,lineHeight:1.8,whiteSpace:'pre-wrap'}}>{content}</div></Card>}
        {!loading&&<div style={{marginTop:16}}><RefreshBtn onClick={onRefresh} loading={loading}/></div>}
      </div>
    </div>
  )
}

// ── Data fetching ─────────────────────────────────────────────────────────────
const TABS = {
  opportunities: { label:'🔥 Top Opportunities', color:'#f59e0b' },
  global:        { label:'🌍 Global Overview',   color:'#00d4aa' },
  us:            { label:'🇺🇸 US Pre-Market',    color:'#4f9eff' },
  europe:        { label:'🇪🇺 Europe Pre-Market', color:'#a78bfa' },
  catalysts:     { label:'📅 Catalyst Calendar',  color:'#34d399' },
  risk:          { label:'⚠️ Risk Dashboard',     color:'#f87171' },
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('opportunities')
  const [sectionData, setSectionData] = useState({})
  const [loadStep, setLoadStep] = useState({})   // 0=fetching market, 1=analysing, -1=done
  const [errors, setErrors] = useState({})
  const [selectedStock, setSelectedStock] = useState(null)
  const [drillContent, setDrillContent] = useState(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState({})

  const callClaude = useCallback(async (prompt, mode='section') => {
    const res = await fetch('/api/claude', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ prompt, mode })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error||`Claude error ${res.status}`)
    const tb = data.content?.find(b=>b.type==='text')
    if (!tb) throw new Error('No response from AI')
    return tb.text
  }, [])

  const fetchMarket = useCallback(async (type) => {
    const res = await fetch(`/api/market?type=${type}`, { cache:'no-store' })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error||`Market data error ${res.status}`)
    }
    return res.json()
  }, [])

  const loadGlobal = useCallback(async () => {
    setLoadStep(p=>({...p,global:0})); setErrors(p=>({...p,global:null}))
    try {
      const market = await fetchMarket('global')
      setLoadStep(p=>({...p,global:1}))
      const summary = `Real market data right now:
Markets: ${market.markets?.map(m=>`${m.name} ${m.value} (${m.change})`).join(', ')}
Commodities: ${market.commodities?.map(c=>`${c.name} ${c.value} (${c.change})`).join(', ')}
FX: ${market.currencies?.map(c=>`${c.pair} ${c.value} ${c.change}`).join(', ')}
Bonds: ${market.bonds?.map(b=>`${b.name} ${b.yield} ${b.change}`).join(', ')}

Based on this real data, provide: {"sentiment":"RISK ON/OFF/NEUTRAL","sentimentReason":"one sentence based on the real data above","macroEvents":[{"date":"this week","event":"key event","impact":"HIGH/MEDIUM/LOW"}]}
Return 3 macro events you know are happening this week. JSON only.`

      const aiText = await callClaude(summary)
      const ai = repairJSON(aiText)
      setSectionData(p=>({...p, global:{...market, ...ai}}))
      setLastUpdated(p=>({...p, global:new Date().toLocaleTimeString()}))
    } catch(err) { setErrors(p=>({...p,global:err.message}))
    } finally { setLoadStep(p=>({...p,global:-1})) }
  }, [fetchMarket, callClaude])

  const loadUS = useCallback(async () => {
    setLoadStep(p=>({...p,us:0})); setErrors(p=>({...p,us:null}))
    try {
      const market = await fetchMarket('us')
      setLoadStep(p=>({...p,us:1}))
      const summary = `Real US market data:
Futures: ${market.futures?.map(f=>`${f.index} ${f.value} (${f.change})`).join(', ')}
Top gainers: ${market.gainers?.map(g=>`${g.ticker} ${g.change}`).join(', ')}
Top losers: ${market.losers?.map(l=>`${l.ticker} ${l.change}`).join(', ')}

Based on this real data, return JSON: {"outlook":"BULLISH/BEARISH/NEUTRAL","outlookReason":"based on real data","earningsThisWeek":[{"ticker":"","company":"","date":"","expectedReaction":""}],"catalysts":[{"type":"","detail":"","impact":"HIGH/MEDIUM/LOW"}],"sectorLeaders":[],"sectorLaggards":[]}
List 3 real earnings this week and 2 catalysts. JSON only.`

      const aiText = await callClaude(summary)
      const ai = repairJSON(aiText)
      setSectionData(p=>({...p, us:{...market, ...ai}}))
      setLastUpdated(p=>({...p, us:new Date().toLocaleTimeString()}))
    } catch(err) { setErrors(p=>({...p,us:err.message}))
    } finally { setLoadStep(p=>({...p,us:-1})) }
  }, [fetchMarket, callClaude])

  const loadEurope = useCallback(async () => {
    setLoadStep(p=>({...p,europe:0})); setErrors(p=>({...p,europe:null}))
    try {
      const market = await fetchMarket('europe')
      setLoadStep(p=>({...p,europe:1}))
      const summary = `Real European market data:
Indices: ${market.futures?.map(f=>`${f.index} ${f.value} (${f.change})`).join(', ')}

Based on this real data return JSON: {"outlook":"BULLISH/BEARISH/NEUTRAL","outlookReason":"based on real index levels","indices":${JSON.stringify(market.futures||[])},"earningsThisWeek":[{"ticker":"","company":"","date":"","expectedReaction":""}],"catalysts":[{"type":"","detail":"","impact":"HIGH/MEDIUM/LOW"}]}
List 2 European earnings this week and 2 catalysts. JSON only.`

      const aiText = await callClaude(summary)
      const ai = repairJSON(aiText)
      setSectionData(p=>({...p, europe:{...market, ...ai}}))
      setLastUpdated(p=>({...p, europe:new Date().toLocaleTimeString()}))
    } catch(err) { setErrors(p=>({...p,europe:err.message}))
    } finally { setLoadStep(p=>({...p,europe:-1})) }
  }, [fetchMarket, callClaude])

  const loadOpportunities = useCallback(async () => {
    setLoadStep(p=>({...p,opportunities:0})); setErrors(p=>({...p,opportunities:null}))
    try {
      const market = await fetchMarket('opportunities')
      setLoadStep(p=>({...p,opportunities:1}))
      const stockList = market.stocks?.map(s=>`${s.ticker}: ${s.price} (${s.change1d} today, mktcap ${s.marketCap})`).join('\n')

      const prompt = `Today's live prices from Yahoo Finance for our research universe:
${stockList}

Today's date: ${new Date().toDateString()}

Based on these REAL current prices, identify the top 3 stocks with the strongest catalyst setup for 15%+ gains in the next 40 days. Use your knowledge of their upcoming earnings, contracts, product launches, and catalysts.

Return JSON only:
{"marketCondition":"BUY AGGRESSIVELY/BUY SELECTIVELY/WAIT/HOLD CASH","cashRecommendation":"","opportunities":[{"ticker":"","company":"","action":"STRONG BUY/BUY/WATCH","currentPrice":"use real price above","entryZone":"","stopLoss":"","takeProfit":"","expectedGain":"","confidence":7,"riskLevel":"LOW/MEDIUM/HIGH","catalyst":"specific named catalyst","catalystDate":"","riskReward":"3:1","allocation":"10%","buyNow":"YES/NO/WAIT","thesis":"1-2 sentences based on real price","invalidation":"what would change the thesis"}]}`

      const aiText = await callClaude(prompt)
      const ai = repairJSON(aiText)
      setSectionData(p=>({...p, opportunities:ai}))
      setLastUpdated(p=>({...p, opportunities:new Date().toLocaleTimeString()}))
    } catch(err) { setErrors(p=>({...p,opportunities:err.message}))
    } finally { setLoadStep(p=>({...p,opportunities:-1})) }
  }, [fetchMarket, callClaude])

  const loadCatalysts = useCallback(async () => {
    setLoadStep(p=>({...p,catalysts:1})); setErrors(p=>({...p,catalysts:null}))
    try {
      const prompt = `Today is ${new Date().toDateString()}. List 6 specific upcoming market catalysts in the next 40 days that swing traders should watch. Focus on AI, semiconductors, defence, energy. Use your knowledge of real scheduled events.
JSON only: {"catalysts":[{"date":"exact date","ticker":"","company":"","type":"Earnings/Contract/Product Launch/Policy/M&A/Government","detail":"specific detail","expectedImpact":"HIGH/MEDIUM/LOW","opportunity":"BUY BEFORE/WATCH/AVOID"}]}`
      const aiText = await callClaude(prompt)
      const ai = repairJSON(aiText)
      setSectionData(p=>({...p, catalysts:ai}))
      setLastUpdated(p=>({...p, catalysts:new Date().toLocaleTimeString()}))
    } catch(err) { setErrors(p=>({...p,catalysts:err.message}))
    } finally { setLoadStep(p=>({...p,catalysts:-1})) }
  }, [callClaude])

  const loadRisk = useCallback(async () => {
    setLoadStep(p=>({...p,risk:1})); setErrors(p=>({...p,risk:null}))
    try {
      const prompt = `Today is ${new Date().toDateString()}. Assess current market risks for a swing trader.
JSON only: {"overallRisk":"HIGH/ELEVATED/MODERATE/LOW","macroRisks":[{"risk":"","detail":"","severity":"HIGH/MEDIUM/LOW"}],"geopoliticalRisks":[{"risk":"","detail":"","severity":"HIGH/MEDIUM/LOW"}],"sectorRisks":[{"sector":"","risk":"","severity":"HIGH/MEDIUM/LOW"}],"hedgeIdeas":[""]}
Max 3 items per array.`
      const aiText = await callClaude(prompt)
      const ai = repairJSON(aiText)
      setSectionData(p=>({...p, risk:ai}))
      setLastUpdated(p=>({...p, risk:new Date().toLocaleTimeString()}))
    } catch(err) { setErrors(p=>({...p,risk:err.message}))
    } finally { setLoadStep(p=>({...p,risk:-1})) }
  }, [callClaude])

  const loaders = { global:loadGlobal, us:loadUS, europe:loadEurope, opportunities:loadOpportunities, catalysts:loadCatalysts, risk:loadRisk }

  const fetchDeepDive = useCallback(async (opp) => {
    setDrillLoading(true); setDrillContent(null)
    try {
      const text = await callClaude(
        `Today is ${new Date().toDateString()}. Analyse ${opp.ticker} (${opp.company}) currently priced at ${opp.currentPrice}. Cover: recent news, upcoming catalyst (${opp.catalyst}), analyst consensus, key risks, technical setup. Under 200 words. Mark each point FACT or ANALYSIS.`,
        'deepdive'
      )
      setDrillContent(text)
    } catch(err) { setDrillContent('Error: '+err.message) }
    finally { setDrillLoading(false) }
  }, [callClaude])

  const handleStockClick = useCallback((opp) => {
    setSelectedStock(opp); setDrillContent(null); fetchDeepDive(opp)
  }, [fetchDeepDive])

  const isLoading = (key) => loadStep[key] === 0 || loadStep[key] === 1

  const renderContent = () => {
    const key = activeTab
    const data = sectionData[key]
    const err = errors[key]
    const step = loadStep[key]

    if (step === 0 || step === 1) return <StatusBadge step={step}/>
    if (err) return <ErrorState error={err} onRetry={()=>loaders[key]?.()}/>
    if (!data) return <EmptyState label={TABS[key].label} color={TABS[key].color} onLoad={()=>loaders[key]?.()}/>

    if (key==='global') return <GlobalView data={data}/>
    if (key==='us') return <USView data={data}/>
    if (key==='europe') return <EuropeView data={data}/>
    if (key==='opportunities') return <OppView data={data} onStockClick={handleStockClick}/>
    if (key==='catalysts') return <CatView data={data}/>
    if (key==='risk') return <RiskView data={data}/>
    return null
  }

  return (
    <div style={{background:C.bg,minHeight:'100vh',fontFamily:"'IBM Plex Mono','Courier New',monospace",color:C.text}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}*{box-sizing:border-box}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:#0a0e17}::-webkit-scrollbar-thumb{background:#1f2937;border-radius:3px}`}</style>
      <div style={{background:'#111827',borderBottom:`1px solid ${C.border}`,padding:'14px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{color:C.accent,fontWeight:800,fontSize:16,letterSpacing:1}}>⬡ CATALYST</span>
          <span style={{color:C.muted,fontSize:11}}>TRADING INTELLIGENCE · LIVE DATA</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          {lastUpdated[activeTab]&&<span style={{color:C.muted,fontSize:11}}>Updated {lastUpdated[activeTab]}</span>}
          <RefreshBtn onClick={()=>loaders[activeTab]?.()} loading={isLoading(activeTab)}/>
        </div>
      </div>
      <div style={{display:'flex',gap:2,padding:'16px 24px 0',overflowX:'auto'}}>
        {Object.entries(TABS).map(([key,tab])=>(
          <button key={key} onClick={()=>setActiveTab(key)} style={{background:activeTab===key?tab.color+'22':'transparent',border:`1px solid ${activeTab===key?tab.color+'88':C.border}`,borderBottom:'none',color:activeTab===key?tab.color:C.muted,padding:'10px 18px',cursor:'pointer',fontSize:12,fontWeight:activeTab===key?700:500,borderRadius:'8px 8px 0 0',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}>
            {tab.label}
            {isLoading(key)&&<Spinner color={tab.color}/>}
            {sectionData[key]&&!isLoading(key)&&<span style={{background:tab.color+'33',color:tab.color,borderRadius:10,padding:'1px 6px',fontSize:10}}>✓</span>}
          </button>
        ))}
      </div>
      <div style={{padding:24,borderTop:`1px solid ${C.border}`}}>{renderContent()}</div>
      {selectedStock&&<DeepModal opp={selectedStock} onClose={()=>{setSelectedStock(null);setDrillContent(null)}} onRefresh={()=>fetchDeepDive(selectedStock)} loading={drillLoading} content={drillContent}/>}
    </div>
  )
}
