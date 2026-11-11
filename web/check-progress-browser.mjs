// Synthetic public-demo-only regression checks. Never writes to a personal API.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const base = process.env.DEMO_TEST_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }), calls = [], errors = []
  page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) calls.push(r.url()) })
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(base + '/progress')
  await page.getByText(/Portfolio demo/).waitFor()
  await page.evaluate(() => {
    const snapshot = JSON.parse(localStorage.getItem('demo-tracking-v1'))
    const source = snapshot.records.find(r => r.kind === 'template' && r.id === 'upper-a').data.exercises[0]
    const set = (weight, reps, done = false) => ({ id: crypto.randomUUID(), weight, reps, done, edited: true, warmup: false, rir: null })
    const row = (id, name, date, sets) => ({ id, kind: 'workout', revision: 1, updated: date, data: { name, templateId: null, rotationPosition: null, status: 'completed', date, exercises: [{ ...source, sets }] } })
    snapshot.records.push(row('weight-only', 'Upper A — imported session', '2026-06-10', [set(30, null)]))
    snapshot.records.push(row('two-sets', 'Upper A', '2026-06-12', [set(35, 8, true), set(35, null)]))
    snapshot.records.push(row('unassigned', 'Upper', '2026-06-14', [set(40, 8, true)]))
    const incompatible = { ...source, equipment: 'Different equipment', sets: [set(999, 8, true)] }
    snapshot.records.find(r => r.id === 'two-sets').data.exercises.push(incompatible)
    localStorage.setItem('demo-tracking-v1', JSON.stringify(snapshot))
  })
  await page.reload()
  assert.equal(await page.locator('.workout-history-card > details[open]').count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Repeat workout', exact: true }).isVisible(), false)
  await page.getByLabel('Compare the same workout').selectOption('upper-a')
  assert.equal(await page.locator('.workout-history-summary').count(), 2, 'Explicit names link without rewriting historical records')
  await page.getByLabel('Exercise progression').selectOption({ index: 1 })
  await page.getByText('30 lb · reps not recorded', { exact: true }).waitFor()
  await page.getByText('35 lb × 8 · 35 lb · reps not recorded', { exact: true }).waitFor()
  assert.equal(await page.getByText('999 lb × 8', { exact: false }).isVisible(), false, 'Different equipment remains separate')
  await page.locator('.workout-history-summary').last().click()
  await page.getByRole('button', { name: 'Repeat workout', exact: true }).click()
  assert.equal(await page.locator('input[aria-label$="set 1 weight"]').first().inputValue(), '40', 'Repeat retains existing latest-compatible-history carry-forward')
  assert.equal(await page.locator('input[aria-label$="set 1 reps"]').first().inputValue(), '8')
  await page.goto(base + '/progress')
  await page.locator('.workout-history-summary').first().click()
  await page.getByLabel('Workout routine for 2026-06-14', { exact: true }).selectOption('upper-a')
  await page.reload()
  assert.match(await page.locator('.workout-history-summary').first().innerText(), /Upper A/)
  await page.getByLabel('Compare the same workout').selectOption('upper-a')
  assert.equal(await page.locator('.workout-history-summary').count(), 3)
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  }
  assert.deepEqual(calls, [])
  assert.deepEqual(errors, [])
  console.log('Progress checks passed: one/two recorded sets, missing reps, equipment compatibility, compact history, explicit-name grouping, repeat partial sessions, persisted routine selection and responsive layouts.')
} finally { await browser.close() }
