import type { Workout } from './tracking'

export function formatProgressNumber(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return Number(value.toPrecision(5)).toLocaleString('en-US', { maximumSignificantDigits: 5 })
}

export function workoutText(workout: Workout, title = workout.name): string {
  const lines = [`${title} — ${workout.date}`]
  for (const exercise of workout.exercises) {
    lines.push('', [exercise.name, exercise.equipment, exercise.convention].filter(Boolean).join(' · '))
    exercise.sets.forEach((set, index) => {
      const load = set.weight === null ? 'load not recorded' : `${formatProgressNumber(set.weight)} lb`
      const reps = set.reps === null ? 'reps not recorded' : `${set.reps} reps`
      lines.push(`${set.warmup ? 'Warm-up' : `Set ${index + 1}`}: ${load} × ${reps}${set.done ? '' : ' (completion unconfirmed)'}${set.rir === null ? '' : ` · ${set.rir} RIR`}`)
    })
    if (exercise.notes) lines.push(`Notes: ${exercise.notes}`)
  }
  if (workout.notes) lines.push('', `Workout notes: ${workout.notes}`)
  return lines.join('\n')
}
