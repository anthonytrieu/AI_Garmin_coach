import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTracking } from '@/components/tracking-provider'
import { dayOffset, freshExercise, rotation, today, uid, weekStart } from '@/lib/tracking'
import type { Row } from '@/lib/tracking'
import { Card, Empty, Page } from './tracking/shared'

export default function Schedule() {
  const t = useTracking(), navigate = useNavigate()
  const [week, setWeek] = useState(() => weekStart(today())), [date, setDate] = useState(today), [templateId, setTemplateId] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [newId, setNewId] = useState(uid)
  const templates = t.rows('template'), history = t.rows('workout')
  const days = Array.from({ length: 7 }, (_, i) => dayOffset(week, i))
  async function add(e: React.FormEvent) {
    e.preventDefault(); const template = templates.find(r => r.id === templateId); if (!template) return
    setBusy(true); setError('')
    try { await t.save('schedule', newId, { date, templateId, name: template.data!.name, rotationPosition: templateId === rotation[t.snapshot.position] ? t.snapshot.position : null }); setNewId(uid()) } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  function start(row: Row<'schedule'>) {
    if (t.draft) { navigate('/workout'); return }
    const template = templates.find(r => r.id === row.data!.templateId)
    if (!template) { setError('This template is unavailable. Choose another template for this session.'); return }
    try { t.editDraft(uid(), { name: row.data!.name, templateId: template.id, scheduleId: row.id, date: today(), status: 'draft', rotationPosition: template.id === rotation[t.snapshot.position] ? t.snapshot.position : null, exercises: template.data!.exercises.map(e => freshExercise(e, history)) }); navigate('/workout') } catch (e) { setError(String(e)) }
  }
  return <Page title="Gym schedule"><p className="track-muted">Plan your lifting days. Rest days stay flexible.</p><div className="track-row between"><button onClick={() => setWeek(dayOffset(week, -7))}>‹ Previous</button><button onClick={() => setWeek(weekStart(today()))}>This week</button><button onClick={() => setWeek(dayOffset(week, 7))}>Next ›</button></div><p>{week} – {dayOffset(week, 6)}</p>
    <Card><h2>Plan a workout</h2><form onSubmit={add}><fieldset disabled={busy || t.loading}><label>Workout<select aria-label="Workout" required value={templateId} onChange={e => setTemplateId(e.target.value)}><option value="">Choose a template</option>{templates.map(r => <option key={r.id} value={r.id}>{r.data!.name}</option>)}</select></label><label>Day<input required type="date" value={date} onChange={e => setDate(e.target.value)} /></label><button className="primary">{busy ? 'Saving…' : 'Add to schedule'}</button></fieldset></form>{!templates.length && <Link to="/train">Create a workout in Train →</Link>}<small>Planning does not complete a workout or advance the rotation.</small></Card>
    {error && <p role="alert">{error}</p>}
    {days.map(day => { const plans = t.rows('schedule').filter(r => r.data!.date === day); const completed = history.filter(r => r.data!.status === 'completed' && r.data!.date === day); return <Card key={day}><div className="track-row between"><h2>{new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h2>{day === today() && <small>Today</small>}</div>{!plans.length && !completed.length && <Empty>Rest or unplanned</Empty>}{plans.map(r => { const finished = history.some(w => w.data!.status === 'completed' && w.data!.scheduleId === r.id); return <div key={r.id} className="track-history"><h3>{r.data!.name}</h3><p className="track-muted">{finished ? 'Completed · see workout history' : 'Planned'}</p>{!finished && <><button className="primary" onClick={() => start(r)}>{t.draft ? 'Resume current workout' : 'Start workout'}</button><label>Reschedule<input type="date" aria-label={`Reschedule ${r.data!.name}`} value={r.data!.date} onChange={async e => { if (!e.target.value) return; try { await t.save('schedule', r.id, { ...r.data!, date: e.target.value }) } catch (err) { setError(String(err)) } }} /></label><button onClick={async () => { try { await t.save('schedule', r.id, null) } catch (err) { setError(String(err)) } }}>Remove from plan</button></>}</div> })}{completed.map(r => <div className="track-list" key={r.id}><span>✓ {r.data!.name}</span><Link to="/progress">History</Link></div>)}</Card> })}
    <details><summary>Previous cycling schedule</summary><p className="track-muted">Your old cycling assignments remain available separately.</p><Link to="/cycling-schedule">Open cycling schedule →</Link></details>
  </Page>
}
