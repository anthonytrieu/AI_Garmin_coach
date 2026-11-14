import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTracking } from './tracking-provider'
import { TrackingDialog } from '@/pages/tracking/dialog'
import { DEMO } from '@/lib/mode'
import { estimateMeal, normalizeFood, applyFood } from '@/lib/coach-logging'
import type { FoodMatch, LogReview } from '@/lib/coach-logging'
import { TrackingError } from '@/lib/tracking'
import type { BikeRide, Meal } from '@/lib/tracking'

export default function CoachLogReview({ review: r, onChange, onClose }: { review: LogReview; onChange: (value: LogReview) => boolean; onClose: () => void }) {
  const t = useTracking(), [busy, setBusy] = useState(false), [searching, setSearching] = useState(false), [error, setError] = useState(''), [additional, setAdditional] = useState(false)
  const inFlight = useRef(false), searchAbort = useRef<AbortController | null>(null)
  useEffect(() => () => { searchAbort.current?.abort() }, [])
  const record = t.snapshot.records.find(row => row.kind === r.kind && row.id === r.id)
  const saved = !!r.submitted && !!record?.data, undone = !!r.submitted && record?.data === null
  const amount = Number(r.amount), calories = Number(r.calories), protein = r.protein === '' ? null : Number(r.protein)
  const totalCalories = amount * calories, totalProtein = protein === null ? null : amount * protein
  const duplicate = !saved && !undone && (r.kind === 'meal'
    ? t.rows('meal').some(row => row.id !== r.id && row.data!.date === r.date && normalizeFood(row.data!.name) === normalizeFood(r.name) && Math.abs(row.data!.calories * row.data!.servings - totalCalories) < .01)
    : t.rows('ride').some(row => row.id !== r.id && row.data!.date === r.date && row.data!.minutes === Number(r.minutes)))
  const locked = busy || t.loading || !!r.submitted
  function change(patch: Partial<LogReview>) { if (!onChange({ ...r, ...patch })) setError('Device storage unavailable. Keep this page open and enable storage before saving.'); setAdditional(false) }
  async function search() {
    searchAbort.current?.abort()
    const controller = new AbortController(); searchAbort.current = controller
    setSearching(true); setError('')
    try {
      const res = await fetch('/api/nutrition/search?q=' + encodeURIComponent(r.query.trim()), { signal: controller.signal })
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw Error(body.detail || 'Food search unavailable. Enter the label values below.') }
      const body = await res.json() as { items: FoodMatch[] }
      change({ matches: body.items })
      if (!body.items.length) setError('No packaged-food matches. Enter calories and protein from the label below.')
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Food search unavailable. Enter label values below.') }
    finally { setSearching(false) }
  }
  async function estimate() {
    searchAbort.current?.abort()
    const controller = new AbortController(); searchAbort.current = controller
    setSearching(true); setError('')
    try {
      const food = await estimateMeal(r.description ?? `${r.amount || '1'} portions of ${r.query}`, undefined, controller.signal)
      onChange(applyFood({ ...r, amount: '1' }, food))
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Meal estimate unavailable.') }
    finally { if (!controller.signal.aborted) setSearching(false) }
  }
  async function save() {
    if (inFlight.current || (duplicate && !additional)) return
    const data = r.submitted ?? (r.kind === 'meal'
      ? { name: (r.source.startsWith('AI estimate') ? `≈ ${r.name.trim()}` : r.name.trim()).slice(0, 120), date: r.date, time: r.time, calories: totalCalories, protein: totalProtein, carbs: null, fat: null, servings: 1, favourite: false }
      : { date: r.date, minutes: Number(r.minutes), note: 'Logged through Coach', source: 'manual', externalId: null }) as Meal | BikeRide
    if (!onChange({ ...r, submitted: data })) { setError('Device storage unavailable. Enable storage before saving this entry.'); return }
    inFlight.current = true; setBusy(true); setError('')
    try {
      if (r.kind === 'meal') await t.save('meal', r.id, data as Meal)
      else await t.save('ride', r.id, data as BikeRide)
    } catch (err) { if (err instanceof TrackingError && err.status === 422) onChange({ ...r, submitted: null }); setError(`${String(err)} Your entry is retained. Retry this same entry to avoid duplicates.`) }
    finally { inFlight.current = false; setBusy(false) }
  }
  async function undo() {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError('')
    try { await t.save(r.kind, r.id, null) }
    catch (err) { setError(String(err)) }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <TrackingDialog title={r.kind === 'meal' ? 'Confirm meal' : 'Confirm bike ride'} onClose={() => { if (!busy) onClose() }}>
    <div className="tracking-page !p-0">
      <h2>{undone ? 'Entry removed' : saved ? (r.kind === 'meal' ? 'Meal added' : 'Ride saved') : (r.kind === 'meal' ? 'Add this meal?' : 'Save this ride?')}</h2>
      {error && <p role="alert">{error}</p>}
      {t.loading && <p role="status">Checking your saved entries…</p>}
      {saved || undone ? <>
        <p role="status">{undone ? 'Removed from your totals.' : r.kind === 'meal' ? `${r.name} · ${Math.round((r.submitted as Meal).calories)} cal · ${(r.submitted as Meal).protein ?? 'unknown'} g protein · ${r.date}` : `${r.minutes} min · ${r.date} · manual`}</p>
        {saved && <button disabled={busy || t.loading} onClick={() => void undo()}>Undo {r.kind === 'meal' ? 'meal' : 'ride'}</button>}
        <Link className="track-button" to={r.kind === 'meal' ? '/food' : '/'} onClick={onClose}>{r.kind === 'meal' ? 'View food log' : 'View weekly gauge'}</Link>
        <button disabled={busy} onClick={onClose}>Close</button>
      </> : <form onSubmit={event => { event.preventDefault(); void save() }}>
        {!r.date && <p role="alert">Choose the date you meant before saving.</p>}
        <fieldset disabled={locked}>
          {r.kind === 'meal' ? <>
            <p><strong>{r.name}</strong></p>
            <p className="track-muted">{r.portion || 'Estimate this meal, or choose a food match below.'}</p>
            {r.source && <small>{r.source}{r.url?.startsWith('https://') && <> · <a className="underline" href={r.url} target="_blank" rel="noreferrer">View source</a></>}</small>}
            <div className="track-columns">
              <label>Number of portions<input required inputMode="decimal" type="number" min="0.01" max="100" step="any" value={r.amount} onChange={event => change({ amount: event.target.value })} /></label>
              <label>Meal date<input type="date" required value={r.date} onChange={event => change({ date: event.target.value })} /></label>
            </div>
            <p><strong>{r.amount && r.calories ? `${Math.round(totalCalories)} cal` : 'Calories needed'}</strong> · {r.protein && r.amount ? `${Math.round(totalProtein! * 10) / 10} g protein` : 'Protein not recorded'}</p>
            {!DEMO && <button type="button" disabled={searching || !r.query.trim()} onClick={() => void estimate()}>{searching ? 'Estimating…' : 'Look up / estimate meal'}</button>}
            <details open={r.calories === ''}>
              <summary>Edit food & nutrition</summary>
              <label>Find a food<input maxLength={120} value={r.query} onChange={event => change({ query: event.target.value })} /></label>
              {!DEMO && <><button type="button" disabled={searching || r.query.trim().length < 2} onClick={() => void search()}>{searching ? 'Searching…' : 'Search packaged foods'}</button><small>This search sends only the food query to Open Food Facts. Restaurant coverage is limited; check the portion and country.</small></>}
              {!!r.matches.length && <div className="track-picker" aria-label="Food matches">{r.matches.map(food => <button type="button" key={food.id} onClick={() => onChange(applyFood(r, food))}>{food.name}<small>{food.portion} · {food.calories} cal · {food.protein ?? 'unknown'} g protein</small><small>{food.source}</small></button>)}</div>}
              <label>Meal name<input required maxLength={120} value={r.name} onChange={event => change({ name: event.target.value })} /></label>
              <div className="track-columns">
                <label>Calories per portion<input required inputMode="decimal" type="number" min="0" max="100000" step="any" value={r.calories} onChange={event => change({ calories: event.target.value })} /></label>
                <label>Protein per portion · g<input inputMode="decimal" type="number" min="0" max="10000" step="any" placeholder="Unknown" value={r.protein} onChange={event => change({ protein: event.target.value })} /></label>
              </div>
              <label>Meal time<input type="time" required value={r.time} onChange={event => change({ time: event.target.value })} /></label>
            </details>
          </> : <div className="track-columns">
            <label>Bike minutes<input required inputMode="decimal" type="number" min="0.1" max="1440" step="any" value={r.minutes} onChange={event => change({ minutes: event.target.value })} /></label>
            <label>Ride date<input type="date" required value={r.date} onChange={event => change({ date: event.target.value })} /></label>
          </div>}
        </fieldset>
        {duplicate && <label className="track-check"><input type="checkbox" checked={additional} onChange={event => setAdditional(event.target.checked)} />A matching entry is already logged. This is another {r.kind === 'meal' ? 'meal' : 'ride'}.</label>}
        <div className="track-row"><button autoFocus className="primary" type="submit" disabled={busy || searching || t.loading || (duplicate && !additional)}>{busy ? 'Saving…' : r.submitted ? 'Retry save' : r.kind === 'meal' ? 'Add meal' : 'Save ride'}</button><button type="button" disabled={busy} onClick={onClose}>{r.submitted ? 'Close' : 'Cancel'}</button></div>
      </form>}
    </div>
  </TrackingDialog>
}
