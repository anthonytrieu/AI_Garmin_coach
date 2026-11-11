import ts from 'typescript'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const temp = mkdtempSync(join(tmpdir(), 'tracking-test-'))
try {
  const source = readFileSync(new URL('./src/lib/tracking.ts', import.meta.url), 'utf8').replace("import { DEMO } from './mode'", 'const DEMO = true')
  writeFileSync(join(temp, 'tracking.mjs'), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText)
  const t = await import(pathToFileURL(join(temp, 'tracking.mjs')))
  const memory = new Map(); globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
  globalThis.fetch = () => { throw Error('Demo attempted network access') }
  const initial = await t.readTracking(); assert.equal(initial.records.length, 5)
  let e = t.exercise('Synthetic press', 3)
  e = t.updateSet(e, 0, { weight: 30, reps: 12 })
  assert.equal(e.sets[1].weight, 30)
  e = t.updateSet(e, 1, { weight: 35 })
  e = t.updateSet(e, 0, { weight: 40 })
  assert.equal(e.sets[1].weight, 35, 'Do not overwrite explicitly edited next set')
  e = t.updateSet(e, 0, { done: true })
  const w = { name: 'Upper A', templateId: 'upper-a', rotationPosition: 0, date: '2026-06-17', status: 'draft', exercises: [e] }
  const replacement = t.exercise('Custom movement')
  const swapped = t.swapExercise(w, 0, replacement, [])
  assert.equal(swapped.exercises[0].sets.length, 1)
  assert.equal(swapped.exercises[0].sets[0].weight, 40)
  assert.equal(swapped.exercises[1].sets[0].weight, null)
  assert.equal(swapped.exercises[1].id, replacement.id)
  assert.deepEqual(t.mealTotals([{ calories: 640, protein: 42, servings: .5 }, { calories: 100, protein: null, servings: 1 }]), { calories: 420, protein: 21, unknownProtein: true })
  assert.equal(t.weekStart('2026-06-21'), '2026-06-15')
  assert.equal(t.weekStart('2026-06-22'), '2026-06-22')
  assert.equal(t.weekStart('2026-11-01'), '2026-10-26')
  assert.deepEqual(t.weightAverage([{ date: '2026-06-10', pounds: 190 }, { date: '2026-06-11', pounds: 180 }, { date: '2026-06-17', pounds: 178 }], '2026-06-17'), { count: 2, average: 179 })
  assert.equal(t.parseBikeNote('I biked 40 minutes', '2026-06-17').minutes, 40)
  assert.equal(t.parseBikeNote('I biked 40 minutes yesterday', '2026-06-17').date, '2026-06-16')
  assert.equal(t.parseBikeNote('I biked 40 minutes on Monday', '2026-06-17'), null)
  assert.equal(t.parseBikeNote('I biked 40 minutes on 2026-02-30'), null)
  const saved = await t.writeTracking({ kind: 'workout', id: 'example', revision: 0, mutationId: t.uid(), data: w })
  assert.equal(saved.position, 0)
  assert.equal((await t.writeTracking({ kind: 'workout', id: 'example', revision: 1, mutationId: t.uid(), data: { ...w, status: 'completed' } })).position, 1)
  await assert.rejects(() => t.writeTracking({ kind: 'workout', id: 'example', revision: 1, mutationId: t.uid(), data: w }))
  console.log('Tracking: carry-forward, swaps, portion math, date boundaries, rolling average, rotation, conflicts and demo isolation passed.')
} finally { rmSync(temp, { recursive: true, force: true }) }
