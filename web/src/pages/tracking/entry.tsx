import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTracking } from '@/components/tracking-provider'
import { today, uid } from '@/lib/tracking'
import type { BikeRide, Meal, Weight } from '@/lib/tracking'
import { Back, Card, Page } from './shared'

function EntryForm() {
  const { kind, id } = useParams(), [params] = useSearchParams(), t = useTracking(), navigate = useNavigate()
  const existing = t.snapshot.records.find(r => r.kind === kind && r.id === id)
  const repeat = kind === 'meal' ? t.rows('meal').find(r => r.id === params.get('repeat')) : undefined
  const [initial] = useState(() => (existing?.data ?? repeat?.data) as Partial<Meal & Weight & BikeRide> | undefined)
  const [newId] = useState(uid), [date, setDate] = useState(existing?.data && 'date' in existing.data ? existing.data.date : today()), [name, setName] = useState(initial?.name ?? ''), [time, setTime] = useState(initial?.time ?? '12:00'), [calories, setCalories] = useState(initial?.calories == null ? '' : String(initial.calories * (initial.servings ?? 1))), [protein, setProtein] = useState(initial?.protein == null ? '' : String(initial.protein * (initial.servings ?? 1))), [value, setValue] = useState((initial?.pounds ?? initial?.minutes)?.toString() ?? ''), [note, setNote] = useState(initial?.note ?? ''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [deleted, setDeleted] = useState(false)
  if (!['meal', 'weight', 'ride'].includes(kind ?? '')) return <Page title="Entry not found"><Back to="/">Today</Back></Page>
  const weightExisting = kind === 'weight' ? t.rows('weight').find(r => r.id === date) : undefined
  const numberOrNull = (s: string) => s === '' ? null : Number(s)
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      if (kind === 'meal') await t.save('meal', id ?? newId, { name: name.trim() || 'Quick calories', date, time, calories: +calories, protein: numberOrNull(protein), carbs: initial?.carbs == null ? null : initial.carbs * (initial.servings ?? 1), fat: initial?.fat == null ? null : initial.fat * (initial.servings ?? 1), servings: 1, favourite: initial?.favourite ?? false })
      if (kind === 'ride') await t.save('ride', id ?? newId, { date, minutes: +value, note, source: 'manual', externalId: null })
      if (kind === 'weight') await t.save('weight', date, { date, pounds: +value, note })
      navigate(kind === 'meal' ? '/food' : '/')
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed; your entry is still here.') } finally { setBusy(false) }
  }
  async function remove(undo: boolean) {
    if (!id || !existing) return; setBusy(true)
    try {
      if (kind === 'meal') await t.save('meal', id, undo ? initial as Meal : null)
      if (kind === 'weight') await t.save('weight', id, undo ? initial as Weight : null)
      if (kind === 'ride') await t.save('ride', id, undo ? initial as BikeRide : null)
      setDeleted(!undo)
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  return <Page title={`${id ? 'Edit' : 'Add'} ${kind === 'ride' ? 'bike ride' : kind}`}><Back to="/">Today</Back>{error && <p role="alert">{error}</p>}{deleted ? <Card><p>Entry deleted.</p><button disabled={busy} onClick={() => void remove(true)}>Undo deletion</button><Link className="track-button" to="/">Done</Link></Card> : <form onSubmit={save}>
    <fieldset disabled={busy || t.loading}>
    {kind === 'meal' && <><label>Meal name (optional)<input maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Meal, snack or drink" /></label><details><summary>Recent meals</summary>{t.rows('meal').sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 10).map(r => <button type="button" className="wide" key={r.id} onClick={() => { const m = r.data!; setName(m.name); setCalories(String(m.calories * m.servings)); setProtein(m.protein === null ? '' : String(m.protein * m.servings)) }}>{r.data!.name}</button>)}</details></>}
    <div className="track-columns"><label>Date<input required type="date" value={date} disabled={kind === 'weight' && !!id} onChange={e => setDate(e.target.value)} /></label>{kind === 'meal' && <label>Time<input required type="time" value={time} onChange={e => setTime(e.target.value)} /></label>}</div>
    {kind === 'meal' ? <><Card><h2>Nutrition for what you ate</h2><div className="track-columns"><label>Calories<input required type="number" min="0" max="100000" step="any" inputMode="decimal" value={calories} onChange={e => setCalories(e.target.value)} /></label><label>Protein · g<input type="number" min="0" max="100000" step="any" inputMode="decimal" value={protein} placeholder="Unknown" onChange={e => setProtein(e.target.value)} /></label></div><small>Leave protein blank if unknown.</small></Card></> : <><label>{kind === 'weight' ? 'Weight · pounds' : 'Bike minutes'}<input required type="number" min="0.1" max={kind === 'weight' ? 2000 : 1440} step="any" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} /></label><label>Note (optional)<textarea maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label>{weightExisting && !id && <p role="status">A weigh-in already exists for this date: {weightExisting.data!.pounds} lb. Save will edit that entry.</p>}</>}
    <button className="primary wide">{busy ? 'Saving…' : weightExisting ? 'Save edited weight' : 'Save entry'}</button>{id && <button type="button" onClick={() => void remove(false)}>Delete entry</button>}
    </fieldset>
  </form>}</Page>
}

export default function Entry() { const t = useTracking(); if (t.loading || t.error) return <Page title="Entry"><p>Load records before editing an entry.</p></Page>; return <EntryForm /> }
