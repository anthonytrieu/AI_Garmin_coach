import ts from 'typescript'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const temp = mkdtempSync(join(tmpdir(), 'coach-logging-test-'))
try {
  for (const name of ['tracking', 'coach-logging']) {
    const source = readFileSync(new URL(`./src/lib/${name}.ts`, import.meta.url), 'utf8')
      .replace("import { DEMO } from './mode'", 'const DEMO = true')
      .replace("import { storageKey } from './mode'", "const storageKey = n => 'demo-' + n")
      .replace("from './tracking'", "from './tracking.mjs'")
    writeFileSync(join(temp, `${name}.mjs`), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText)
  }
  const t = await import(pathToFileURL(join(temp, 'coach-logging.mjs')))
  let review = t.createLogReview('I ate a jr chicken from mcdonalds add that to the meals today', [])
  assert.equal(review.calories, '380'); assert.equal(review.protein, '12'); assert.equal(review.amount, '1')
  review = t.createLogReview('I ate two Jr Chickens from McDonalds yesterday', [])
  assert.equal(review.amount, '2'); assert.equal(review.calories, '380')
  assert.equal(t.createLogReview('I ate chicken', []).calories, '', 'Unknown meals never get invented calories')
  assert.equal(t.createLogReview('I ate a jr chicken and fries', []).matches.length, 0, 'Do not silently omit extra foods')
  assert.equal(t.createLogReview('What if I ate a Jr Chicken?', []), null)
  assert.equal(t.createLogReview('I had a question about recovery', []), null)
  assert.equal(t.createLogReview('I biked for 40 minutes, add that to today', []).minutes, '40')
  assert.equal(t.createLogReview('I went cycling for 20 mins yesterday', []).minutes, '20')
  assert.equal(t.loggingDate('on 2026-02-30').date, '')
  assert.equal(t.loggingDate('last Monday').date, '')
  assert.equal(t.parseMealRequest('I ate a sandwich yesterday', '2026-06-17').date, '2026-06-16')
  const macros = t.createLogReview('I ate 2 tacos 500 calories 30g protein', [])
  assert.equal(macros.amount, '1', 'Explicit nutrition is for the whole described meal')
  assert.equal(macros.calories, '500'); assert.equal(macros.protein, '30')
  const saved = [{ id: 'meal', updated: 'now', data: { name: 'Chicken', calories: 200, protein: 30, servings: 2, date: '2026-06-16' } }]
  assert.equal(t.matchingFoods('chicken', saved)[0].calories, 400)
  assert.equal(t.matchingFoods('chicken and rice', saved).length, 0)
  console.log('Coach logging checks passed: meal/ride intents, sourced lookup, quantity, supplied totals, saved portions, ambiguous foods, negation/hypotheticals and date handling.')
} finally { rmSync(temp, { recursive: true, force: true }) }
