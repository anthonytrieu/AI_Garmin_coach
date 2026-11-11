import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEMO } from '@/lib/mode'
import { useTracking } from '@/components/tracking-provider'
import { blankSet, exercise, today, uid } from '@/lib/tracking'
import type { Workout, Weight, Meal, BikeRide } from '@/lib/tracking'
import { Back, Card, Page } from './shared'

type ImportData = Workout | Weight | Meal | BikeRide | { date: string; text: string }
type Candidate = { kind: 'workout' | 'weight' | 'meal' | 'ride' | 'note'; data: ImportData; source: string; warnings: string[]; selected: boolean }
type Preview = { items: Candidate[]; unresolved: string[] }
const cacheKey = 'owner-import-review-v1'
const example = 'October 12\nUpper A\nExample press 25 for 10, 8\n\nOctober 13\nArms B\nExample curl 15 for 10, 7?'
function load() { if (DEMO) return null; try { return JSON.parse(localStorage.getItem(cacheKey) ?? 'null') as { text: string; year: number; mode: 'notes' | 'csv'; preview: Preview | null } | null } catch { return null } }
class ImportError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status } }
async function request(path: string, body: unknown) {
  const res = await fetch('/api/tracking-import/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new ImportError(res.status, typeof err.detail === 'string' ? err.detail : `Import failed (${res.status}); your source is preserved.`) }
  return res.json()
}
export default function ImportHistory() {
  const t = useTracking(), [saved] = useState(load), [text, setText] = useState(saved?.text ?? (DEMO ? example : '')), [year, setYear] = useState(saved?.year ?? Number(today().slice(0, 4))), [mode, setMode] = useState<'notes' | 'csv'>(saved?.mode ?? 'notes'), [preview, setPreview] = useState<Preview | null>(saved?.preview ?? null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState(''), [pending, setPending] = useState<{ mutationId: string; items: Candidate[] } | null>(null)
  useEffect(() => { if (DEMO) return; try { localStorage.setItem(cacheKey, JSON.stringify({ text, year, mode, preview })) } catch { setError('Could not retain import draft on this device. Keep this page open.') } }, [text, year, mode, preview])
  async function parse(ai = false) {
    setBusy(true); setError(''); setResult(''); setPending(null)
    try {
      let value: Preview
      if (DEMO) {
        const e = exercise('Example press'); e.sets = [10, 8].map(reps => ({ ...blankSet(), weight: 25, reps, done: true }))
        value = { items: [{ kind: 'workout', data: { name: 'Upper A', templateId: 'upper-a', rotationPosition: null, date: '2026-10-12', status: 'completed', exercises: [e], notes: example }, source: example.split('\n\n')[0]!, warnings: [], selected: true }, { kind: 'weight', data: { date: '2026-10-13', pounds: 175, note: 'Synthetic example' }, source: '175, October 13', warnings: [], selected: true }], unresolved: ['Example curl: 7? retained for review; not counted as completed.'] }
      } else value = await request('preview', { text, year, mode: ai ? 'ai' : mode })
      value.items = value.items.map(i => ({ ...i, selected: !!i.data.date && i.warnings.length === 0 }))
      setPreview(value)
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  function update(index: number, patch: Partial<Candidate>) { if (pending) return; setPreview(p => p && ({ ...p, items: p.items.map((item, i) => i === index ? { ...item, ...patch } : item) })) }
  async function commit() {
    if (!preview) return; setBusy(true); setError('')
    const batch = pending ?? { mutationId: uid(), items: preview.items.filter(i => i.selected) }
    setPending(batch)
    try {
      let count: number, skipped: number
      if (DEMO) {
        count = 0; skipped = 0
        for (let i = 0; i < batch.items.length; i++) {
          const item = batch.items[i]!, id = item.kind === 'weight' ? item.data.date : `demo-import-${i}`
          if (t.snapshot.records.some(r => r.kind === item.kind && r.id === id)) { skipped++; continue }
          if (item.kind === 'weight') await t.save('weight', id, item.data as Weight)
          if (item.kind === 'workout') await t.save('workout', id, { ...item.data as Workout, rotationPosition: null })
          count++
        }
      } else {
        const reply = await request('commit', { mutationId: batch.mutationId, items: batch.items.map(({ selected: _selected, ...i }) => i) })
        count = reply.saved.length; skipped = reply.skipped.length; await t.reload()
      }
      setResult(`${count} records saved. ${skipped} existing dates/duplicates kept unchanged.`); setPending(null); setPreview(null)
    } catch (e) { if (e instanceof ImportError && e.status === 422) setPending(null); setError(String(e)) } finally { setBusy(false) }
  }
  return <Page title="Import past logs"><Back to="/coach">Coach</Back><p>Paste workout notes or select a weight CSV. Review the extracted entries, then save the batch.</p>{DEMO && <p className="track-muted">Demo uses synthetic examples only. Import personal notes in the private app.</p>}{error && <p role="alert">{error}</p>}{result && <Card><p role="status">{result}</p><Link to="/progress">View Progress →</Link></Card>}
    <fieldset disabled={busy || !!pending}><div className="track-columns"><label>Source<select value={mode} disabled={DEMO} onChange={e => { setMode(e.target.value as 'notes' | 'csv'); setPreview(null) }}><option value="notes">Workout notes</option><option value="csv">Weight CSV</option></select></label><label>Year for dates without a year<input required type="number" min="1900" max="2100" value={year} onChange={e => { setYear(+e.target.value); setPreview(null) }} /></label></div>{mode === 'csv' && <label>CSV file<input type="file" accept=".csv,text/csv" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 200000) { setError('Use a CSV smaller than 200 KB.'); return } setText(await file.text()); setPreview(null) }} /></label>}<label>{mode === 'csv' ? 'CSV contents' : 'Your notes'}<textarea rows={10} maxLength={100000} readOnly={DEMO} value={text} onChange={e => { setText(e.target.value); setPreview(null) }} /></label><div className="track-row"><button className="primary" disabled={!text.trim()} onClick={() => void parse(false)}>Review {mode === 'csv' ? 'CSV' : 'notes'}</button>{mode === 'notes' && !DEMO && <button disabled={!text.trim()} onClick={() => void parse(true)}>Use AI to extract</button>}</div>{!DEMO && <small>Local parsing keeps text on your device/private server. “Use AI” sends this pasted text to your configured Groq coach provider. It creates a review only; no records save automatically.</small>}</fieldset>
    {busy && <p role="status">{pending ? 'Saving reviewed batch…' : 'Preparing review…'}</p>}
    {preview && <><h2 className="mt-6">Review {preview.items.length} entries</h2><p className="track-muted">Year: {year}. Flagged entries start unchecked. Missing dates must be entered; uncertain reps remain unfinished unless corrected. Imports never advance your rotation.</p>{preview.unresolved.length > 0 && <Card><h2>Text needing attention</h2>{preview.unresolved.map((line, i) => <p key={i}>{line}</p>)}</Card>}
      <fieldset disabled={busy || !!pending}>{preview.items.map((item, index) => <Card key={index}><label className="track-check"><input type="checkbox" checked={item.selected} disabled={!item.data.date} onChange={e => update(index, { selected: e.target.checked })} />Include {item.kind === 'workout' ? (item.data as Workout).name : item.kind}</label><label>Date<input type="date" required value={item.data.date ?? ''} onChange={e => update(index, { data: { ...item.data, date: e.target.value } })} /></label>{item.warnings.map((w, i) => <p key={i} className="track-muted">{w}</p>)}{item.kind === 'weight' && <><label>Weight · pounds<input type="number" min="0.1" max="2000" step="any" inputMode="decimal" value={(item.data as Weight).pounds} onChange={e => update(index, { data: { ...item.data as Weight, pounds: +e.target.value } })} /></label><p>{(item.data as Weight).note}</p>{t.rows('weight').some(r => r.id === item.data.date) && <p>Already have a weigh-in on this date; it will be kept unchanged.</p>}</>}
      {item.kind === 'workout' && <><label>Workout history<select value={(item.data as Workout).templateId ?? ''} onChange={e => { const template = t.rows('template').find(r => r.id === e.target.value); update(index, { data: { ...item.data as Workout, templateId: template?.id ?? null, name: template?.data?.name ?? (item.data as Workout).name } }) }}><option value="">Keep “{(item.data as Workout).name}” as separate history</option>{t.rows('template').map(r => <option key={r.id} value={r.id}>{r.data!.name}</option>)}</select></label>{(item.data as Workout).exercises.map((e, ei) => <details key={ei}><summary>{e.name} · {e.sets.filter(s => s.done).length} complete sets</summary><p className="track-muted">{e.notes}</p>{e.sets.map((s, si) => <div className="track-set" key={si}><span>{si + 1}</span><input aria-label={`${e.name} import set ${si + 1} weight`} type="number" step="any" min="0" value={s.weight ?? ''} placeholder="lb" onChange={ev => { const w = structuredClone(item.data as Workout); w.exercises[ei]!.sets[si]!.weight = ev.target.value === '' ? null : +ev.target.value; if (ev.target.value === '') w.exercises[ei]!.sets[si]!.done = false; update(index, { data: w }) }} /><input aria-label={`${e.name} import set ${si + 1} reps`} type="number" min="0" step="1" value={s.reps ?? ''} placeholder="Reps?" onChange={ev => { const w = structuredClone(item.data as Workout); w.exercises[ei]!.sets[si]!.reps = ev.target.value === '' ? null : +ev.target.value; if (ev.target.value === '') w.exercises[ei]!.sets[si]!.done = false; update(index, { data: w }) }} /><button type="button" aria-label={`Mark ${e.name} import set ${si + 1} done`} aria-pressed={s.done} disabled={s.weight === null || s.reps === null} onClick={() => { const w = structuredClone(item.data as Workout); w.exercises[ei]!.sets[si]!.done = !s.done; update(index, { data: w }) }}>{s.done ? '✓' : '○'}</button></div>)}</details>)}</>}
      {item.kind === 'note' && <label>Note<textarea value={(item.data as { text: string }).text} onChange={e => update(index, { data: { ...item.data as { date: string; text: string }, text: e.target.value } })} /></label>}
      {(item.kind === 'meal' || item.kind === 'ride') && <p>{item.kind === 'meal' ? `${(item.data as Meal).name}: ${(item.data as Meal).calories} cal · ${(item.data as Meal).protein ?? 'unknown'} g protein` : `${(item.data as BikeRide).minutes} bike minutes`}</p>}
      <details><summary>Original source</summary><pre className="whitespace-pre-wrap text-sm">{item.source}</pre></details></Card>)}</fieldset><button className="primary wide" disabled={busy || !preview.items.some(i => i.selected)} onClick={() => void commit()}>{pending ? 'Retry same batch' : `Save ${preview.items.filter(i => i.selected).length} selected records`}</button>{pending && <p>Keep this review open and retry the same batch if the connection was interrupted. Repeating a save does not duplicate records.</p>}</>}
  </Page>
}
