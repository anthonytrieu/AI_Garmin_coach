import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTracking } from '@/components/tracking-provider'
import { exercise, freshExercise, rotation, today, uid } from '@/lib/tracking'
import type { Template, Row } from '@/lib/tracking'
import { Card, Empty, Page } from './shared'

export default function Train() {
  const t = useTracking(), navigate = useNavigate(), [group, setGroup] = useState(''), [name, setName] = useState(''), [custom, setCustom] = useState(false), [message, setMessage] = useState('')
  const templates = t.rows('template'), next = templates.find(r => r.id === rotation[t.snapshot.position])
  function start(template: Row<'template'>) {
    if (t.draft) { navigate('/workout'); return }
    const data = template.data!
    try { t.editDraft(uid(), { name: data.name, templateId: template.id, date: today(), status: 'draft', rotationPosition: template.id === rotation[t.snapshot.position] ? t.snapshot.position : null, exercises: data.exercises.map(e => freshExercise(e, t.rows('workout'))) }); navigate('/workout') } catch (e) { setMessage(String(e)) }
  }
  return <Page title="Train"><p className="track-muted">Choose your focus. Rest days stay flexible.</p>{message && <p role="alert">{message}</p>}
    {t.draft ? <Card><h2>{t.draft.data.name} in progress</h2><Link className="track-button primary" to="/workout">Resume workout</Link></Card> : next && <Card><small>Next in rotation · {t.snapshot.position + 1} of 6</small><h2>{next.data!.name}</h2><button className="primary" onClick={() => setGroup(next.data!.group)}>Preview workout</button></Card>}
    <div className="track-row">{(['Upper', 'Arms', 'Legs', 'Custom'] as Template['group'][]).map(g => <button key={g} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>)}</div>
    {group && templates.filter(r => r.data!.group === group).map(row => <Card key={row.id}><h2>{row.data!.name}</h2><p className="track-muted">{row.data!.exercises.reduce((n, e) => n + e.sets.length, 0)} working sets</p>{row.data!.exercises.map((e, i) => <div className="track-list" key={i}><span>{e.name}</span><span>{e.sets.length} × {e.targetMin}–{e.targetMax}</span></div>)}<button className="primary wide" disabled={t.loading} onClick={() => start(row)}>{t.draft ? 'Resume current draft' : `Start ${row.data!.name}`}</button></Card>)}
    {!templates.length && !t.loading && <Empty>No saved templates yet. Create a workout below. Private templates can be provisioned by the owner.</Empty>}
    <button className="wide" onClick={() => setCustom(!custom)}>＋ Create workout</button>
    {custom && <Card><form onSubmit={e => { e.preventDefault(); if (t.draft) { navigate('/workout'); return } try { t.editDraft(uid(), { name: name.trim(), templateId: null, rotationPosition: null, status: 'draft', date: today(), exercises: [exercise('New exercise')] }); navigate('/workout') } catch (err) { setMessage(String(err)) } }}><label>Workout name<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="My workout" /></label><p className="track-muted">Add exercises and adjust sets in the logger. Save as a template separately.</p><button className="primary">Create draft</button></form></Card>}
    <details><summary>Your rotation</summary><p>Upper A → Arms A → Legs → Upper B → Arms B → Legs</p><small>Only finishing the suggested session advances the rotation.</small><label>Manually choose the next rotation position<select value={t.snapshot.position} onChange={async e => { try { await t.save('rotation', 'current', { position: +e.target.value }) } catch (err) { setMessage(String(err)) } }}>{['Upper A', 'Arms A', 'Legs → Upper B next', 'Upper B', 'Arms B', 'Legs → Upper A next'].map((name, i) => <option key={i} value={i}>{i + 1}. {name}</option>)}</select></label></details>
    <Card><h2>Cycling tools</h2><div className="track-row"><Link to="/cycling">Ride dashboard</Link><Link to="/plan">Cycling plan</Link><Link to="/fuel">Fuel planner</Link></div></Card>
  </Page>
}
