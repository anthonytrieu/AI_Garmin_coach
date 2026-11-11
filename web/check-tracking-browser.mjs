// Run against the local synthetic API fixture described in docs/tracking.md.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const personalUrl = process.env.TRACKING_TEST_URL ?? 'http://127.0.0.1:5174'
const demoUrl = process.env.DEMO_TEST_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const page = await context.newPage(), errors = []
page.on('pageerror', e => errors.push(e.message))
try {
  await page.goto(personalUrl + '/train')
  await page.getByRole('button', { name: 'Upper', exact: true }).click()
  await page.getByRole('button', { name: 'Start Upper A', exact: true }).click()
  await page.getByLabel('Synthetic press set 1 reps', { exact: true }).fill('12')
  await page.getByRole('button', { name: 'Complete Synthetic press set 1', exact: true }).click()
  await page.getByLabel('Synthetic press set 2 weight', { exact: true }).fill('25')
  await page.waitForFunction(() => document.body.textContent.includes('Saved on device and server'))
  await page.reload()
  await page.getByLabel('Synthetic press set 2 weight', { exact: true }).waitFor()
  assert.equal(await page.getByLabel('Synthetic press set 2 weight', { exact: true }).inputValue(), '25')
  await context.setOffline(true)
  await page.getByLabel('Synthetic press set 2 weight', { exact: true }).fill('30')
  await page.waitForFunction(() => document.body.textContent.includes('Offline or save failed'))
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('owner-workout-draft-v1')).data.exercises[0].sets[1].weight), 30)
  await context.setOffline(false)
  if (!await page.getByRole('button', { name: 'Retry sync', exact: true }).isVisible()) await page.getByText('Sync & recovery', { exact: true }).click()
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click()
  await page.waitForFunction(() => document.body.textContent.includes('Saved on device and server'))
  // The server commits a write, but its response is lost. Retry must not duplicate it.
  let dropped = false
  await page.route('**/api/tracking/workout/*', async route => {
    if (!dropped && route.request().method() === 'PUT') { dropped = true; await route.fetch(); await route.abort(); return }
    await route.continue()
  })
  await page.getByLabel('Synthetic press set 2 weight', { exact: true }).fill('35')
  await page.waitForFunction(() => document.body.textContent.includes('Offline or save failed'))
  if (!await page.getByRole('button', { name: 'Retry sync', exact: true }).isVisible()) await page.getByText('Sync & recovery', { exact: true }).click()
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click()
  await page.waitForFunction(() => document.body.textContent.includes('Saved on device and server'))
  await page.unroute('**/api/tracking/workout/*')
  await page.getByRole('button', { name: 'Swap', exact: true }).click()
  await page.getByLabel('Find or create exercise', { exact: true }).fill('Synthetic custom row')
  await page.getByRole('button', { name: 'Create “Synthetic custom row”', exact: true }).click()
  assert.equal(await page.getByLabel('Synthetic press set 1 weight', { exact: true }).inputValue(), '20')
  assert.equal(await page.getByLabel('Synthetic custom row set 1 weight', { exact: true }).inputValue(), '')
  await page.getByLabel('Synthetic custom row set 1 weight', { exact: true }).fill('15')
  await page.getByLabel('Synthetic custom row set 1 reps', { exact: true }).fill('10')
  await page.getByRole('button', { name: 'Complete Synthetic custom row set 1', exact: true }).click()
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click()
  await page.getByRole('button', { name: 'Save completed workout', exact: true }).click()
  await page.getByText('No active draft.', { exact: false }).waitFor()
  const state = await page.evaluate(() => fetch('/api/tracking').then(r => r.json()))
  assert.equal(state.position, 1)
  assert.equal(state.records.filter(r => r.kind === 'workout' && r.data?.status === 'completed').length, 1)
  await page.goto(personalUrl + '/progress')
  await page.getByLabel('Compare the same workout').selectOption('upper-a')
  await page.locator('.workout-history-summary').first().click()
  await page.getByRole('button', { name: 'Synthetic custom row', exact: true }).click()
  await page.getByText('15 lb × 10', { exact: true }).waitFor()
  await page.goto(personalUrl + '/log/meal')
  await page.getByLabel('Meal name (optional)').fill('Synthetic leftovers')
  await page.getByLabel('Calories', { exact: true }).fill('320')
  await page.getByLabel('Protein · g', { exact: true }).fill('21')
  await page.getByRole('button', { name: 'Save entry', exact: true }).click()
  await page.getByText('320 cal · 21 g protein', { exact: true }).first().waitFor()
  await page.goto(personalUrl + '/log/weight')
  await page.getByLabel('Weight · pounds').fill('175.5')
  await page.getByRole('button', { name: 'Save entry', exact: true }).click()
  await page.getByRole('heading', { name: '175.5 lb', exact: true }).waitFor()
  await page.goto(personalUrl + '/log/ride')
  await page.getByLabel('Bike minutes', { exact: true }).fill('40')
  await page.getByRole('button', { name: 'Save entry', exact: true }).click()
  await page.getByText('110 min remaining', { exact: true }).waitFor()
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    for (const path of ['/', '/train', '/log/meal', '/progress', '/schedule']) {
      await page.goto(personalUrl + path)
      await page.waitForTimeout(120)
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow ${path} at ${width}`)
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(personalUrl + '/')
  await page.screenshot({ path: '/private/tmp/garmin-tracking-today.png', fullPage: true })
  const demo = await browser.newPage({ viewport: { width: 390, height: 844 } }), calls = []
  demo.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) calls.push(r.url()) })
  for (const route of ['/', '/train', '/progress', '/schedule', '/coach']) { await demo.goto(demoUrl + route); await demo.waitForTimeout(150) }
  assert.deepEqual(calls, [], 'Public demo requested a personal API')
  assert.deepEqual(errors, [], 'Browser runtime errors')
  console.log('Browser checks passed: persisted/offline drafts, lost-response retry, custom swap preserving sets, completion/rotation, template history, meals, weight, ride, 20 responsive routes, demo isolation.')
} finally { await browser.close() }
