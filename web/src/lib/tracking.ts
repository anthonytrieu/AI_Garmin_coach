import { DEMO } from './mode'

export type SetEntry = { id: string; weight: number | null; reps: number | null; done: boolean; edited: boolean; warmup: boolean; rir: number | null }
export type Exercise = { id: string; name: string; equipment: string; convention: string; targetMin: number; targetMax: number; increment: number; notes: string; sets: SetEntry[] }
export type Template = { name: string; group: 'Upper' | 'Arms' | 'Legs' | 'Custom'; exercises: Exercise[] }
export type Workout = { name: string; templateId: string | null; scheduleId?: string | null; notes?: string; rotationPosition: number | null; date: string; status: 'draft' | 'completed' | 'discarded'; exercises: Exercise[] }
export type Meal = { name: string; date: string; time: string; calories: number; protein: number | null; carbs: number | null; fat: number | null; servings: number; favourite: boolean }
export type Weight = { date: string; pounds: number; note: string }
export type BikeRide = { date: string; minutes: number; note: string; source: 'manual'; externalId: string | null }
export type FoodDay = { date: string; complete: boolean }
export type Records = { template: Template; workout: Workout; meal: Meal; weight: Weight; ride: BikeRide; 'food-day': FoodDay; rotation: { position: number }; schedule: { date: string; templateId: string; name: string; rotationPosition: number | null }; note: { date: string; text: string } }
export type Kind = keyof Records
export type Row<K extends Kind = Kind> = { id: string; kind: K; revision: number; data: Records[K] | null; updated: string }
export type Snapshot = { records: Row[]; position: number }
export type Mutation<K extends Kind = Kind> = { kind: K; id: string; revision: number; mutationId: string; data: Records[K] | null }
export const rotation = ['upper-a', 'arms-a', 'legs', 'upper-b', 'arms-b', 'legs']
export const uid = () => crypto.randomUUID()
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const today = () => DEMO ? '2026-06-17' : localDate()
export const dayOffset = (date: string, days: number) => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + days); return localDate(d) }
export function weekStart(date: string) { const weekday = new Date(date + 'T12:00:00').getDay(); return dayOffset(date, -(weekday + 6) % 7) }
export const blankSet = (): SetEntry => ({ id: uid(), weight: null, reps: null, done: false, edited: false, warmup: false, rir: null })
export function exercise(name: string, count = 2): Exercise { return { id: uid(), name, equipment: '', convention: '', targetMin: 8, targetMax: 10, increment: 5, notes: '', sets: Array.from({ length: count }, blankSet) } }
export const compatible = (a: Exercise, b: Exercise) => a.id === b.id && a.equipment === b.equipment && a.convention === b.convention
export function previousExercise(records: Row<'workout'>[], e: Exercise): Exercise | undefined {
  return records.filter(r => r.data?.status === 'completed').sort((a, b) => b.data!.date.localeCompare(a.data!.date) || b.updated.localeCompare(a.updated)).flatMap(r => r.data!.exercises).find(old => compatible(old, e) && old.sets.some(s => s.done && !s.warmup))
}
export function freshExercise(e: Exercise, history: Row<'workout'>[]): Exercise {
  const last = previousExercise(history, e)?.sets.filter(s => s.done && !s.warmup)
  return { ...structuredClone(e), sets: e.sets.map((s, i) => ({ ...blankSet(), weight: last?.[i]?.weight ?? s.weight, reps: last?.[i]?.reps ?? null })) }
}
export function updateSet(e: Exercise, index: number, change: Partial<SetEntry>): Exercise {
  const sets = e.sets.map(s => ({ ...s })); sets[index] = { ...sets[index]!, ...change, edited: true }
  const next = sets[index + 1]
  if (next && !next.done && !next.edited) {
    if ('weight' in change) next.weight = change.weight ?? null
    if ('reps' in change) next.reps = change.reps ?? null
  }
  return { ...e, sets }
}
export function swapExercise(workout: Workout, index: number, replacement: Exercise, history: Row<'workout'>[]): Workout {
  const original = workout.exercises[index]!, completed = original.sets.filter(s => s.done)
  const remaining = Math.max(1, original.sets.filter(s => !s.done).length)
  const next = freshExercise({ ...replacement, sets: Array.from({ length: remaining }, blankSet) }, history)
  const exercises = [...workout.exercises]
  exercises.splice(index, 1, ...(completed.length ? [{ ...original, sets: completed }] : []), next)
  return { ...workout, exercises }
}
export function mealTotals(meals: Meal[]) {
  return { calories: meals.reduce((n, m) => n + m.calories * m.servings, 0), protein: meals.reduce((n, m) => n + (m.protein ?? 0) * m.servings, 0), unknownProtein: meals.some(m => m.protein === null) }
}
export function weightAverage(weights: Weight[], date: string) { const values = weights.filter(w => w.date >= dayOffset(date, -6) && w.date <= date); return { count: values.length, average: values.length ? values.reduce((n, w) => n + w.pounds, 0) / values.length : null } }

// Deliberately generic synthetic examples. Owner templates are loaded by the private API.
function demoInitial(): Snapshot {
  const specs: [string, Template['group'], string[]][] = [
    ['Upper A', 'Upper', ['Dumbbell Bench Press', 'Seated Row']], ['Arms A', 'Arms', ['Cable Curl', 'Rope Pushdown']],
    ['Legs', 'Legs', ['Goblet Squat', 'Leg Curl']], ['Upper B', 'Upper', ['Incline Press', 'Pulldown']], ['Arms B', 'Arms', ['Hammer Curl', 'Overhead Extension']],
  ]
  return { position: 0, records: specs.map(([name, group, names]) => ({ kind: 'template', id: name.toLowerCase().replace(' ', '-'), revision: 1, updated: '', data: { name, group, exercises: names.map(n => exercise(n)) } })) }
}
const demoKey = 'demo-tracking-v1'
export class TrackingError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status } }
export async function readTracking(): Promise<Snapshot> {
  if (DEMO) { const saved = localStorage.getItem(demoKey); if (saved) return JSON.parse(saved); const initial = demoInitial(); localStorage.setItem(demoKey, JSON.stringify(initial)); return initial }
  const res = await fetch('/api/tracking'); if (!res.ok) throw new TrackingError(res.status, 'Unable to load tracking records. Sign in again or retry.'); return res.json()
}
export async function writeTracking(m: Mutation): Promise<{ record: Row; position: number }> {
  if (DEMO) {
    const s = await readTracking(), old = s.records.find(r => r.id === m.id && r.kind === m.kind)
    if ((old?.revision ?? 0) !== m.revision) throw new TrackingError(409, 'This record changed in another tab. Your draft is preserved.')
    if (m.kind === 'rotation' && m.data) s.position = (m.data as { position: number }).position
    if (m.kind === 'workout') {
      const w = m.data as Workout | null
      if (w?.status === 'draft' && s.records.some(r => r.kind === 'workout' && r.id !== m.id && (r.data as Workout)?.status === 'draft')) throw new TrackingError(409, 'Resume the existing workout first.')
      if (w?.status === 'completed' && (old?.data as Workout)?.status !== 'completed' && w.rotationPosition === s.position && w.templateId === rotation[s.position]) s.position = (s.position + 1) % 6
    }
    const record: Row = { kind: m.kind, id: m.id, revision: m.revision + 1, data: m.data, updated: new Date().toISOString() }
    s.records = s.records.filter(r => !(r.id === m.id && r.kind === m.kind)).concat(record); localStorage.setItem(demoKey, JSON.stringify(s)); return { record, position: s.position }
  }
  const { kind, id, ...body } = m
  const res = await fetch(`/api/tracking/${kind}/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) { const error = await res.json().catch(() => ({})); throw new TrackingError(res.status, typeof error.detail === 'string' ? error.detail : 'Could not save. Check the entry and retry.') }
  return res.json()
}

// A deliberately bounded local parser. Unsupported/ambiguous dates are not guessed.
export function parseBikeNote(text: string, date = today()): BikeRide | null {
  const match = /^i (?:biked|cycled|rode(?: my bike)?) (\d+(?:\.\d+)?) (?:minutes?|mins?)(?: (today|yesterday|on \d{4}-\d{2}-\d{2}))?[.!]?$/i.exec(text.trim())
  if (!match) return null
  const minutes = Number(match[1]); if (minutes <= 0 || minutes > 1440) return null
  const when = match[2]?.toLowerCase()
  const rideDate = when === 'yesterday' ? dayOffset(date, -1) : when?.startsWith('on ') ? when.slice(3) : date
  const parsed = new Date(rideDate + 'T12:00:00')
  if (Number.isNaN(parsed.valueOf()) || localDate(parsed) !== rideDate) return null
  return { minutes, date: rideDate, source: 'manual', externalId: null, note: '' }
}
