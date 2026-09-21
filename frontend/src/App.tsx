import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowRight, CheckCircle2, ChevronRight, CircleAlert, Clock3, Database,
  FileSpreadsheet, Gauge, History, Layers3, LoaderCircle, Menu, Play, RefreshCw,
  RotateCcw, Settings2, ShieldCheck, Sparkles, UploadCloud, UsersRound, X,
  BarChart3, AlertTriangle, Zap, Search, Bell, Workflow, GitFork, UserCheck, Flag,
  Sun, Moon, MessageSquare, Radio, PlayCircle, PauseCircle, Bot, ArrowDown
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie,
  Cell, Legend, ComposedChart, CartesianGrid
} from 'recharts'
import { API, api } from './services/api'
import type { AuditEvent, Escalation, Execution, Mapping, Migration, View } from './types'

const nav: { key: View; label: string; icon: typeof Activity }[] = [
  { key: 'overview', label: 'Overview', icon: Gauge },
  { key: 'agent', label: 'Agent canvas', icon: Workflow },
  { key: 'migrations', label: 'Migrations', icon: Layers3 },
  { key: 'mappings', label: 'Mappings', icon: ArrowRight },
  { key: 'escalations', label: 'Escalations', icon: CircleAlert },
  { key: 'execution', label: 'Execution', icon: Activity },
  { key: 'audit', label: 'Audit log', icon: History },
  { key: 'settings', label: 'Settings', icon: Settings2 },
]

const COLORS = { mint: '#4ecdc4', amber: '#fbb344', red: '#ef6b6b', blue: '#5e9def', purple: '#a78bfa', gray: '#6b8599' }

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return (window.localStorage.getItem('migration-copilot-theme') as 'dark' | 'light') || 'dark'
  })
  const [view, setView] = useState<View>('overview')
  const [migrations, setMigrations] = useState<Migration[]>([])
  const [migration, setMigration] = useState<Migration | null>(null)
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [executions, setExecutions] = useState<Execution[]>([])
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [liveEvents, setLiveEvents] = useState<{ type: string; at: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => { window.localStorage.setItem('migration-copilot-theme', theme) }, [theme])

  const loadMigrationData = useCallback(async (id: string) => {
    try {
      const [current, mappingRows, escalationRows, executionRows, auditRows] = await Promise.all([
        api.getMigration(id), api.mappings(id), api.escalations(id), api.executions(id), api.audit(id),
      ])
      setMigration(current)
      setMappings(mappingRows)
      setEscalations(escalationRows)
      setExecutions(executionRows)
      setAudit(auditRows)
      setError('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load migration') }
  }, [])

  const refresh = useCallback(async () => {
    setError('')
    try {
      const rows = await api.listMigrations()
      setMigrations(rows)
      if (migration) await loadMigrationData(migration._id)
      else if (rows[0]) await loadMigrationData(rows[0]._id)
    } catch (err) { setError('Backend is not reachable yet. Start the API and refresh this page.') }
  }, [loadMigrationData, migration])

  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    if (!migration) return
    const source = new EventSource(`${API}/api/migrations/${migration._id}/events`)
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { event_type?: string }
        setLiveEvents((items) => [{ type: data.event_type || event.type || 'event', at: new Date().toLocaleTimeString() }, ...items].slice(0, 8))
        void loadMigrationData(migration._id)
      } catch { /* keep stream resilient */ }
    }
    source.onerror = () => source.close()
    return () => source.close()
  }, [migration, loadMigrationData])

  useEffect(() => {
    if (!migration || ['completed', 'rolled_back'].includes(migration.status)) return
    const timer = window.setInterval(() => void loadMigrationData(migration._id), 2500)
    return () => window.clearInterval(timer)
  }, [migration, loadMigrationData])

  const runDemo = async () => {
    setLoading(true); setError(''); setNotice('')
    try {
      const created = await api.createMigration('Northstar employee cutover')
      await api.loadSamples(created._id)
      setMigration(created)
      await loadMigrationData(created._id)
      await api.start(created._id)
      setView('overview')
      setNotice('Demo migration started. The agent is profiling three source systems.')
      await loadMigrationData(created._id)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not start demo') }
    finally { setLoading(false) }
  }

  const selectMigration = async (item: Migration) => { setMigration(item); await loadMigrationData(item._id); setView('overview') }
  const resolve = async (item: Escalation, action: string) => {
    try {
      let corrected_value: unknown = undefined
      if (action === 'correct') {
        corrected_value = window.prompt(`Correct value for ${item.target_field || 'this case'}`, item.candidates[0] || '')
        if (corrected_value === null) return
      }
      await api.resolve(item._id, { action, corrected_value, apply_to_similar: true })
      setNotice(action === 'approve' ? 'Approved. The workflow will resume after all open reviews are resolved.' : `Escalation ${action}ed.`)
      if (migration) await loadMigrationData(migration._id)
    } catch (err) { setError(err instanceof Error ? err.message : 'Resolution failed') }
  }
  const retry = async () => { if (!migration) return; await api.retry(migration._id); setNotice('Retry submitted. Safe idempotent operations are being replayed.'); await loadMigrationData(migration._id) }
  const rollback = async () => { if (!migration) return; await api.rollback(migration._id); setNotice('Rollback completed for successful mutations.'); await loadMigrationData(migration._id) }

  const openReviews = escalations.filter((item) => item.status === 'open').length
  const successRate = migration && migration.success_count + migration.failed_count > 0
    ? Math.round((migration.success_count / (migration.success_count + migration.failed_count)) * 100)
    : 0

  const filteredMigrations = useMemo(() => {
    if (!searchQuery.trim()) return migrations
    const q = searchQuery.toLowerCase()
    return migrations.filter((m) => m.name.toLowerCase().includes(q) || m.tenant_id.toLowerCase().includes(q))
  }, [migrations, searchQuery])

  return (
    <div className={`app-shell ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo dark-logo" src="/brand/darwinbox-logo-white.png" alt="Darwinbox" />
          <img className="brand-logo light-logo" src="/brand/darwinbox-logo.png" alt="Darwinbox" />
          <div className="brand-product"><span>migration copilot</span><small>governed data operations</small></div>
        </div>
        <div className="workspace-switch">
          <div className="avatar">N</div>
          <div><span>Workspace</span><strong>Northstar HR</strong></div>
          <ChevronRight size={15} />
        </div>
        <nav className="nav-list">
          {nav.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`nav-item ${view === key ? 'active' : ''}`} onClick={() => setView(key)}>
              <span className="nav-dot" /><Icon size={16} /><span>{label}</span>
              {key === 'escalations' && openReviews > 0 && <em>{openReviews}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="secure-badge">
            <ShieldCheck size={16} />
            <div><strong>Governed workspace</strong><small>Private context enabled</small></div>
          </div>
          <div className="user-row">
            <div className="avatar small circle">DK</div>
            <div><strong>Dinesh Kumar</strong><small>Implementation lead</small></div>
            <Menu size={15} />
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div><span className="eyebrow">IMPLEMENTATION CONTROL PLANE</span><h1>{nav.find((item) => item.key === view)?.label}</h1></div>
          <div className="top-actions">
            <button className="icon-button" title="Notifications"><Bell size={17} /></button>
            <span className="live-dot"><i /> System healthy</span>
            <button className="icon-button theme-toggle" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="icon-button"><Menu size={17} /></button>
          </div>
        </header>
        {error && <div className="toast error"><CircleAlert size={17} />{error}<button onClick={() => setError('')}><X size={14} /></button></div>}
        {notice && <div className="toast success"><CheckCircle2 size={17} />{notice}<button onClick={() => setNotice('')}><X size={14} /></button></div>}
        {view === 'overview' && <Overview migration={migration} successRate={successRate} openReviews={openReviews} liveEvents={liveEvents} runDemo={runDemo} loading={loading} setView={setView} audit={audit} mappings={mappings} />}
        {view === 'agent' && <AgentCanvas migration={migration} mappings={mappings} escalations={escalations} executions={executions} audit={audit} setView={setView} />}
        {view === 'migrations' && <Migrations migration={migration} migrations={filteredMigrations} allCount={migrations.length} onSelect={selectMigration} runDemo={runDemo} loading={loading} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
        {view === 'mappings' && <Mappings mappings={mappings} migration={migration} />}
        {view === 'escalations' && <EscalationQueue items={escalations} migration={migration} resolve={resolve} />}
        {view === 'execution' && <ExecutionView items={executions} migration={migration} retry={retry} rollback={rollback} />}
        {view === 'audit' && <AuditView items={audit} />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}

function EmptyState({ runDemo, loading }: { runDemo: () => void; loading: boolean }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><UploadCloud size={26} /></div>
      <h2>Start with the Northstar demo</h2>
      <p>Load three intentionally messy employee sources and watch the governed agent reconcile them into a Darwinbox-ready dataset.</p>
      <button className="primary-button" onClick={runDemo} disabled={loading}>
        {loading ? <LoaderCircle className="spin" size={17} /> : <Play size={17} />}
        {loading ? 'Starting\u2026' : 'Create demo migration'}
      </button>
    </div>
  )
}

function Overview({ migration, successRate, openReviews, liveEvents, runDemo, loading, setView, audit, mappings }: {
  migration: Migration | null; successRate: number; openReviews: number; liveEvents: { type: string; at: string }[];
  runDemo: () => void; loading: boolean; setView: (view: View) => void; audit: AuditEvent[]; mappings: Mapping[];
}) {
  if (!migration) return <EmptyState runDemo={runDemo} loading={loading} />
  const steps = ['Ingest', 'Map', 'Reconcile', 'Review', 'Execute', 'Verify']
  const nodeMap: Record<string, number> = { profiler: 0, mapper: 1, reconciler: 2, validator: 2, decision_gate: 3, review: 3, executor: 4, verifier: 5, finalize: 5 }
  const activeStep = nodeMap[migration.current_node || ''] ?? (migration.status === 'completed' ? 6 : 0)

  const autonomyData = [
    { name: 'Auto', value: Math.max(35, migration.auto_approved * 5), color: COLORS.mint },
    { name: 'Review', value: openReviews ? 35 : 12, color: COLORS.amber },
    { name: 'Block', value: 4, color: COLORS.red },
  ]

  const eventTimelineData = audit.slice(0, 10).reverse().map((a) => ({
    name: a.event_type.split('.').pop() || a.event_type,
    latency: a.latency_ms || 0,
  }))

  return (
    <>
      <section className="hero-card">
        <div>
          <div className="status-pill"><span className={`status-dot ${migration.status}`} /> {migration.status.replace('_', ' ')}</div>
          <h2>{migration.name}</h2>
          <p>Employee data cutover &middot; Target <strong>Darwinbox</strong> &middot; Tenant <code>{migration.tenant_id}</code></p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" onClick={() => setView('mappings')}><FileSpreadsheet size={15} /> Mapping studio</button>
          <button className="secondary-button" onClick={() => setView('escalations')}><CircleAlert size={15} /> {openReviews} reviews</button>
          <button className="primary-button" onClick={() => setView('execution')}><Zap size={15} /> Execute</button>
        </div>
      </section>

      <div className="metric-grid">
        <MetricCard label="Records processed" value={migration.records_processed.toLocaleString()} detail={`${migration.files_count} source files`} icon={UsersRound} tone="blue" />
        <MetricCard label="Auto-approved" value={migration.auto_approved.toLocaleString()} detail="Evidence-backed mappings" icon={Sparkles} tone="green" />
        <MetricCard label="Human review" value={String(openReviews)} detail="Only ambiguous cases" icon={CircleAlert} tone="amber" />
        <MetricCard label="Success rate" value={`${successRate}%`} detail={`${migration.success_count} successful mutations`} icon={CheckCircle2} tone={migration.failed_count ? 'red' : 'green'} />
      </div>

      <div className="lower-grid">
        <section className="panel">
          <div className="section-heading">
            <div><span className="eyebrow">LIVE WORKFLOW</span><h3>Migration control loop</h3></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button className="ghost-button small" onClick={() => setView('agent')}>Open agent canvas <ArrowRight size={13} /></button>
              <span className="muted-label">{migration.current_node || 'queued'}</span>
            </div>
          </div>
          <div className="steps">
            {steps.map((step, index) => {
              const isDone = index < activeStep
              const isCurrent = index === activeStep
              return (
                <div className={`step ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`} key={step}>
                  <div className="step-marker">{isDone ? <CheckCircle2 size={14} /> : index + 1}</div>
                  <span>{step}</span>
                  {index < steps.length - 1 && <div className="step-line" />}
                </div>
              )
            })}
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <div><span className="eyebrow">AUTONOMY MIX</span><h3>Safe by default</h3></div>
            <ShieldCheck size={18} style={{ color: COLORS.mint }} />
          </div>
          <div style={{ marginTop: '18px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={autonomyData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3}>
                  {autonomyData.map((entry, index) => <Cell key={index} fill={entry.color} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f2035', border: '1px solid rgba(142,184,221,.18)', borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
          </div>
          <p className="panel-note">The agent exposes evidence before a mutation. Sensitive context stays behind tool permissions.</p>
        </section>
      </div>

      <div className="lower-grid">
        <section className="panel">
          <div className="section-heading">
            <div><span className="eyebrow">EVENT STREAM</span><h3>Agent activity</h3></div>
            <span className="live-label"><i /> live</span>
          </div>
          {liveEvents.length ? (
            <div className="event-list">
              {liveEvents.map((event, index) => (
                <div className="event-row" key={`${event.at}-${index}`}>
                  <span className="event-icon"><Activity size={13} /></span>
                  <span><strong>{event.type.replaceAll('.', ' ')}</strong><small>Control plane event</small></span>
                  <time>{event.at}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="soft-empty"><Activity size={18} /><span>Events will appear here as the graph moves through each node.</span></div>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <div><span className="eyebrow">MIGRATION VELOCITY</span><h3>Latency per phase</h3></div>
            <BarChart3 size={16} style={{ color: COLORS.blue }} />
          </div>
          <div style={{ marginTop: '14px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={eventTimelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(142,184,221,.08)" />
                <XAxis dataKey="name" tick={{ fill: '#5f798d', fontSize: 9 }} axisLine={{ stroke: 'rgba(142,184,221,.1)' }} tickLine={false} />
                <YAxis tick={{ fill: '#5f798d', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f2035', border: '1px solid rgba(142,184,221,.18)', borderRadius: '8px', fontSize: '11px' }} />
                <Bar dataKey="latency" fill={COLORS.blue} radius={[4, 4, 0, 0]} barSize={28} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {mappings.length > 0 && <RecentMappings mappings={mappings} setView={setView} />}
    </>
  )
}

function MetricCard({ label, value, detail, icon: Icon, tone = '' }: { label: string; value: string | number; detail: string; icon: typeof Activity; tone?: string }) {
  const toneClass = tone ? `metric-icon ${tone}` : 'metric-icon'
  return (
    <div className="metric-card">
      <div className={toneClass}><Icon size={17} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function RecentMappings({ mappings, setView }: { mappings: Mapping[]; setView: (v: View) => void }) {
  const recent = mappings.slice(0, 4)
  return (
    <div className="chart-panel" style={{ marginTop: '14px' }}>
      <div className="chart-header">
        <div>
          <span className="eyebrow">RECENT MAPPING DECISIONS</span>
          <h3 style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--heading)', fontWeight: 600 }}>Field mapping summary</h3>
        </div>
        <button className="ghost-button" onClick={() => setView('mappings')}>View all <ArrowRight size={13} /></button>
      </div>
      <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
        {recent.map((m) => (
          <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px', background: 'rgba(255,255,255,.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <code style={{ color: '#9eb5c4', font: '11px DM Mono', background: 'rgba(255,255,255,.03)', padding: '3px 7px', borderRadius: '4px', minWidth: '100px' }}>{m.source_field}</code>
            <ArrowRight size={13} style={{ color: '#557a94', flexShrink: 0 }} />
            <strong style={{ color: '#ecf9fb', fontSize: '12px', fontWeight: 600, flex: 1 }}>{m.target_field}</strong>
            <span className={`confidence ${m.autonomy.toLowerCase()}`}>{Math.round(m.confidence * 100)}%</span>
            <span style={{ fontSize: '10px', color: '#5f798d', fontFamily: 'DM Mono', minWidth: '80px', textAlign: 'right' }}>{m.source_file}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Migrations({ migration, migrations, allCount, onSelect, runDemo, loading, searchQuery, setSearchQuery }: {
  migration: Migration | null; migrations: Migration[]; allCount: number; onSelect: (m: Migration) => void; runDemo: () => void; loading: boolean; searchQuery: string; setSearchQuery: (q: string) => void;
}) {
  const filterOpts = ['All', 'Active', 'Completed', 'Draft']
  const [activeFilter, setActiveFilter] = useState('All')
  const filtered = migrations.filter((m) => {
    if (activeFilter === 'Active') return !['completed', 'rolled_back'].includes(m.status)
    if (activeFilter === 'Completed') return m.status === 'completed'
    if (activeFilter === 'Draft') return m.status === 'draft'
    return true
  })

  return (
    <section className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">ALL WORKSPACES</span>
          <h2>Migrations <span className="title-count">{allCount}</span></h2>
          <p>Track every governed employee data cutover from source intake to verified target state.</p>
        </div>
        <button className="primary-button" onClick={runDemo} disabled={loading}><Sparkles size={15} /> New demo migration</button>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
        {filterOpts.map((f) => (
          <button key={f} className={`ghost-button ${activeFilter === f ? 'active-filter' : ''}`} onClick={() => setActiveFilter(f)}>{f}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 12px' }}>
          <Search size={13} style={{ color: '#5f798d' }} />
          <input type="text" placeholder="Search migrations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '12px', width: '180px' }} />
        </div>
      </div>
      <div className="table-card">
        <div className="table-head"><span>Migration</span><span>Status</span><span>Records</span><span>Auto-Approved</span><span>Updated</span></div>
        {filtered.length ? filtered.map((item) => (
          <button className={`table-row ${migration?._id === item._id ? 'selected' : ''}`} key={item._id} onClick={() => onSelect(item)}>
            <span><strong>{item.name}</strong><small>{item.tenant_id} &middot; {item.files_count} files</small></span>
            <span><span className={`status-pill compact ${item.status}`}><i />{item.status.replace('_', ' ')}</span></span>
            <span>{item.records_processed.toLocaleString()}</span>
            <span>{item.auto_approved.toLocaleString()}</span>
            <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: '#607a8e' }}>{new Date(item.updated_at).toLocaleString()}</span>
          </button>
        )) : <div className="table-empty">No migrations found matching your criteria.</div>}
      </div>
    </section>
  )
}

function Mappings({ mappings, migration }: { mappings: Mapping[]; migration: Migration | null }) {
  const confClass = (a: string) => a.toLowerCase() === 'auto' ? 'auto' : a.toLowerCase() === 'review' ? 'review' : 'block'
  return (
    <section className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">EVIDENCE-FIRST SCHEMA MAPPING</span>
          <h2>Mapping studio</h2>
          <p>{migration ? `${mappings.length} field decisions for ${migration.name}` : 'Select a migration to inspect mappings.'}</p>
        </div>
        <div className="legend">
          <span><i className="dot green" /> Auto</span>
          <span><i className="dot amber" /> Review</span>
          <span><i className="dot red" /> Block</span>
        </div>
      </div>
      <div className="mapping-list">
        {mappings.map((m) => (
          <div className="mapping-card" key={m._id}>
            <div className="mapping-fields">
              <code>{m.source_field}</code>
              <ArrowRight size={16} />
              <strong>{m.target_field}</strong>
            </div>
            <span className={`confidence ${confClass(m.autonomy)}`}>{Math.round(m.confidence * 100)}% &middot; {m.autonomy}</span>
            <p>{m.reason}</p>
            <div className="evidence-row">
              {Object.entries(m.evidence).filter(([k]) => k !== 'weighted_score').slice(0, 4).map(([k, v]) => (
                <span key={k}>
                  <small>{k.replace('_', ' ')}</small>
                  <b>{Math.round(Number(v) * 100)}%</b>
                </span>
              ))}
            </div>
            <div className="mapping-foot">
              <span><Sparkles size={13} /> {m.transformation || 'Direct mapping'}</span>
              <span>{m.source_file}</span>
            </div>
          </div>
        ))}
        {!mappings.length && <div className="soft-empty centered">Mappings appear after a migration starts.</div>}
      </div>
    </section>
  )
}

function EscalationQueue({ items, migration, resolve }: { items: Escalation[]; migration: Migration | null; resolve: (i: Escalation, a: string) => void }) {
  const open = items.filter((i) => i.status === 'open')
  return (
    <section className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">HUMAN-IN-THE-LOOP</span>
          <h2>Escalation queue <span className="title-count">{open.length}</span></h2>
          <p>Only ambiguous, conflicting, or unsafe cases reach you. Resolutions resume the graph.</p>
        </div>
        <div className="queue-summary"><CircleAlert size={18} /><span><strong>{open.length}</strong> open review{open.length === 1 ? '' : 's'}</span></div>
      </div>
      {!migration ? (
        <div className="soft-empty centered">Create a migration to see review items.</div>
      ) : (
        <div className="escalation-grid">
          {items.map((item) => (
            <div className={`escalation-card ${item.status !== 'open' ? 'resolved' : ''}`} key={item._id}>
              <div className="card-top">
                <span className={`type-tag ${item.type}`}>{item.type.replace('_', ' ')}</span>
                <span className={`review-status ${item.status}`}>{item.status}</span>
              </div>
              <h3>{item.title}</h3>
              <div className="why-box">
                <span className="eyebrow">WHY AM I SEEING THIS?</span>
                <p>{item.why}</p>
              </div>
              <div className="detail-grid">
                <div><small>Source value</small><strong>{typeof item.source_value === 'object' ? JSON.stringify(item.source_value) : String(item.source_value || '\u2014')}</strong></div>
                <div><small>Target field</small><strong>{item.target_field || '\u2014'}</strong></div>
                <div><small>Confidence</small><strong>{item.confidence ? `${Math.round(item.confidence * 100)}%` : '\u2014'}</strong></div>
                <div><small>Source</small><strong>{item.source_file || 'reconciled record'}{item.source_row ? ` \u00b7 row ${item.source_row}` : ''}</strong></div>
              </div>
              <div className="candidate-row">
                <small>Candidates</small>
                {item.candidates.map((c) => <span key={c}>{c}</span>)}
              </div>
              <p className="recommended">
                <Sparkles size={14} />
                <span><strong>Recommended:</strong> {item.recommended_action || 'Review and select action'}</span>
              </p>
              {item.impact && (
                <p style={{ fontSize: '11px', color: '#71899d', margin: '8px 0 12px', lineHeight: 1.5 }}>
                  <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: '4px', color: COLORS.amber }} /> Impact: {item.impact}
                </p>
              )}
              <div className="escalation-actions">
                {item.status === 'open' ? (
                  <>
                    <button className="primary-button small" onClick={() => resolve(item, 'approve')}><CheckCircle2 size={13} /> Approve</button>
                    <button className="secondary-button small" onClick={() => resolve(item, 'correct')}><RefreshCw size={13} /> Correct</button>
                    <button className="ghost-button small" onClick={() => resolve(item, 'skip')}><X size={13} /> Skip</button>
                  </>
                ) : (
                  <span style={{ fontSize: '11px', color: '#6dd9c8', display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle2 size={13} /> Resolved</span>
                )}
              </div>
            </div>
          ))}
          {!items.length && <div className="soft-empty centered">Create a migration to see review items.</div>}
        </div>
      )}
    </section>
  )
}

function ExecutionView({ items, migration, retry, rollback }: { items: Execution[]; migration: Migration | null; retry: () => void; rollback: () => void }) {
  const failed = items.filter((i) => i.status === 'failed').length
  const total = (migration?.success_count || 0) + failed
  const pct = total > 0 ? ((migration?.success_count || 0) / total) * 100 : 0

  return (
    <section className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">TARGET OPERATIONS</span>
          <h2>Execution</h2>
          <p>Idempotent mutations, verification, and recovery for {migration?.name || 'your migration'}.</p>
        </div>
        <div className="button-row">
          <button className="secondary-button" onClick={rollback} disabled={!items.length}><RotateCcw size={14} /> Rollback batch</button>
          {failed > 0 && <button className="primary-button" onClick={retry}><RefreshCw size={14} /> Retry {failed} failed</button>}
        </div>
      </div>
      <div className="execution-banner">
        <div>
          <span className="eyebrow">BATCH HEALTH</span>
          <strong style={{ display: 'block', marginTop: '4px' }}>{migration?.success_count || 0} succeeded <i>&middot;</i> {failed} failed</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="progress-line"><span style={{ width: `${pct}%` }} /></div>
          <span className="muted-label">{migration?.status || 'not started'}</span>
        </div>
      </div>
      <div className="table-card">
        <div className="table-head execution-head">
          <span>Record</span><span>Operation</span><span>Status</span><span>Latency</span><span>Target</span>
        </div>
        {items.map((i) => (
          <div className="table-row execution-row" key={i._id}>
            <span><strong>{i.record_id.split(':').pop()}</strong><small>{i._id.slice(0, 9)}\u2026</small></span>
            <span className="operation"><Database size={13} />{i.operation}</span>
            <span className={`exec-status ${i.status}`}><i />{i.status}</span>
            <span style={{ fontFamily: 'DM Mono', fontSize: '11px', color: '#8ea7ba' }}>{i.latency_ms || 0} ms</span>
            <span style={{ fontSize: '11px', color: '#a4bcd0' }}>{i.target_id || i.error || '\u2014'}</span>
          </div>
        ))}
        {!items.length && <div className="table-empty">Execution records will appear after review is resolved.</div>}
      </div>
    </section>
  )
}

function AuditView({ items }: { items: AuditEvent[] }) {
  return (
    <section className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">LINEAGE & OBSERVABILITY</span>
          <h2>Audit log</h2>
          <p>Chronological events across the graph, policy gate, consultant, and target adapter.</p>
        </div>
        <span className="audit-count"><History size={15} /> {items.length} events</span>
      </div>
      <div className="table-card">
        {items.length ? (
          items.map((i) => (
            <div className="audit-item" key={i._id}>
              <div className="audit-line"><span className={`audit-dot ${i.status || 'success'}`} /></div>
              <div className="audit-content">
                <div>
                  <strong>{i.event_type.replaceAll('.', ' ')}</strong>
                  {i.status && <span className={`mini-status ${i.status}`}>{i.status}</span>}
                  {i.latency_ms && <span style={{ fontSize: '10px', color: '#5a7588', fontFamily: 'DM Mono', marginLeft: 'auto' }}>{i.latency_ms} ms</span>}
                </div>
                <p>{i.message || `${i.agent || 'system'} \u00b7 ${i.node || 'control plane'}${i.record_id ? ` \u00b7 ${i.record_id}` : ''}`}</p>
                <small>{new Date(i.timestamp).toLocaleString()}</small>
              </div>
            </div>
          ))
        ) : (
          <div className="soft-empty centered">The audit trail is empty for this migration.</div>
        )}
      </div>
    </section>
  )
}

const CANVAS_ORDER = ['profiler', 'mapper', 'reconciler', 'validator', 'decision_gate', 'executor', 'verifier', 'finalize']

interface CanvasNodeDef {
  id: string
  step: number
  title: string
  agent: string
  icon: typeof Activity
  desc: string
  note: string
  tools: string[]
  reads: string[]
  writes: string[]
  events: string[]
  link: { view: View; label: string }
  gate?: boolean
  human?: boolean
}

const CANVAS_NODES: CanvasNodeDef[] = [
  { id: 'profiler', step: 1, title: 'Profiler', agent: 'profiler', icon: Database,
    desc: 'Detects file types, inspects headers, and streams raw rows into PrivateContext and source_records.',
    note: 'Raw records never enter model context — only schema and samples leave the boundary.',
    tools: ['inspect_file', 'PrivateContext.put'], reads: ['files'], writes: ['files', 'source_records'],
    events: ['file.ingested', 'schema.profiled', 'agent.message'], link: { view: 'audit', label: 'View ingest events' } },
  { id: 'mapper', step: 2, title: 'Mapper', agent: 'mapper', icon: FileSpreadsheet,
    desc: 'Scores every source field against the Darwinbox schema with name, alias, semantic, sample, and type evidence.',
    note: 'AUTO ≥ 82% · REVIEW 72–81% · ambiguous status is forced to REVIEW. An LLM may enrich the reason, never the verdict.',
    tools: ['load_schema', 'LLM enrich (optional)'], reads: ['files', 'schema'], writes: ['schema', 'mappings'],
    events: ['mapping.created', 'agent.message'], link: { view: 'mappings', label: 'Open mapping studio' } },
  { id: 'reconciler', step: 3, title: 'Reconciler', agent: 'reconciler', icon: UsersRound,
    desc: 'Normalizes values, splits compound names, and merges duplicate identities across source systems.',
    note: 'Conflicting values from two systems and ambiguous status always escalate — never auto-merged.',
    tools: ['transform_value', 'identity_key'], reads: ['mappings', 'schema'], writes: ['normalized_records', 'open_escalations'],
    events: ['record.normalized', 'escalation.created', 'agent.message'], link: { view: 'escalations', label: 'Review conflicts' } },
  { id: 'validator', step: 4, title: 'Validator', agent: 'validator', icon: ShieldCheck,
    desc: 'Runs deterministic schema validation over every normalized record and flags anything unsafe to send.',
    note: 'Records with unresolved errors are marked needs_review and skipped by the executor.',
    tools: ['validate_record'], reads: ['normalized_records', 'schema'], writes: ['validation_errors', 'open_escalations'],
    events: ['validation.completed', 'escalation.created', 'agent.message'], link: { view: 'escalations', label: 'Review validation' } },
  { id: 'decision_gate', step: 5, title: 'Decision gate', agent: 'decision_gate', icon: GitFork,
    desc: 'Conditional branch: pauses for consultant review when escalations are open, otherwise proceeds to mutation.',
    note: 'The only branch in the graph. Resume path skips straight to executor — files are never re-ingested.',
    tools: ['escalation lookup'], reads: ['open_escalations'], writes: ['status'],
    events: ['decision.completed', 'agent.message'], link: { view: 'escalations', label: 'Open review queue' }, gate: true },
  { id: 'review_pause', step: 6, title: 'Human review', agent: 'consultant', icon: UserCheck,
    desc: 'Workflow pauses. The consultant approves, corrects, or skips each case; resolving the last item resumes the graph.',
    note: 'Resolutions can apply to similar cases and the graph resumes at execution.',
    tools: ['resolve API'], reads: ['open_escalations'], writes: ['status'],
    events: ['escalation.created', 'agent.message'], link: { view: 'escalations', label: 'Resolve now' }, human: true },
  { id: 'executor', step: 7, title: 'Executor', agent: 'executor', icon: Zap,
    desc: 'The only node with mutation tools. Creates or updates target records behind the policy gate.',
    note: 'policy.decide(create) can block · deterministic idempotency keys make every retry safe.',
    tools: ['mutation_payload', 'TargetAdapter', 'policy gate'], reads: ['normalized_records'], writes: ['execution_ids'],
    events: ['execution.started', 'execution.success', 'execution.failed', 'execution.blocked', 'execution.paused', 'agent.message'],
    link: { view: 'execution', label: 'Open execution' } },
  { id: 'verifier', step: 8, title: 'Verifier', agent: 'verifier', icon: CheckCircle2,
    desc: 'Reads back every successfully written target record to confirm the mutation landed.',
    note: 'Verification failures are recorded without mutating anything further.',
    tools: ['TargetAdapter.verify'], reads: ['execution_ids'], writes: [],
    events: ['record.verified', 'verification.failed', 'agent.message'], link: { view: 'execution', label: 'Open execution' } },
  { id: 'finalize', step: 9, title: 'Finalize', agent: 'control_plane', icon: Flag,
    desc: 'Computes the terminal state — completed, failed, or back to review — and closes the run.',
    note: 'Terminal states: completed · failed · review.',
    tools: ['status writer'], reads: ['execution_ids', 'open_escalations'], writes: ['status'],
    events: ['migration.completed', 'migration.paused', 'agent.message'], link: { view: 'audit', label: 'View audit trail' } },
]

const CANVAS_X: Record<string, number> = { profiler: 20, mapper: 196, reconciler: 372, validator: 548, decision_gate: 724, executor: 900, verifier: 1076, finalize: 1252 }
const LANE_Y = 285
const NODE_W = 150
const NODE_TOP = 225
const REVIEW_X = 704
const REVIEW_Y = 70
const REVIEW_W = 190
const REVIEW_H = 96

function AgentCanvas({ migration, mappings, escalations, executions, audit, setView }: {
  migration: Migration | null; mappings: Mapping[]; escalations: Escalation[]; executions: Execution[];
  audit: AuditEvent[]; setView: (view: View) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [simulationMode, setSimulationMode] = useState(false)
  const [simulationIndex, setSimulationIndex] = useState(0)
  const simulationMessages = [
    { from: 'Profiler', to: 'Mapper', text: 'Schema profile ready. 4 files and 20 source rows are available through private references.' },
    { from: 'Mapper', to: 'Reconciler', text: 'Mapping evidence is complete. 25 decisions are AUTO; generic status stays REVIEW.' },
    { from: 'Reconciler', to: 'Validator', text: 'Strong employee identity matches found. Finance vs Operations is held for review.' },
    { from: 'Decision gate', to: 'Consultant', text: 'Two human decisions are required before any target mutation is allowed.' },
    { from: 'Consultant', to: 'Executor', text: 'Review resolved. Resume from executor; ingestion and mapping checkpoints remain intact.' },
    { from: 'Executor', to: 'Verifier', text: 'Idempotent mutation batch submitted. Read-back verification is next.' },
  ]

  useEffect(() => {
    if (!simulationMode) return
    const timer = window.setInterval(() => setSimulationIndex((current) => (current + 1) % simulationMessages.length), 1800)
    return () => window.clearInterval(timer)
  }, [simulationMode, simulationMessages.length])

  if (!migration) {
    return (
      <section className="page-content">
        <div className="page-intro">
          <div>
            <span className="eyebrow">LANGGRAPH WORKFLOW</span>
            <h2>Agent canvas</h2>
            <p>Start a migration to watch the agent traverse the graph.</p>
          </div>
        </div>
        <div className="soft-empty centered">Create a demo migration from Overview to activate the canvas.</div>
      </section>
    )
  }

  const openItems = escalations.filter((e) => e.status === 'open')
  const activeNode = migration.current_node || ''
  const isReview = migration.status === 'review' || activeNode === 'review'
  const doneAll = migration.status === 'completed'
  const failedRun = migration.status === 'failed'
  const activeIdx = CANVAS_ORDER.indexOf(activeNode)

  const eventCount = (nodeId: string, eventType: string) =>
    audit.filter((a) => a.event_type === eventType && (!a.node || a.node === nodeId)).length
  const escType = (t: string) => escalations.filter((e) => e.type === t).length
  const autoDecisions = mappings.filter((m) => m.autonomy.toUpperCase() === 'AUTO').length
  const verified = eventCount('verifier', 'record.verified')
  const liveCommunications = audit.slice(0, 12).map((event) => ({
    from: event.agent || event.node || 'control plane',
    to: typeof event.metadata?.to_agent === 'string' ? event.metadata.to_agent : event.event_type === 'escalation.created' ? 'consultant' : event.node === 'verifier' ? 'target adapter' : 'next node',
    text: event.message || `${event.event_type.replaceAll('.', ' ')} completed${event.record_id ? ` for ${event.record_id.split(':').pop()}` : ''}.`,
    status: event.status || 'success',
    timestamp: event.timestamp,
    live: true,
  }))
  const communications = simulationMode
    ? simulationMessages.slice(0, simulationIndex + 1).map((message) => ({ ...message, status: 'simulation', timestamp: new Date().toISOString(), live: false }))
    : liveCommunications

  const nodeStat = (id: string): string => {
    switch (id) {
      case 'profiler': return `${migration.files_count} files · ${migration.records_processed} rows`
      case 'mapper': return `${mappings.length} decisions · ${autoDecisions} auto`
      case 'reconciler': return `${migration.records_processed} rows · ${escType('conflicting_source')} conflicts`
      case 'validator': return `${escType('validation_error')} flagged for review`
      case 'decision_gate': return openItems.length ? `${openItems.length} open — branch to review` : 'clear — branch to execute'
      case 'review_pause': return openItems.length ? `${openItems.length} awaiting consultant` : 'no pending reviews'
      case 'executor': return `${migration.success_count} ok · ${migration.failed_count} failed`
      case 'verifier': return `${verified} records verified`
      case 'finalize': return `status · ${migration.status.replace('_', ' ')}`
      default: return ''
    }
  }

  const nodeStatus = (id: string): string => {
    if (id === 'review_pause') {
      if (isReview) return 'attention'
      if (doneAll || failedRun || activeIdx > 4) return 'done'
      return 'pending'
    }
    if (isReview) return CANVAS_ORDER.indexOf(id) <= 4 ? 'done' : 'pending'
    if (doneAll) return 'done'
    if (failedRun) {
      if (id === 'finalize') return 'failed'
      return CANVAS_ORDER.indexOf(id) <= 5 ? 'done' : 'pending'
    }
    const idx = CANVAS_ORDER.indexOf(id)
    if (activeIdx < 0) return 'pending'
    if (idx < activeIdx) return 'done'
    if (idx === activeIdx) return 'current'
    return 'pending'
  }

  const edgeStatus = (toIdx: number): string => {
    if (doneAll) return 'done'
    if (failedRun) return toIdx <= 5 ? 'done' : 'pending'
    if (isReview) return toIdx <= 4 ? 'done' : 'pending'
    if (activeIdx < 0) return 'pending'
    if (toIdx < activeIdx) return 'done'
    if (toIdx === activeIdx) return 'active'
    return 'pending'
  }

  const reviewEdge = isReview ? 'active-amber' : (doneAll || failedRun || activeIdx > 4) ? 'done' : 'pending'
  const resumeEdge = edgeStatus(5) === 'done' ? 'done' : edgeStatus(5) === 'active' ? 'active' : 'pending'

  const activeKey = selected || (isReview ? 'review_pause' : activeIdx >= 0 ? CANVAS_ORDER[activeIdx] : 'profiler')
  const activeDef = CANVAS_NODES.find((n) => n.id === activeKey) || CANVAS_NODES[0]
  const doneCount = CANVAS_NODES.filter((n) => nodeStatus(n.id) === 'done').length

  const pairs: [string, string][] = [
    ['profiler', 'mapper'], ['mapper', 'reconciler'], ['reconciler', 'validator'],
    ['validator', 'decision_gate'], ['decision_gate', 'executor'], ['executor', 'verifier'], ['verifier', 'finalize'],
  ]

  return (
    <section className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">LANGGRAPH WORKFLOW · GOVERNED AUTONOMY</span>
          <h2>Live agent graph <span className="title-count">{doneCount}/{CANVAS_NODES.length}</span></h2>
          <p>Every node the migration agent traverses — its tools, the state it reads and writes, and the events it emits. Click a node to inspect it.</p>
        </div>
        <div className="legend">
          <span><i className="dot green" /> Done</span>
          <span><i className="dot amber" /> Review path</span>
          <span><i className="dot red" /> Blocked</span>
          <span className="live-label"><i /> live</span>
        </div>
      </div>

      <div className="canvas-panel">
        <div className="section-heading">
          <div><span className="eyebrow">GRAPH TOPOLOGY</span><h3>{migration.name}</h3></div>
          <span className={`status-pill compact ${migration.status}`}><i />{migration.status.replace('_', ' ')}</span>
        </div>
        <pre className="graph-def">profiler → mapper → reconciler → validator → decision_gate ─┬─ review_pause → resume at executor
                                                            └─ executor → verifier → finalize</pre>
        <div className="canvas-scroll">
          <div className="canvas-inner">
            <svg className="canvas-edges" width="1420" height="470" viewBox="0 0 1420 470">
              <defs>
                <marker id="arr-done" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="#4ecdc4" />
                </marker>
                <marker id="arr-pend" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="#3a5268" />
                </marker>
                <marker id="arr-amber" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="#fbb344" />
                </marker>
              </defs>
              {pairs.map(([from, to]) => {
                const st = to === 'executor' && isReview ? 'pending' : edgeStatus(CANVAS_ORDER.indexOf(to))
                const x1 = CANVAS_X[from] + NODE_W
                const x2 = CANVAS_X[to] - 3
                const marker = st === 'pending' ? 'url(#arr-pend)' : 'url(#arr-done)'
                return <line key={`${from}-${to}`} x1={x1} y1={LANE_Y} x2={x2} y2={LANE_Y} className={`cedge ${st}`} markerEnd={marker} />
              })}
              <line x1="799" y1={NODE_TOP} x2="799" y2={REVIEW_Y + REVIEW_H + 4} className={`cedge dashed ${reviewEdge}`} markerEnd={reviewEdge === 'active-amber' ? 'url(#arr-amber)' : reviewEdge === 'done' ? 'url(#arr-done)' : 'url(#arr-pend)'} />
              <path d={`M ${REVIEW_X + REVIEW_W} ${REVIEW_Y + REVIEW_H / 2} H 975 V ${NODE_TOP - 4}`} fill="none" className={`cedge dashed ${resumeEdge}`} markerEnd={resumeEdge === 'pending' ? 'url(#arr-pend)' : 'url(#arr-done)'} />
              <text x="809" y="198" className="edge-label amber">review</text>
              <text x="928" y="108" className="edge-label">resume</text>
              <text x="879" y="308" className="edge-label">execute</text>
            </svg>
            {CANVAS_NODES.filter((n) => n.id !== 'review_pause').map((def) => {
              const Icon = def.icon
              const st = nodeStatus(def.id)
              const isSel = activeKey === def.id
              return (
                <button
                  key={def.id}
                  className={`cnode ${st} ${def.gate ? 'gate' : ''} ${isSel ? 'selected' : ''}`}
                  style={{ left: CANVAS_X[def.id], top: NODE_TOP }}
                  onClick={() => setSelected(def.id)}
                >
                  <div className="cnode-head">
                    <span className="cnode-num">0{def.step}</span>
                    <span className={`cnode-dot ${st}`} />
                  </div>
                  <div className="cnode-title"><Icon size={14} /> {def.title}</div>
                  <div className="cnode-agent">agent · {def.agent}</div>
                  <div className="cnode-stat">{nodeStat(def.id)}</div>
                </button>
              )
            })}
            {(() => {
              const def = CANVAS_NODES.find((n) => n.id === 'review_pause')!
              const Icon = def.icon
              const st = nodeStatus(def.id)
              const isSel = activeKey === def.id
              return (
                <button
                  className={`cnode human ${st} ${isSel ? 'selected' : ''}`}
                  style={{ left: REVIEW_X, top: REVIEW_Y, width: REVIEW_W }}
                  onClick={() => setSelected(def.id)}
                >
                  <div className="cnode-head">
                    <span className="cnode-num">06</span>
                    <span className={`cnode-dot ${st}`} />
                  </div>
                  <div className="cnode-title"><Icon size={14} /> {def.title}</div>
                  <div className="cnode-stat">{nodeStat(def.id)}</div>
                </button>
              )
            })()}
          </div>
        </div>
      </div>

      <div className="canvas-detail">
        <div className="cd-main">
          <div className="section-heading">
            <div><span className="eyebrow">NODE INSPECTOR</span><h3>{activeDef.title}</h3></div>
            <span className={`status-pill compact ${nodeStatus(activeDef.id) === 'failed' ? 'failed' : nodeStatus(activeDef.id) === 'attention' ? 'review' : nodeStatus(activeDef.id) === 'pending' ? 'draft' : ''}`}>
              <i />{nodeStatus(activeDef.id)}
            </span>
          </div>
          <p className="cd-desc">{activeDef.desc}</p>
          <p className="cd-note">{activeDef.note}</p>
          <div className="cd-block">
            <small>Agent</small>
            <strong>agent · {activeDef.agent}</strong>
          </div>
          <div className="cd-block">
            <small>Tools this node may call</small>
            <div className="chip-row">{activeDef.tools.map((t) => <span className="tool-chip" key={t}>{t}</span>)}</div>
          </div>
          <div className="cd-cols">
            <div className="cd-block">
              <small>Reads state</small>
              <div className="chip-row">{activeDef.reads.map((t) => <span className="state-chip read" key={t}>{t}</span>)}</div>
            </div>
            <div className="cd-block">
              <small>Writes state</small>
              <div className="chip-row">
                {activeDef.writes.length ? activeDef.writes.map((t) => <span className="state-chip write" key={t}>{t}</span>) : <span className="state-chip">read-only</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="cd-side">
          <div className="section-heading">
            <div><span className="eyebrow">EMITTED EVENTS</span><h3>Live counts</h3></div>
          </div>
          <div className="evt-list">
            {activeDef.events.map((ev) => (
              <div className="evt-row" key={ev}>
                <span>{ev}</span>
                <b>{eventCount(activeDef.id, ev)}</b>
              </div>
            ))}
          </div>
          <button className="secondary-button small" onClick={() => setView(activeDef.link.view)} style={{ marginTop: '14px' }}>
            {activeDef.link.label} <ArrowRight size={13} />
          </button>
        </div>
      </div>

      <div className="communications-grid">
        <section className="communications-panel">
          <div className="section-heading">
            <div><span className="eyebrow">AGENT-TO-AGENT TRACE</span><h3>Live communications</h3></div>
            <span className={`trace-mode ${simulationMode ? 'simulation' : 'live'}`}><i /> {simulationMode ? 'simulation' : 'live stream'}</span>
          </div>
          <div className="trace-intro"><Radio size={15} /><span>Messages are derived from the persisted audit stream. Each handoff shows the state contract between workflow steps.</span></div>
          <div className="communication-list">
            {communications.length ? communications.map((message, index) => (
              <div className={`communication-row ${message.status}`} key={`${message.timestamp}-${index}`}>
                <div className="communication-avatar"><Bot size={14} /></div>
                <div className="communication-body">
                  <div className="communication-route"><strong>{message.from}</strong><ArrowDown size={12} /><strong>{message.to}</strong><span>{message.live ? 'audit event' : 'scenario'}</span></div>
                  <p>{message.text}</p>
                </div>
                <time>{message.live ? new Date(message.timestamp).toLocaleTimeString() : 'now'}</time>
              </div>
            )) : <div className="soft-empty"><MessageSquare size={18} /><span>Start a migration to see real handoffs between agents here.</span></div>}
          </div>
        </section>
        <section className="simulation-panel">
          <div className="section-heading">
            <div><span className="eyebrow">SAFE REHEARSAL</span><h3>Simulation lab</h3></div>
            <PlayCircle size={18} style={{ color: 'var(--blue)' }} />
          </div>
          <p>Walk the governed path without calling the target API. This makes the autonomy boundary easy to review before a customer cutover.</p>
          <div className="simulation-path">
            {simulationMessages.slice(0, 4).map((message, index) => <div className={`simulation-step ${simulationMode && index <= simulationIndex ? 'active' : ''}`} key={message.from}><span>{index + 1}</span><div><strong>{message.from}</strong><small>{message.to}</small></div>{index < 3 && <div className="simulation-line" />}</div>)}
          </div>
          <button className="secondary-button simulation-button" onClick={() => { setSimulationMode((current) => !current); setSimulationIndex(0) }}>
            {simulationMode ? <PauseCircle size={15} /> : <PlayCircle size={15} />}{simulationMode ? 'Pause simulation' : 'Run safe simulation'}
          </button>
          <div className="simulation-note"><ShieldCheck size={14} /><span>No files, credentials, or mutations are used in simulation mode.</span></div>
        </section>
      </div>
    </section>
  )
}

function SettingsView() {
  const settings = [
    { icon: Database, title: 'Target provider', desc: 'Mutations are routed through a provider-neutral adapter.', values: [{ label: 'Current provider', value: <><strong>MOCK</strong> <small>demo</small></> }, { label: 'Fallback', value: 'Darwinbox MCP / REST' }] },
    { icon: ShieldCheck, title: 'Governed autonomy', desc: 'Credentials and full raw records are never placed in model context.', values: [{ label: 'Auto threshold', value: '82%' }, { label: 'Review threshold', value: '72\u201381%' }] },
    { icon: Clock3, title: 'Reliability', desc: 'Safe operations carry deterministic idempotency keys and retain before/after state.', values: [{ label: 'Retry policy', value: 'Exponential \u00b7 3 attempts' }, { label: 'Failure simulation', value: <><strong>EMP005</strong> <small>once</small></> }] },
  ]
  return (
    <section className="page-content">
      <div className="page-intro">
        <div>
          <span className="eyebrow">CONTROL PLANE CONFIGURATION</span>
          <h2>Settings</h2>
          <p>Provider boundaries and autonomy thresholds for this workspace.</p>
        </div>
      </div>
      <div className="settings-grid">
        {settings.map((s, i) => (
          <div className="settings-card" key={i}>
            <div className="settings-icon"><s.icon size={18} /></div>
            <h3>{s.title}</h3>
            <p>{s.desc}</p>
            {s.values.map((v, vi) => (
              <div className="setting-value" key={vi}>
                <span>{v.label}</span>
                <strong>{v.value}</strong>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

export default App
