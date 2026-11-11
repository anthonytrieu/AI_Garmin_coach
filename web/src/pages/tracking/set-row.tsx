import { useState } from 'react'
import { Check } from 'lucide-react'
import { updateSet } from '@/lib/tracking'
import type { Exercise } from '@/lib/tracking'

type Set = Exercise['sets'][number]

export function SetRow({ exercise: e, index: i, previous, onChange }: {
  exercise: Exercise; index: number; previous?: Set; onChange: (next: Exercise) => void
}) {
  const [options, setOptions] = useState(false)
  const s = e.sets[i]!
  const update = (patch: Partial<Set>) => onChange(updateSet(e, i, patch))
  return <div className={`set-block ${s.done ? 'is-complete' : ''} ${s.warmup ? 'is-warmup' : ''}`}>
    <div className="track-set">
      <button className="set-number" aria-label={`${e.name} set ${i + 1} options${s.warmup ? ', warm-up' : ''}`} aria-expanded={options} onClick={() => setOptions(!options)}>{s.warmup ? 'W' : i + 1}</button>
      <span className="set-previous">{previous ? `${previous.weight} × ${previous.reps}` : '—'}</span>
      <input aria-label={`${e.name} set ${i + 1} weight`} inputMode="decimal" type="number" min="0" max="100000" step="any" value={s.weight ?? ''} placeholder="—" onChange={ev => {
        const n = ev.target.value === '' ? null : Number(ev.target.value)
        if (n === null || (Number.isFinite(n) && n >= 0)) update({ weight: n, done: n === null ? false : s.done })
      }} />
      <input aria-label={`${e.name} set ${i + 1} reps`} inputMode="numeric" type="number" min="0" max="10000" step="1" value={s.reps ?? ''} placeholder="—" onChange={ev => {
        const n = ev.target.value === '' ? null : Number(ev.target.value)
        if (n === null || (Number.isInteger(n) && n >= 0)) update({ reps: n, done: n === null ? false : s.done })
      }} />
      <button aria-label={`Complete ${e.name} set ${i + 1}`} aria-pressed={s.done} disabled={s.weight === null || s.reps === null} onClick={() => update({ done: !s.done })}><Check size={20} aria-hidden="true" /></button>
    </div>
    {options && <div className="set-options-panel">
      <p className="track-muted">Set {i + 1} options</p>
      <div className="track-row">
        <button aria-label={`Decrease ${e.name} set ${i + 1} weight`} onClick={() => update({ weight: Math.max(0, (s.weight ?? 0) - e.increment) })}>− {e.increment} lb</button>
        <button aria-label={`Increase ${e.name} set ${i + 1} weight`} onClick={() => update({ weight: (s.weight ?? 0) + e.increment })}>＋ {e.increment} lb</button>
      </div>
      <label className="track-check"><input type="checkbox" checked={s.warmup} onChange={ev => update({ warmup: ev.target.checked })} />Warm-up</label>
      <label>Reps in reserve<input inputMode="numeric" type="number" min="0" max="20" value={s.rir ?? ''} onChange={ev => update({ rir: ev.target.value === '' ? null : Number(ev.target.value) })} /></label>
      <button disabled={s.done || e.sets.length === 1} onClick={() => onChange({ ...e, sets: e.sets.filter(x => x.id !== s.id) })}>Remove unfinished set</button>
      <button onClick={() => setOptions(false)}>Close options</button>
    </div>}
  </div>
}
