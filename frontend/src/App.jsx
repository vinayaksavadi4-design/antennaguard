import { Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'

function Brand() {
  return <div className="brand"><div className="brand-mark">AG</div><span>Antenna<span>Guard</span></span></div>
}

function Protected() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="loader" /><span>Loading AntennaGuard…</span></div>
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function Layout() {
  const { user, signOut } = useAuth()
  const nav = useNavigate()
  const [health, setHealth] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => { api.health().then(setHealth).catch(() => setHealth(null)) }, [])

  function logout() { signOut(); nav('/login') }
  const links = [['/dashboard', 'Dashboard'], ['/predict', 'Analyze net'], ['/batch', 'Batch import'], ['/validation', 'Validation'], ['/verification', 'EDA Verification'], ['/history', 'History'], ['/workflow', 'Workflow']]

  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-brand"><Brand /><button onClick={() => setOpen(false)} className="mobile-only close">×</button></div>
      <div className="workspace"><div className="workspace-dot">V</div><div><small>WORKSPACE</small><strong>VLSI Research</strong></div></div>
      <nav>{links.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({isActive}) => isActive ? 'active' : ''}>{label}</NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="user-box"><div className="avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div><div><strong>{user?.name}</strong><span>{user?.email}</span></div></div><button className="ghost-btn" onClick={logout}>Sign out</button></div>
    </aside>
    {open && <button className="backdrop" onClick={() => setOpen(false)} aria-label="Close menu" />}
    <main className="main-area">
      <header className="topbar"><button className="mobile-only menu" onClick={() => setOpen(true)}>☰</button><div className="topbar-spacer" /><div className={`status ${health ? 'online' : 'offline'}`}><i /> {health ? 'ML engine ready' : 'API offline'}</div><div className="avatar small">{user?.name?.[0]?.toUpperCase() || 'U'}</div></header>
      <div className="content"><Outlet /></div>
    </main>
  </div>
}

function AuthShell({ title, subtitle, children }) {
  return <div className="auth-page"><div className="auth-art"><Brand /><div className="art-copy"><div className="eyebrow cyan">VLSI DESIGN INTELLIGENCE</div><h1>Catch antenna-risk signals before late-stage DRC.</h1><p>Run an ML-assisted check from six physical-design features, then turn the score into practical review guidance.</p><div className="art-card"><span className="pulse" /> Model workflow online</div></div></div><div className="auth-side"><div className="auth-card"><div className="mobile-brand"><Brand /></div><div className="eyebrow">SECURE WORKSPACE</div><h2>{title}</h2><p>{subtitle}</p>{children}</div></div></div>
}

function Login() {
  const { signIn } = useAuth(); const nav = useNavigate(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false)
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{await signIn(email,password);nav('/dashboard')}catch(err){setError(err.message)}finally{setBusy(false)}}
  return <AuthShell title="Welcome back" subtitle="Sign in to your AntennaGuard workspace."><form className="form" onSubmit={submit}>{error&&<div className="alert error">{error}</div>}<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="current-password" minLength="8" required /></label><button className="primary" disabled={busy}>{busy?'Signing in…':'Sign in'} →</button><p className="switch">New to AntennaGuard? <Link to="/register">Create an account</Link></p></form></AuthShell>
}

function Register() {
  const { signUp } = useAuth(); const nav = useNavigate(); const [form,setForm]=useState({name:'',email:'',password:''}); const [error,setError]=useState(''); const [busy,setBusy]=useState(false)
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{await signUp(form.name,form.email,form.password);nav('/dashboard')}catch(err){setError(err.message)}finally{setBusy(false)}}
  return <AuthShell title="Create your workspace" subtitle="Set up an account for your VLSI research project."><form className="form" onSubmit={submit}>{error&&<div className="alert error">{error}</div>}<label>Full name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name" minLength="2" required /></label><label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com" required /></label><label>Password<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters" minLength="8" required /></label><button className="primary" disabled={busy}>{busy?'Creating…':'Create account'} →</button><p className="switch">Already have an account? <Link to="/login">Sign in</Link></p></form></AuthShell>
}

function Dashboard(){
  const { user }=useAuth()
  const [stats,setStats]=useState({total:0,high:0,medium:0,low:0,average_probability:0})
  const [health,setHealth]=useState(null)
  const [modelInfo,setModelInfo]=useState(null)
  const [edaRecords,setEdaRecords]=useState([])
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  async function load(){
    setLoading(true);setError('')
    const results=await Promise.allSettled([api.stats(),api.health(),api.modelInfo(),api.edaRecords(500)])
    if(results[0].status==='fulfilled')setStats(results[0].value)
    else setError(results[0].reason.message)
    setHealth(results[1].status==='fulfilled'?results[1].value:null)
    setModelInfo(results[2].status==='fulfilled'?results[2].value:null)
    setEdaRecords(results[3].status==='fulfilled'?results[3].value:[])
    setLoading(false)
  }
  useEffect(()=>{load()},[])
  const ready=Boolean(health && (health.model_ready || health.status==='ok'))
  const labelled=edaRecords.filter(r=>r.verified_violation===true||r.verified_violation===false).length
  const realLabelPercent=labelled>0?100:0
  const readiness=[
    ['API',health?100:0,health?'Online':'Offline'],
    ['Model',modelInfo?100:0,modelInfo?'Loaded':'Unknown'],
    ['Real labels',realLabelPercent,labelled?`${labelled} labelled`:'Not imported'],
    ['EDA export',edaRecords.length?100:0,edaRecords.length?`${edaRecords.length} records`:'Not connected'],
  ]
  return <Page title={`Good to see you, ${user?.name?.split(' ')[0] || 'there'}.`} eyebrow="ANTENNA-RULE RISK SCREENING" description="A validation-first workspace for machine-learning-assisted antenna-risk triage across routed nets." action={<><button className="secondary" onClick={load} disabled={loading}>{loading?'Refreshing…':'Refresh status'}</button> <NavLink className="primary" to="/predict">＋ Analyze a net</NavLink></>}>
    {error&&<div className="alert error">Could not load personal prediction statistics: {error}</div>}
    <div className="stats overview-stats">
      <Stat label="Backend status" value={health?'Online':'Offline'} sub={health?.service||'Connect to local API'} tone={health?'':'red'}/>
      <Stat label="Model availability" value={modelInfo?'Loaded':'Unknown'} sub={modelInfo?.version||'Waiting for model metadata'} tone={modelInfo?'blue':'amber'}/>
      <Stat label="Validation report" value={modelInfo?.validation_metrics?'Available':'Not found'} sub={modelInfo?.validation_method||'Metrics load from model evaluation'} tone={modelInfo?.validation_metrics?'':'amber'}/>
      <Stat label="Prediction status" value="Advisory only" sub="Sign-off antenna DRC remains authoritative" tone="amber"/>
    </div>
    <div className="stats">
      <Stat label="Saved predictions" value={stats.total} sub="Checks in your account"/>
      <Stat label="High risk" value={stats.high} sub="Prioritize review" tone="red"/>
      <Stat label="Medium risk" value={stats.medium} sub="Monitor closely" tone="amber"/>
      <Stat label="Average model score" value={`${Math.round(stats.average_probability*100)}%`} sub="Across saved runs; not calibrated" tone="blue"/>
    </div>
    <div className="grid two">
      <section className="panel hero"><div className="eyebrow">RECOMMENDED SCREENING WORKFLOW</div><h2>Design with more visibility.</h2><p>Extract consistent net features, screen with a compatible trained model, prioritize engineering review, and confirm the design with the appropriate antenna checker.</p><div className="chip-row"><span>ML risk screening</span><span>Batch CSV import</span><span>Verified EDA loop</span></div><div className="quick-actions"><NavLink className="primary" to="/predict">Analyze a net →</NavLink><NavLink className="secondary" to="/batch">Import multiple nets</NavLink></div></section>
      <section className="panel readiness-panel"><div className="records-heading"><div><div className="eyebrow">PROJECT READINESS</div><h2>Service and evidence status</h2></div><span className={`risk-tag ${ready?'low':'medium'}`}>{ready?'API responding':'Needs setup'}</span></div><div className="readiness-list">{readiness.map(([label,percent,status])=><div className="readiness-row" key={label}><span>{label}</span><div className="readiness-track"><i style={{width:`${percent}%`}} /></div><b>{status}</b></div>)}</div><div className="verification-boundary"><strong>Model scope warning</strong><p>{modelInfo?.data_note||'Model metadata is not available until the backend is running.'} A class score or tree-vote agreement is not calibrated confidence and does not prove a foundry violation.</p></div></section>
    </div>
    <div className="grid two dashboard-lower">
      <section className="panel"><div className="eyebrow">FOUR-STAGE REVIEW</div><h2>From features to sign-off evidence</h2><div className="workflow"><div><b>01</b><span><strong>Extract net features</strong><small>Preserve units, design ID, net ID and source report.</small></span></div><div><b>02</b><span><strong>Screen with the trained model</strong><small>Use the matching feature order and process context.</small></span></div><div><b>03</b><span><strong>Review risky nets</strong><small>Inspect geometry and route context before proposing a correction.</small></span></div><div><b>04</b><span><strong>Run official antenna DRC</strong><small>Record the tool, rule deck, result and exact feature snapshot.</small></span></div></div></section>
      <section className="panel"><div className="eyebrow">QUICK ACCESS</div><h2>Continue your workflow</h2><div className="quick-link-list"><NavLink to="/batch"><span><b>Batch import</b><small>Evaluate a CSV of per-net features</small></span><strong>→</strong></NavLink><NavLink to="/validation"><span><b>Validation report</b><small>Metrics, confusion matrix and feature importance</small></span><strong>→</strong></NavLink><NavLink to="/verification"><span><b>EDA verification</b><small>Import labels and record actual checker results</small></span><strong>→</strong></NavLink><NavLink to="/workflow"><span><b>Workflow guide</b><small>Data schema, local setup and limitations</small></span><strong>→</strong></NavLink></div></section>
    </div>
  </Page>
}
function Stat({label,value,sub,tone=''}){return <div className="stat"><div className={`stat-accent ${tone}`} /><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>}
function Page({eyebrow,title,description,action,children}){return <div className="page"><div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>{children}</div>}

function Predict(){
  const [form,setForm]=useState({metal_area:51,gate_area:8,wire_length:236,layer_count:3,metal_width:0.45,spacing:0.18})
  const [result,setResult]=useState(null)
  const [batchResults,setBatchResults]=useState([])
  const [resultSource,setResultSource]=useState('preview')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [previewBusy,setPreviewBusy]=useState(true)
  const [csvBusy,setCsvBusy]=useState(false)
  const [modelInfo,setModelInfo]=useState(null)
  const [baseline,setBaseline]=useState(null)
  const [compareBusy,setCompareBusy]=useState(false)
  const [serverComparison,setServerComparison]=useState(null)
  const [compareError,setCompareError]=useState('')
  const previewRequest=useRef(0)

  useEffect(()=>{api.modelInfo().then(setModelInfo).catch(()=>{})},[])

  const fields=[
    ['metal_area','Metal area','Metal area connected to the gate',0.001,10000,'µm²'],
    ['gate_area','Gate area','Effective gate-connected area',0.001,10000,'µm²'],
    ['wire_length','Wire length','Approximate exposed interconnect length',0.001,100000,'µm'],
    ['layer_count','Layer count','Metal routing layers involved',1,50,'layers'],
    ['metal_width','Metal width','Physical metal width',0.001,100,'µm'],
    ['spacing','Spacing','Physical minimum spacing',0.001,100,'µm'],
  ]
  const validValues = values => fields.every(([key,, ,min,max])=>{
    const value=Number(values[key])
    return values[key]!=='' && Number.isFinite(value) && value>=min && value<=max && (key!=='layer_count'||Number.isInteger(value))
  })
  function update(k,v){
    const number = v === '' ? '' : (k==='layer_count' ? Math.trunc(Number(v)) : Number(v))
    setForm(current=>({...current,[k]:number}))
    setBatchResults([]);setResultSource('preview');setError('');setPreviewBusy(true)
  }

  // Live previews call the real authenticated API and do not create history rows.
  useEffect(()=>{
    const requestId=++previewRequest.current
    if(!validValues(form)){setPreviewBusy(false);setResult(null);return undefined}
    const input={...form}
    const timer=setTimeout(async()=>{
      setPreviewBusy(true)
      try{
        const data=await api.preview(input)
        if(requestId===previewRequest.current){setResult(data);setResultSource('preview');setError('')}
      }catch(err){
        if(requestId===previewRequest.current){setResult(null);setError(err.status===401?'Your session expired. Sign in again.':`Live prediction failed: ${err.message}`)}
      }finally{if(requestId===previewRequest.current)setPreviewBusy(false)}
    },400)
    return ()=>{clearTimeout(timer);previewRequest.current++}
  },[form])

  async function submit(e){
    e.preventDefault()
    if(!validValues(form))return
    previewRequest.current++;setBusy(true);setPreviewBusy(false);setError('');setBatchResults([])
    try{const saved=await api.predict(form);setResult(saved);setResultSource('saved')}
    catch(err){setError(err.status===401?'Your session expired. Sign in again.':err.message)}
    finally{setBusy(false)}
  }
  async function compareBaseline(){
    if(!baseline || !validValues(form))return
    setCompareBusy(true);setCompareError('');setServerComparison(null)
    try { setServerComparison(await api.compare({baseline:baseline.form,revised:{...form}})) }
    catch(err) { setCompareError(`Comparison failed: ${err.message}`) }
    finally { setCompareBusy(false) }
  }
  async function repredict(){
    if(!validValues(form))return
    const requestId=++previewRequest.current;setPreviewBusy(true);setError('')
    try{const data=await api.preview({...form});if(requestId===previewRequest.current){setResult(data);setResultSource('preview')}}
    catch(err){setError(`Re-prediction failed: ${err.message}`)}
    finally{if(requestId===previewRequest.current)setPreviewBusy(false)}
  }
  async function upload(e){
    const f=e.target.files?.[0];if(!f)return
    previewRequest.current++;setCsvBusy(true);setError('');setResult(null);setBatchResults([])
    try{const data=await api.batch(f);setBatchResults(data.items||[]);setResult(data.items?.[0]||null);setResultSource('saved');if(!data.items?.length)setError('The CSV returned no prediction rows.')}
    catch(err){setError(err.message)}
    finally{setCsvBusy(false);e.target.value=''}
  }
  function demo(){
    setForm({metal_area:82,gate_area:7,wire_length:420,layer_count:6,metal_width:0.7,spacing:0.08})
    setBatchResults([]);setResultSource('preview');setError('');setPreviewBusy(true)
  }
  const inputValid=validValues(form)
  const probability = result && Number.isFinite(Number(result.probability)) ? Math.max(0,Math.min(1,Number(result.probability))) : null
  const risk = (result?.severity||'LOW').toLowerCase()
  const improvements = risk==='high' ? [
    ['Review exposed conductor','Inspect metal area and wire length on the flagged net; reduce unnecessary exposed conductor where routing constraints allow.'],
    ['Evaluate a layer jumper','Ask the physical-design flow whether a permitted layer transition can reduce the relevant antenna ratio.'],
    ['Check approved protection','Evaluate a foundry-approved antenna diode or protection strategy only if supported by the target PDK.']
  ] : risk==='medium' ? [
    ['Inspect layer transitions','Review the affected route and antenna metrics against layer-specific limits in the technology rule deck.'],
    ['Review geometry','Check metal area, gate area and wire length together; avoid changing one feature without validating the complete net.'],
    ['Confirm with DRC','Run the technology-specific antenna checker before accepting the layout.']
  ] : [
    ['Keep normal verification','A lower model estimate does not prove compliance; run the official antenna and DRC checks.'],
    ['Keep route data traceable','Record the layer, net and rule-deck version with the verified result.']
  ]

  return <Page eyebrow="PREDICTION LAB" title="Antenna risk assessment" description="Run the existing ML model on physical-design features, inspect the risk signal and compare revised inputs." action={<button className="secondary" onClick={demo}>Load demo case</button>}>
    <div className="grid two predict">
      <section className="panel">
        <div className="eyebrow">DESIGN INPUTS</div><h2>Physical-design parameters</h2>
        <p className="field-hint">Change a measurement to request a live preview. Units are shown beside each field.</p>
        <form className="form predict-form" onSubmit={submit}>
          {fields.map(([k,l,h,min,max,unit])=><label key={k}>{l}<small>{h}</small><div className="input-unit"><input type="number" min={min} max={max} step={k==='layer_count'?'1':'any'} value={form[k]} onChange={e=>update(k,e.target.value)} required/><span>{unit}</span></div></label>)}
          {!inputValid&&<div className="alert error">Enter valid positive values within the displayed limits. Layer count must be a whole number.</div>}
          {error&&<div className="alert error">{error}</div>}
          <button className="primary" disabled={busy||!inputValid}>{busy?'Saving…':'Run & save prediction'} →</button>
          <button className="secondary" type="button" disabled={!inputValid||previewBusy} onClick={repredict}>{previewBusy?'Updating prediction…':'Re-predict current values'}</button>
        </form>
        <div className="csv"><div className="divider">OR</div><label className="upload"><span>{csvBusy?'Processing CSV…':'Batch prediction with CSV'}</span><small>Required columns: metal_area, gate_area, wire_length, layer_count, metal_width, spacing</small><input type="file" accept=".csv" hidden onChange={upload}/></label></div>
      </section>
      <section className="panel result">
        <div className="eyebrow">MODEL OUTPUT · {resultSource==='saved'?'SAVED TO HISTORY':'LIVE PREVIEW · NOT SAVED'}</div><h2>Risk assessment</h2>
        {batchResults.length>0?<div className="batch-results"><div className="batch-summary"><strong>{batchResults.length} CSV predictions completed</strong><span>All rows are saved to History.</span></div><div className="table-wrap"><table><thead><tr><th>Row</th><th>Risk</th><th>Severity</th><th>Violation</th><th>Metal area (µm²)</th><th>Gate area (µm²)</th><th>Wire length (µm)</th><th>Layers</th><th>Guidance</th></tr></thead><tbody>{batchResults.map((item,index)=><tr key={item.id??index}><td>{index+1}</td><td><b>{Math.round(Number(item.probability)*100)}%</b></td><td><span className={`risk-tag ${(item.severity||'low').toLowerCase()}`}>{item.severity||'UNKNOWN'}</span></td><td>{item.violation?'Yes':'No'}</td><td>{item.metal_area} µm²</td><td>{item.gate_area} µm²</td><td>{item.wire_length} µm</td><td>{item.layer_count} layers</td><td>{item.recommendation}</td></tr>)}</tbody></table></div><button className="secondary" type="button" onClick={()=>{setBatchResults([]);setResult(null);setResultSource('preview');setPreviewBusy(true)}}>Back to live prediction</button></div>
        :!result?<div className="empty"><div className="orb">AG</div><h3>{previewBusy?'Updating prediction…':'Waiting for valid inputs'}</h3><p>{previewBusy?'Evaluating current values using the ML API.':'Adjust the six values to generate a live preview.'}</p></div>
        :<div className="risk-content">
          <div className={`risk-alert ${risk}`}><div><span className="risk-kicker">{result.violation?'RISK FLAGGED':'NO HIGH-RISK FLAG'}</span><h3>{result.violation?`${result.severity} risk detected`:`${result.severity} risk estimate`}</h3><p>{result.violation?'Review the following items before physical verification.':'The model estimates lower risk for these features; verification is still required.'}</p></div><div className="risk-score"><strong>{Math.round(probability*100)}%</strong><span>uncalibrated model score</span></div></div>
          <div className="risk-meter"><div style={{width:`${probability*100}%`}} className={risk}/></div>
          <section className="diagnostic-card"><div className="diagnostic-heading"><div><div className="eyebrow">MODEL DIAGNOSTICS</div><h3>How to interpret this result</h3></div><div className="agreement"><strong>{Math.round(Number(result.tree_vote_agreement||0)*100)}%</strong><span>tree vote agreement</span></div></div><p className="field-hint">Tree vote agreement measures how many trees agree with the predicted class. It is not calibrated confidence and does not mean the same percentage chance of a real antenna violation.</p>
            {result.out_of_training_range?.length>0&&<div className="alert warning"><b>Outside training range:</b> {result.out_of_training_range.join(', ')}. Treat this score as an extrapolation and do not rely on it without verification.</div>}
            <strong className="diagnostic-label">Input indicators from the synthetic model</strong><ul className="indicator-list">{(result.input_indicators||[]).map((item,index)=><li key={index}>{item}</li>)}</ul>
            <p className="diagnostic-footnote">These indicators describe input positions within a synthetic demonstration model's range. They are not causal explanations from a foundry rule deck.</p>
          </section>
          <div className="result-actions"><button className="secondary" type="button" onClick={()=>{setBaseline({form:{...form},result:{...result}});setServerComparison(null);setCompareError('')}}>Use current result as baseline</button><span>{resultSource==='saved'?'Saved to prediction history':'Preview only; not saved'}</span></div>
          {baseline&&<section className="compare-card"><div className="eyebrow">BEFORE / AFTER COMPARISON</div><h3>Baseline versus current design</h3><p className="field-hint">The baseline is a snapshot. The current score comes from the real preview API.</p><div className="compare-grid"><div><span>Baseline risk</span><strong>{Math.round(Number(baseline.result.probability)*100)}%</strong><small>{baseline.result.severity}</small></div><div><span>Current risk</span><strong>{Math.round(probability*100)}%</strong><small>{result.severity}</small></div><div><span>Change</span><strong className={probability<Number(baseline.result.probability)?'change-down':probability>Number(baseline.result.probability)?'change-up':''}>{Math.round((probability-Number(baseline.result.probability))*100)} pp</strong><small>{probability<Number(baseline.result.probability)?'Lower model estimate':probability>Number(baseline.result.probability)?'Higher model estimate':'No score change'}</small></div></div><button className="secondary" type="button" disabled={compareBusy||!inputValid} onClick={compareBaseline}>{compareBusy?'Comparing…':'Compare both sets through the ML API'}</button>{compareError&&<div className="alert error">{compareError}</div>}{serverComparison&&<div className="server-compare"><div><span>API baseline score</span><strong>{Math.round(Number(serverComparison.baseline.probability)*100)}%</strong></div><div><span>API revised score</span><strong>{Math.round(Number(serverComparison.revised.probability)*100)}%</strong></div><div><span>Change</span><strong>{serverComparison.percentage_point_delta>0?'+':''}{serverComparison.percentage_point_delta} pp</strong></div><p>{serverComparison.verification_note}</p></div>}<div className="table-wrap"><table><thead><tr><th>Parameter</th><th>Baseline</th><th>Current</th><th>Unit</th></tr></thead><tbody>{fields.map(([key,label,,, ,unit])=><tr key={key}><td>{label}</td><td>{baseline.form[key]}</td><td>{form[key]}</td><td>{unit}</td></tr>)}</tbody></table></div></section>}
          <section className="recommendation-card"><div className="eyebrow">IMPROVEMENT RECOMMENDATIONS</div><h3>Suggested engineering review</h3><p className="recommendation-text">{result.recommendation}</p><ol className="improvement-list">{improvements.map(([title,body])=><li key={title}><strong>{title}</strong><p>{body}</p></li>)}</ol></section>
          <section className="layout-card"><div><div className="eyebrow">CONCEPTUAL LAYOUT</div><h3>Where antenna risk can arise</h3><p className="field-hint">Illustrative only—not the actual geometry of your design.</p></div><svg className="antenna-diagram" viewBox="0 0 520 180" role="img" aria-label="Illustration of a gate connected to a long metal interconnect across routing layers"><rect x="12" y="18" width="496" height="142" rx="12" fill="#f7faff" stroke="#cfdbec"/><path d="M35 130 H485" stroke="#a8b8cc" strokeWidth="2" strokeDasharray="5 5"/><rect x="48" y="94" width="82" height="22" rx="4" fill="#dbeafe" stroke="#2563eb"/><text x="89" y="108" fontSize="10" textAnchor="middle" fill="#1e40af">Gate area</text><path d="M130 105 H198 V65 H450" fill="none" stroke="#dc2626" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="450" cy="65" r="7" fill="#fee2e2" stroke="#dc2626" strokeWidth="2"/><text x="290" y="48" fontSize="11" textAnchor="middle" fill="#b91c1c">Exposed metal / wire</text><path d="M198 66 V123 H452" fill="none" stroke="#0d9488" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/><text x="330" y="145" fontSize="10" textAnchor="middle" fill="#0f766e">Alternative layer path (concept)</text></svg><div className="diagram-legend"><span><i className="legend-red"/> Risk-review path</span><span><i className="legend-teal"/> Possible alternate route</span></div></section>
          <div className="note"><b>Verification boundary:</b> {modelInfo?.data_note||'The ML result is an estimate, not a foundry DRC verdict.'} Suggestions are general review prompts. Follow your target PDK and confirm with the official antenna/DRC checker before sign-off.</div>
        </div>}
      </section>
    </div>
  </Page>
}

function Verification(){
  const emptyForm={prediction_id:'',design_name:'',net_name:'',technology:'',rule_deck:'',source_tool:'OpenROAD',result:'PASS',violation_count:0,correction_action:'',notes:'',report_reference:'',report_sha256:''}
  const actualFeatureFields=[['metal_area','Metal area',0.001,10000,'µm²'],['gate_area','Gate area',0.001,10000,'µm²'],['wire_length','Wire length',0.001,100000,'µm'],['layer_count','Layer count',1,50,'layers'],['metal_width','Metal width',0.001,100,'µm'],['spacing','Spacing',0.001,100,'µm']]
  const emptyVerifiedFeatures={metal_area:'',gate_area:'',wire_length:'',layer_count:'',metal_width:'',spacing:''}
  const [form,setForm]=useState(emptyForm)
  const [verifiedFeatures,setVerifiedFeatures]=useState(emptyVerifiedFeatures)
  const [file,setFile]=useState(null)
  const [importTool,setImportTool]=useState('OpenROAD / normalized EDA report')
  const [records,setRecords]=useState([])
  const [verifications,setVerifications]=useState([])
  const [predictions,setPredictions]=useState([])
  const [edaEvaluation,setEdaEvaluation]=useState(null)
  const [evalTechnology,setEvalTechnology]=useState('')
  const [evalRuleDeck,setEvalRuleDeck]=useState('')
  const [evalBusy,setEvalBusy]=useState(false)
  const [busy,setBusy]=useState(false)
  const [importBusy,setImportBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [importSummary,setImportSummary]=useState(null)
  const [reportError,setReportError]=useState('')
  const [downloadBusy,setDownloadBusy]=useState(false)

  async function refresh(){
    setReportError('')
    try { const [r,v,p,e]=await Promise.all([api.edaRecords(100),api.verifications(100),api.history(100),api.edaEvaluation(evalTechnology,evalRuleDeck)]);setRecords(r);setVerifications(v);setPredictions(p);setEdaEvaluation(e) }
    catch(err){setReportError(err.message)}
  }
  useEffect(()=>{refresh()},[])
  function setField(key,value){setForm(old=>({...old,[key]:value}))}
  async function updateEvaluationFilters(technology,ruleDeck){
    setEvalBusy(true);setReportError('')
    try{setEdaEvaluation(await api.edaEvaluation(technology,ruleDeck))}
    catch(err){setReportError(`Could not evaluate filtered EDA data: ${err.message}`)}
    finally{setEvalBusy(false)}
  }
  function choosePrediction(value){
    setField('prediction_id',value)
    setVerifiedFeatures({...emptyVerifiedFeatures})
  }
  function copySelectedPredictionFeatures(){
    const prediction=predictions.find(item=>item.id===Number(form.prediction_id))
    if(prediction)setVerifiedFeatures(Object.fromEntries(actualFeatureFields.map(([key])=>[key,String(prediction[key])])))
  }
  function setVerifiedFeature(key,value){setVerifiedFeatures(old=>({...old,[key]:value}))}
  async function importSubmit(e){
    e.preventDefault();if(!file)return
    setImportBusy(true);setError('');setMessage('');setImportSummary(null)
    try{const data=await api.importEda(file,importTool);setImportSummary(data);setMessage(`Imported ${data.imported} EDA rows.`);setFile(null);await refresh()}
    catch(err){setError(`EDA import failed: ${err.message}`)}finally{setImportBusy(false)}
  }
  async function verifySubmit(e){
    e.preventDefault();setError('');setMessage('')
    const anyFeature=actualFeatureFields.some(([key])=>String(verifiedFeatures[key]??'').trim()!=='')
    const featureValues={}
    if(anyFeature){
      for(const [key,label,min,max] of actualFeatureFields){
        const value=Number(verifiedFeatures[key])
        if(verifiedFeatures[key]===''||!Number.isFinite(value)||value<min||value>max||(key==='layer_count'&&!Number.isInteger(value))){setError(`Enter a complete, valid feature snapshot for the layout that was actually checked. Check ${label} and the displayed limits.`);return}
        featureValues[key]=key==='layer_count'?Math.trunc(value):value
      }
    }
    setBusy(true)
    const payload={...form,prediction_id:form.prediction_id?Number(form.prediction_id):null,verified_features:anyFeature?featureValues:null,violation_count:Number(form.violation_count),net_name:form.net_name||null,correction_action:form.correction_action||null,notes:form.notes||null,report_reference:form.report_reference||null,report_sha256:form.report_sha256||null}
    try{const data=await api.recordVerification(payload);setMessage(data.note);setForm(emptyForm);setVerifiedFeatures({...emptyVerifiedFeatures});await refresh()}
    catch(err){setError(`Could not save verification: ${err.message}`)}finally{setBusy(false)}
  }
  async function downloadDataset(){
    setDownloadBusy(true);setError('')
    try{const blob=await api.verifiedDataset();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='antennaguard-verified-eda-dataset.csv';a.click();URL.revokeObjectURL(url)}
    catch(err){setError(`Dataset download failed: ${err.message}`)}finally{setDownloadBusy(false)}
  }
  return <Page eyebrow="EDA DATA & VERIFICATION" title="Connect predictions to actual checker results." description="Import normalized physical-design records and record verified antenna-check results after a real EDA run." action={<button className="secondary" onClick={refresh}>Refresh records</button>}>
    {error&&<div className="alert error">{error}</div>}{message&&<div className="alert success">{message}</div>}{reportError&&<div className="alert error">{reportError}</div>}
    <div className="verification-boundary"><strong>Important boundary</strong><p>Antennaguard does not run OpenROAD, Cadence, or a foundry rule deck. Only enter PASS/FAIL after running the actual checker on the matching design, technology and rule-deck version. Imported rows do not automatically retrain the live model.</p></div>
    <section className="panel model-evaluation"><div className="records-heading"><div><div className="eyebrow">EXTERNAL VALIDATION</div><h2>Check the current model against imported EDA labels</h2><p className="field-hint">This evaluates the existing model without retraining it. Filter to one technology and rule deck when enough labels are available.</p></div><span className={`risk-tag ${edaEvaluation?.evaluable?'low':'medium'}`}>{evalBusy?'Evaluating…':edaEvaluation?.evaluable?'Evaluation available':'More labels needed'}</span></div>
      <div className="eval-filter-row"><label>Technology / PDK<select value={evalTechnology} onChange={e=>{const value=e.target.value;setEvalTechnology(value);setEvalRuleDeck('');updateEvaluationFilters(value,'')}}><option value="">All technologies</option>{Array.from(new Set(records.map(r=>r.technology).filter(Boolean))).sort().map(value=><option key={value} value={value}>{value}</option>)}</select></label><label>Rule deck<select value={evalRuleDeck} onChange={e=>{const value=e.target.value;setEvalRuleDeck(value);updateEvaluationFilters(evalTechnology,value)}}><option value="">All rule decks</option>{Array.from(new Set(records.filter(r=>!evalTechnology||r.technology===evalTechnology).map(r=>r.rule_deck).filter(Boolean))).sort().map(value=><option key={value} value={value}>{value}</option>)}</select></label></div>
      <div className="evaluation-metrics">{[['Labelled rows',edaEvaluation?.labelled_samples??0],['Actual violations',edaEvaluation?.violation_samples??0],['No violation',edaEvaluation?.no_violation_samples??0],['Accuracy',edaEvaluation?.evaluable?`${(edaEvaluation.accuracy*100).toFixed(1)}%`:'—'],['Recall',edaEvaluation?.evaluable?`${(edaEvaluation.recall*100).toFixed(1)}%`:'—']].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      {!edaEvaluation?.evaluable?<p className="field-hint">{edaEvaluation?.message||'Loading imported dataset status…'} Import completed checker records with both violation and no-violation labels to calculate metrics.</p>:<><p className="diagnostic-footnote">{edaEvaluation.message}</p>{edaEvaluation.confusion_matrix?.matrix&&<div className="confusion-card"><div><strong>External confusion matrix</strong><p className="field-hint">Rows = actual checker label; columns = current ML model output.</p></div><div className="confusion-matrix"><span></span><b>Predicted: no</b><b>Predicted: violation</b><b>Actual: no</b><strong>{edaEvaluation.confusion_matrix.matrix[0][0]}</strong><strong>{edaEvaluation.confusion_matrix.matrix[0][1]}</strong><b>Actual: violation</b><strong>{edaEvaluation.confusion_matrix.matrix[1][0]}</strong><strong>{edaEvaluation.confusion_matrix.matrix[1][1]}</strong></div></div>}<p className="diagnostic-footnote">{edaEvaluation.note}</p></>}
    </section>
    <div className="grid two verification-grid">
      <section className="panel"><div className="eyebrow">1 · FEATURE + REPORT IMPORT</div><h2>Import EDA records</h2><p className="field-hint">Upload normalized per-net CSV or JSON. Every row needs the six model features. Add `verified_violation` only when the actual checker outcome is known.</p>
        <form className="form" onSubmit={importSubmit}><label>Source EDA tool<input value={importTool} onChange={e=>setImportTool(e.target.value)} required maxLength="120"/></label><label>CSV or JSON report<input type="file" accept=".csv,.json,application/json,text/csv" onChange={e=>setFile(e.target.files?.[0]||null)} required/></label><button className="primary" disabled={importBusy||!file}>{importBusy?'Importing…':'Validate and import rows'}</button></form>
        {importSummary&&<div className="import-result"><b>{importSummary.imported} rows imported</b><span>{importSummary.labelled_rows} labelled · {importSummary.unlabelled_rows} unlabelled</span><small>SHA-256: {importSummary.sha256}</small><p>{importSummary.note}</p></div>}
        <p className="field-hint">Schema and joining steps: see <code>docs/EDA_IMPORT_GUIDE.md</code> and <code>eda_import_template.csv</code> in the project folder.</p>
      </section>
      <section className="panel"><div className="eyebrow">2 · VERIFIED CORRECTION LOOP</div><h2>Record an actual checker result</h2><p className="field-hint">Optionally link the saved prediction that led to the correction. Enter the actual feature snapshot from the layout that was checked to add a conclusive result to the labelled dataset.</p>
        <form className="form" onSubmit={verifySubmit}>
          <label>Related saved prediction (optional)<select value={form.prediction_id} onChange={e=>choosePrediction(e.target.value)}><option value="">Not linked to a saved prediction</option>{predictions.map(p=><option key={p.id} value={p.id}>#{p.id} · {p.severity} · {Math.round(Number(p.probability)*100)}% model score</option>)}</select></label>
          <div className="grid two"><label>Design / block name<input value={form.design_name} onChange={e=>setField('design_name',e.target.value)} required maxLength="200" placeholder="top_block"/></label><label>Net name<input value={form.net_name} onChange={e=>setField('net_name',e.target.value)} maxLength="300" placeholder="optional_net"/></label></div>
          <div className="grid two"><label>Technology / PDK<input value={form.technology} onChange={e=>setField('technology',e.target.value)} required maxLength="200" placeholder="sky130A"/></label><label>Rule-deck version<input value={form.rule_deck} onChange={e=>setField('rule_deck',e.target.value)} required maxLength="300" placeholder="deck version / configuration"/></label></div>
          <label>EDA checker<input value={form.source_tool} onChange={e=>setField('source_tool',e.target.value)} required maxLength="120" placeholder="OpenROAD, Cadence..."/></label>
          <div className="grid two"><label>Actual checker result<select value={form.result} onChange={e=>setForm(old=>({...old,result:e.target.value,violation_count:e.target.value==='FAIL'?Math.max(1,Number(old.violation_count)||1):e.target.value==='PASS'?0:old.violation_count}))}><option value="PASS">PASS · no violation reported</option><option value="FAIL">FAIL · violation reported</option><option value="INCONCLUSIVE">Inconclusive</option></select></label><label>Violation count<input type="number" min="0" max="10000000" step="1" value={form.violation_count} onChange={e=>setField('violation_count',e.target.value)} required/></label></div>
          <details className="feature-snapshot"><summary>Feature snapshot of the layout actually checked (recommended for evaluation)</summary><p>Enter the actual feature values of the post-correction or otherwise verified layout. Selecting a saved prediction does not automatically reuse its inputs, because those values may describe the pre-correction design. The app will not label the original prediction inputs as corrected-layout ground truth automatically.</p>{form.prediction_id&&<button className="secondary" type="button" onClick={copySelectedPredictionFeatures}>Copy selected prediction inputs as a starting point</button>}<div className="feature-snapshot-grid">{actualFeatureFields.map(([key,label,min,max,unit])=><label key={key}>{label}<div className="input-unit"><input type="number" min={min} max={max} step={key==='layer_count'?'1':'any'} value={verifiedFeatures[key]} onChange={e=>setVerifiedFeature(key,e.target.value)} placeholder="Optional"/><span>{unit}</span></div></label>)}</div></details>
          <label>Correction or design change tried<input value={form.correction_action} onChange={e=>setField('correction_action',e.target.value)} maxLength="3000" placeholder="e.g. inserted allowed jumper and reran antenna check"/></label>
          <label>Report reference / path<input value={form.report_reference} onChange={e=>setField('report_reference',e.target.value)} maxLength="500" placeholder="local report filename, build ID, or secure reference"/></label>
          <label>Report SHA-256 (optional)<input value={form.report_sha256} onChange={e=>setField('report_sha256',e.target.value.trim())} pattern="[A-Fa-f0-9]{64}" placeholder="64 hexadecimal characters"/></label>
          <label>Notes<textarea value={form.notes} onChange={e=>setField('notes',e.target.value)} maxLength="5000" rows="3" placeholder="Command/run ID, report path, what changed, and review notes"/></label>
          <button className="primary" disabled={busy}>{busy?'Saving verification…':'Save verified result'}</button>
        </form>
      </section>
    </div>
    <section className="panel records-panel"><div className="records-heading"><div><div className="eyebrow">IMPORTED DATA</div><h2>EDA feature records</h2><p className="field-hint">Only labelled rows are eligible for export to the verified dataset.</p></div><button className="secondary" onClick={downloadDataset} disabled={downloadBusy}>{downloadBusy?'Preparing…':'Download verified dataset CSV'}</button></div>
      {records.length===0?<div className="empty compact-empty">No imported EDA records yet.</div>:<div className="table-wrap"><table><thead><tr><th>Design / net</th><th>Source</th><th>Technology / deck</th><th>Label</th><th>Metal area</th><th>Gate area</th><th>Wire length</th><th>Layers</th></tr></thead><tbody>{records.map(r=><tr key={r.id}><td>{r.design_name||'—'}<small className="table-sub">{r.net_name||'net not supplied'}</small></td><td>{r.source_tool}<small className="table-sub">{r.source_file}</small></td><td>{r.technology||'—'}<small className="table-sub">{r.rule_deck||'—'}</small></td><td><span className={`risk-tag ${r.verified_violation===true?'high':r.verified_violation===false?'low':'medium'}`}>{r.verified_violation===true?'Violation':r.verified_violation===false?'No violation':'Unlabelled'}</span></td><td>{r.metal_area}</td><td>{r.gate_area}</td><td>{r.wire_length}</td><td>{r.layer_count}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="panel records-panel"><div className="eyebrow">VERIFIED CORRECTION HISTORY</div><h2>Actual checker results</h2>{verifications.length===0?<div className="empty compact-empty">No EDA verification results saved yet.</div>:<div className="table-wrap"><table><thead><tr><th>Date</th><th>Design / net</th><th>Actual result</th><th>Technology / deck</th><th>Correction tested</th><th>Prediction</th><th>Evidence reference</th></tr></thead><tbody>{verifications.map(v=><tr key={v.id}><td>{v.created_at?new Date(v.created_at).toLocaleString():'—'}</td><td>{v.design_name}<small className="table-sub">{v.net_name||'net not supplied'}</small></td><td><span className={`risk-tag ${v.result==='FAIL'?'high':v.result==='PASS'?'low':'medium'}`}>{v.result}</span><small className="table-sub">{v.violation_count} violations</small></td><td>{v.technology}<small className="table-sub">{v.rule_deck}</small></td><td>{v.correction_action||v.notes||'—'}</td><td>{v.prediction_id?`#${v.prediction_id}`:'Unlinked'}</td><td>{v.report_reference||'—'}{v.report_sha256&&<small className="table-sub">SHA-256 recorded</small>}</td></tr>)}</tbody></table></div>}</section>
  </Page>
}

function BatchImport(){
  const [file,setFile]=useState(null)
  const [items,setItems]=useState([])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  async function run(e){
    e.preventDefault();if(!file){setError('Choose a CSV file first.');return}
    setBusy(true);setError('');setMessage('');setItems([])
    try{const data=await api.batch(file);setItems(data.items||[]);setMessage(`${data.count??data.items?.length??0} rows processed. Prediction rows were saved to your account history.`)}
    catch(err){setError(err.message)}finally{setBusy(false)}
  }
  function download(){
    if(!items.length)return
    const columns=['id','created_at','metal_area','gate_area','wire_length','layer_count','metal_width','spacing','probability','violation','severity','tree_vote_agreement','out_of_training_range','recommendation']
    const quote=value=>`"${String(Array.isArray(value)?value.join('; '):(value??'')).replaceAll('"','""')}"`
    const csv=[columns.join(','),...items.map(row=>columns.map(key=>quote(row[key])).join(','))].join('\r\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='antennaguard_batch_predictions.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const high=items.filter(x=>x.severity==='HIGH').length,medium=items.filter(x=>x.severity==='MEDIUM').length,low=items.filter(x=>x.severity==='LOW').length
  return <Page eyebrow="MULTI-NET WORKFLOW" title="Batch feature analysis." description="Upload a CSV exported from your EDA workflow or prepared dataset. AntennaGuard validates the six model features, predicts each row, and stores the resulting checks." action={<NavLink className="secondary" to="/predict">Analyze one net →</NavLink>}>
    {error&&<div className="alert error">{error}</div>}{message&&<div className="alert success">{message}</div>}
    <div className="grid two batch-page-grid">
      <section className="panel"><div className="records-heading"><div><div className="eyebrow">IMPORT NET FEATURES</div><h2>Choose a CSV file</h2></div><span className="risk-tag medium">Max 100 rows</span></div><form className="form" onSubmit={run}><label className="batch-drop"><span className="batch-upload-icon">⇧</span><strong>{file?file.name:'Select an EDA feature export'}</strong><small>CSV format · UTF-8 · up to 2 MB</small><input type="file" accept=".csv,text/csv" onChange={e=>{setFile(e.target.files?.[0]||null);setError('');setMessage('');setItems([])}} /></label><button className="primary" disabled={!file||busy}>{busy?'Validating and predicting…':'Validate and predict →'}</button><button className="secondary" type="button" onClick={()=>{setFile(null);setItems([]);setError('');setMessage('')}}>Clear import</button></form><div className="verification-boundary"><strong>Important</strong><p>Batch prediction uses the current model and is advisory only. It does not run DRC, and this batch API accepts only these six model input columns.</p></div></section>
      <section className="panel"><div className="eyebrow">CSV CONTRACT</div><h2>Required feature schema</h2><div className="code-block">metal_area,gate_area,wire_length,layer_count,metal_width,spacing{'\n'}500,4,230,1,0.4,0.1</div><p>All measurements must use the same units and extraction definitions as the training feature schema. `layer_count` must be an integer and all six values must be positive.</p><div className="quick-link-list"><NavLink to="/verification"><span><b>Need traceability and actual labels?</b><small>Use EDA Verification to import records with technology, rule-deck and source information.</small></span><strong>→</strong></NavLink></div></section>
    </div>
    {items.length>0&&<section className="panel batch-output"><div className="records-heading"><div><div className="eyebrow">PREDICTION OUTPUT</div><h2>Batch results</h2><p className="field-hint">These are model outputs, not verified DRC results.</p></div><button className="secondary" onClick={download}>Download prediction CSV</button></div><div className="stats batch-stat-grid"><Stat label="Processed" value={items.length} sub="Rows returned"/><Stat label="High risk" value={high} sub="Prioritize review" tone="red"/><Stat label="Medium risk" value={medium} sub="Review context" tone="amber"/><Stat label="Low risk" value={low} sub="Still run DRC" tone="blue"/></div><div className="table-wrap"><table><thead><tr><th>Saved ID</th><th>Predicted risk</th><th>Severity</th><th>Metal area</th><th>Gate area</th><th>Wire length</th><th>Layers</th><th>Model guidance</th></tr></thead><tbody>{items.map((row,index)=><tr key={row.id??index}><td>{row.id??'—'}</td><td>{(Number(row.probability)*100).toFixed(1)}%</td><td><span className={`risk-tag ${(row.severity||'medium').toLowerCase()}`}>{row.severity||'Unknown'}</span></td><td>{row.metal_area}</td><td>{row.gate_area}</td><td>{row.wire_length}</td><td>{row.layer_count}</td><td>{row.recommendation}</td></tr>)}</tbody></table></div></section>}
  </Page>
}

function WorkflowGuide(){
  return <Page eyebrow="IMPLEMENTATION GUIDE" title="From layout data to reliable triage." description="Use this workflow to make model results traceable, interpretable and grounded in the actual physical-design flow." action={<NavLink className="primary" to="/verification">Open EDA verification →</NavLink>}>
    <div className="grid two workflow-guide-grid">
      <section className="panel"><div className="records-heading"><div><div className="eyebrow">SCREENING WORKFLOW</div><h2>Four stages from layout to evidence</h2></div><span className="risk-tag medium">Advisory workflow</span></div><div className="flow guide-flow"><div className="flow-step"><div className="step-num">01</div><div><b>Extract consistent net features</b><p>Export geometry measurements using a documented EDA script. Preserve units, design ID, net ID, technology and source report.</p></div></div><div className="flow-step"><div className="step-num">02</div><div><b>Screen using a compatible model</b><p>Use the same six input features, order, units and extraction definitions as the training schema.</p></div></div><div className="flow-step"><div className="step-num">03</div><div><b>Prioritize engineering review</b><p>Inspect high-priority nets and their layout context. A model prediction does not confirm a rule violation.</p></div></div><div className="flow-step"><div className="step-num">04</div><div><b>Run official antenna DRC</b><p>Use the matching process design kit and rule deck. Record tool version, rule deck, result and the feature snapshot of the layout that was checked.</p></div></div></div></section>
      <section className="panel"><div className="eyebrow">CONNECTED COMPONENTS</div><h2>Application architecture</h2><div className="architecture-list"><div><strong>React + Vite</strong><small>Login, responsive dashboard, analysis forms and reports.</small></div><div><strong>FastAPI</strong><small>Authentication, prediction, CSV batch, EDA import and verification APIs.</small></div><div><strong>Random Forest</strong><small>Consumes six numeric features and returns a model score and predicted class.</small></div><div><strong>Database</strong><small>Stores users, saved predictions, imported EDA features and actual verification records.</small></div></div><div className="verification-boundary"><strong>What is not automatic</strong><p>The current prototype does not parse DEF/GDSII/OASIS directly, run a PDK antenna rule deck, automatically modify routing, or prove silicon-level results.</p></div></section>
      <section className="panel"><div className="eyebrow">FEATURE SCHEMA</div><h2>Required input columns</h2><div className="code-block">metal_area,gate_area,wire_length,layer_count,metal_width,spacing</div><p>Use the same definitions and units as the model expects. When available, track additional columns in the EDA import pipeline:</p><div className="schema-chips"><span>design_name</span><span>net_name</span><span>technology / PDK</span><span>rule_deck</span><span>source_tool</span><span>source_file</span><span>verified_violation</span></div><NavLink className="secondary" to="/batch">Open batch import →</NavLink></section>
      <section className="panel"><div className="eyebrow">LOCAL CONFIGURATION</div><h2>Run the application locally</h2><p>The frontend development server proxies `/api` requests to FastAPI on port 8000. Keep the existing API base configuration unless you intentionally deploy the frontend and backend separately.</p><div className="code-block">cd frontend{'\n'}npm install{'\n'}npm run dev</div><div className="code-block">cd backend{'\n'}python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000</div><p className="field-hint">The provided Windows setup and start scripts are available in the project root. See README.md for the full setup flow.</p></section>
    </div>
  </Page>
}

function History(){const [items,setItems]=useState([]);const [q,setQ]=useState('');const [busy,setBusy]=useState(true);const [error,setError]=useState(''); const load=()=>{setBusy(true);api.history().then(setItems).catch(e=>setError(e.message)).finally(()=>setBusy(false))};useEffect(load,[]);const shown=items.filter(x=>`${x.severity} ${x.recommendation}`.toLowerCase().includes(q.toLowerCase()));return <Page eyebrow="RUN HISTORY" title="Your prediction archive." description="Every saved check is tied to your AntennaGuard account." action={<button className="secondary" onClick={load}>Refresh</button>}>{error&&<div className="alert error">{error}</div>}<section className="panel"><div className="toolbar"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search risk or guidance…"/><span>{shown.length} results</span></div>{busy?<div className="empty">Loading history…</div>:shown.length===0?<div className="empty"><h3>No saved predictions yet.</h3><NavLink to="/predict" className="secondary">Run your first check →</NavLink></div>:<div className="table-wrap"><table><thead><tr><th>Date</th><th>Risk</th><th>Severity</th><th>Features (µm² / µm)</th><th>Guidance</th></tr></thead><tbody>{shown.map(x=><tr key={x.id}><td>{x.created_at?new Date(x.created_at).toLocaleString():'—'}</td><td><b>{Math.round(x.probability*100)}%</b></td><td><span className={`risk-tag ${x.severity.toLowerCase()}`}>{x.severity}</span></td><td>MA {x.metal_area} µm² · GA {x.gate_area} µm² · W {x.wire_length} µm</td><td>{x.recommendation}</td></tr>)}</tbody></table></div>}</section></Page>}

function Reports(){
  const [items,setItems]=useState([]);const [modelInfo,setModelInfo]=useState(null);const [modelError,setModelError]=useState('')
  useEffect(()=>{api.history().then(setItems).catch(()=>{});api.modelInfo().then(setModelInfo).catch(e=>setModelError(e.message))},[])
  const totals={total:items.length,high:items.filter(x=>x.severity==='HIGH').length,medium:items.filter(x=>x.severity==='MEDIUM').length,low:items.filter(x=>x.severity==='LOW').length}
  function download(){const cols=['id','created_at','probability','violation','severity','metal_area','gate_area','wire_length','layer_count','metal_width','spacing','recommendation'];const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;const csv=[cols.join(','),...items.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='antennaguard-report.csv';a.click()}
  const metrics=modelInfo?.validation_metrics||{}
  const confusion=metrics.confusion_matrix||{}
  return <Page eyebrow="REPORTING & MODEL VALIDATION" title="Design-risk summary." description="Review saved predictions and inspect the Random Forest's held-out demo metrics." action={<button className="secondary" disabled={!items.length} onClick={download}>Export prediction history</button>}>
    <div className="verification-boundary"><strong>Evaluation scope</strong><p>{modelInfo?.data_note||'Metrics are from the bundled synthetic teaching dataset only.'} These results validate code behavior on synthetic examples; they do not establish real-world or foundry accuracy.</p></div>
    {modelError&&<div className="alert error">Could not load model metrics: {modelError}</div>}
    <section className="panel model-evaluation"><div className="records-heading"><div><div className="eyebrow">RANDOM FOREST · {modelInfo?.version||'loading model metadata'}</div><h2>Held-out model evaluation</h2><p className="field-hint">{modelInfo?.validation_method||'Loading evaluation split...'} · {modelInfo?.training_samples??'—'} training samples</p></div><span className="risk-tag medium">Synthetic data</span></div>
      <div className="evaluation-metrics">{[['Accuracy',metrics.accuracy],['Precision',metrics.precision],['Recall',metrics.recall],['F1 score',metrics.f1_score],['ROC-AUC',metrics.roc_auc]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value==null?'—':`${(Number(value)*100).toFixed(1)}%`}</strong></div>)}</div>
      {confusion.matrix&&<div className="confusion-card"><div><strong>Confusion matrix</strong><p className="field-hint">Rows = actual class; columns = predicted class.</p></div><div className="confusion-matrix"><span></span><b>Predicted: no</b><b>Predicted: violation</b><b>Actual: no</b><strong>{confusion.matrix[0][0]}</strong><strong>{confusion.matrix[0][1]}</strong><b>Actual: violation</b><strong>{confusion.matrix[1][0]}</strong><strong>{confusion.matrix[1][1]}</strong></div></div>}
      {modelInfo?.feature_importance&&<div className="feature-importance"><strong>Global feature importance</strong>{Object.entries(modelInfo.feature_importance).map(([name,score])=><div className="importance-row" key={name}><span>{name}</span><div className="importance-track"><i style={{width:`${Math.max(0,Math.min(100,Number(score)*100))}%`}}/></div><b>{(Number(score)*100).toFixed(1)}%</b></div>)}</div>}
      <p className="diagnostic-footnote">Class scores and per-tree vote agreement are uncalibrated. Feature importance describes the fitted model, not physical causation. For meaningful engineering evaluation, replace synthetic labels with checked results from a matching EDA flow and rule deck.</p>
    </section>
    <div className="grid two"><section className="panel report"><div className="eyebrow">PREDICTION HISTORY</div><h2>Prediction activity overview</h2><p>Generated from your saved model runs.</p><div className="report-metrics"><div><span>Total</span><b>{totals.total}</b></div><div><span>High</span><b>{totals.high}</b></div><div><span>Medium</span><b>{totals.medium}</b></div><div><span>Low</span><b>{totals.low}</b></div></div><div className="report-bar"><i style={{width:`${totals.total?totals.high/totals.total*100:0}%`}}/><i style={{width:`${totals.total?totals.medium/totals.total*100:0}%`}}/><i style={{width:`${totals.total?totals.low/totals.total*100:0}%`}}/></div></section><section className="panel"><div className="eyebrow">EDA CLOSED LOOP</div><h2>Record verified corrections.</h2><p>Import per-net EDA features, link a saved prediction, and record the actual checker result after a correction has been run through the chosen technology rule deck.</p><NavLink className="primary" to="/verification">Open EDA verification →</NavLink></section></div>
  </Page>
}

export default function App(){return <Routes><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route element={<Protected/>}><Route element={<Layout/>}><Route path="/dashboard" element={<Dashboard/>}/><Route path="/predict" element={<Predict/>}/><Route path="/analyze" element={<Predict/>}/><Route path="/batch" element={<BatchImport/>}/><Route path="/validation" element={<Reports/>}/><Route path="/workflow" element={<WorkflowGuide/>}/><Route path="/verification" element={<Verification/>}/><Route path="/history" element={<History/>}/><Route path="/reports" element={<Reports/>}/></Route></Route><Route path="/" element={<Navigate to="/dashboard" replace/>}/><Route path="*" element={<Navigate to="/dashboard" replace/>}/></Routes>}
