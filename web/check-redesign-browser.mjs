import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const output = process.env.SCREENSHOT_DIR ?? '/private/tmp/garmin-redesign-screenshots'
await mkdir(output, { recursive: true })
const targets = [['after', process.env.DEMO_TEST_URL ?? 'http://127.0.0.1:5173']]
if (process.env.BEFORE_TEST_URL) targets.unshift(['before', process.env.BEFORE_TEST_URL])
const browser = await chromium.launch()
const errors = [], apiCalls = []
try {
  for (const [name, base] of targets) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) apiCalls.push(r.url()) })
    await page.goto(base + '/train')
    await page.getByRole('button', { name: 'Upper', exact: true }).click()
    await page.getByRole('button', { name: 'Start Upper A', exact: true }).click()
    const weight = page.locator('input[aria-label$="set 1 weight"]').first()
    const reps = page.locator('input[aria-label$="set 1 reps"]').first()
    await weight.fill('30'); await reps.fill('10')
    await page.getByRole('button', { name: /^Complete .* set 1$/ }).first().click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${output}/workout-${name}-390.png`, fullPage: false })
    if (name === 'after') {
      for (const width of [320, 375, 390, 430, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 })
        for (const theme of ['light', 'dark']) {
          await page.evaluate(theme => { document.documentElement.classList.toggle('dark', theme === 'dark'); localStorage.theme = theme }, theme)
          for (const path of ['/workout', '/train', '/', '/progress', '/schedule', '/coach']) {
            await page.goto(base + path)
            await page.waitForTimeout(100)
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow ${path} ${width} ${theme}`)
          }
          await page.goto(base + '/workout')
          await page.screenshot({ path: `${output}/workout-${width}-${theme}.png`, fullPage: false })
        }
      }
      await page.setViewportSize({ width: 320, height: 600 })
      await page.getByRole('button', { name: '＋ Add exercise', exact: true }).click()
      await page.getByLabel('Find or create exercise').fill('QA movement')
      assert(await page.getByRole('dialog').isVisible())
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('dialog').count(), 0)
      await page.getByRole('button', { name: /Complete .* set 1$/ }).first().click()
      assert.equal(await page.getByRole('button', { name: /Complete .* set 1$/ }).first().getAttribute('aria-pressed'), 'false')
      await page.getByRole('button', { name: /Complete .* set 1$/ }).first().click()
      await page.getByRole('button', { name: 'Add set', exact: true }).first().click()
      await page.locator('button[aria-label$="set 3 options"]').first().click()
      await page.getByLabel('Warm-up', { exact: true }).check()
      await page.getByLabel('Reps in reserve', { exact: true }).fill('2')
      await page.getByRole('button', { name: 'Remove unfinished set', exact: true }).click()
      await page.getByRole('button', { name: '＋ Add exercise', exact: true }).click()
      await page.getByLabel('Find or create exercise').fill('QA movement')
      await page.getByRole('button', { name: 'Create “QA movement”', exact: true }).click()
      await page.getByLabel('QA movement set 1 weight', { exact: true }).fill('15')
      await page.getByLabel('QA movement set 1 reps', { exact: true }).fill('8')
      await page.reload()
      assert.equal(await page.getByLabel('QA movement set 1 weight', { exact: true }).inputValue(), '15')
      await page.getByText('Draft actions', { exact: true }).click()
      await page.getByRole('button', { name: 'Discard draft', exact: true }).click()
      await page.getByRole('button', { name: 'Keep draft', exact: true }).click()
      await page.getByRole('button', { name: 'Discard draft', exact: true }).click()
      await page.getByRole('button', { name: 'Confirm discard', exact: true }).click()
      await page.getByText('No active draft.', { exact: false }).waitFor()
    }
    await context.close()
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(apiCalls, [], 'Public demo requested a personal API')
  console.log('Screenshots captured; 72 responsive/theme route checks, picker Escape, completion reversal, add/remove/warm-up/RIR, add exercise, refresh recovery and discard passed.')
} finally { await browser.close() }
