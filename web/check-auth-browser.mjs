// Personal-mode frontend; all API responses and device credentials are synthetic.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const base = process.env.TRACKING_TEST_URL ?? 'http://127.0.0.1:5174'
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  let loggedIn = false, attempts = 0
  const good = 'a'.repeat(43), bad = 'b'.repeat(43), issued = 'c'.repeat(43)
  const requestUrls = []
  page.on('request', r => requestUrls.push(r.url()))
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/setup') {
      attempts++; loggedIn = route.request().postDataJSON().token === good
      return route.fulfill({ status: loggedIn ? 200 : 401, json: { authenticated: loggedIn } })
    }
    if (path === '/api/auth/setup-link') return route.fulfill({ json: { url: base + '/#setup=' + issued, expiresIn: 900 } })
    if (path === '/api/auth/logout') loggedIn = false
    await route.fulfill({ status: loggedIn ? 200 : 401, json: path === '/api/tracking' ? { records: [], position: 0 } : { authenticated: loggedIn } })
  })
  await page.goto(base)
  await page.getByRole('button', { name: 'Check this device', exact: true }).waitFor()
  assert.equal(await page.locator('input[type=password]').count(), 0)
  await page.evaluate(token => { location.hash = 'setup=' + token }, bad)
  await page.getByRole('button', { name: 'Remember this device', exact: true }).waitFor()
  assert.equal(new URL(page.url()).hash, '', 'Setup credential must be removed immediately')
  await page.getByRole('button', { name: 'Remember this device', exact: true }).click()
  await page.getByRole('alert').waitFor()
  await page.goto(base + '/#setup=' + good)
  await page.getByRole('button', { name: 'Remember this device', exact: true }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor()
  assert.equal(attempts, 2)
  await page.reload()
  await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor()
  assert.equal(attempts, 2, 'Remembered sessions must not repeat setup on refresh')
  await page.getByRole('button', { name: 'Device access', exact: true }).click()
  await page.getByRole('button', { name: 'Create one-time link', exact: true }).click()
  assert.equal(await page.getByLabel('Private setup link').inputValue(), base + '/#setup=' + issued)
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 }); await page.waitForTimeout(100)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByRole('button', { name: 'Check this device', exact: true }).waitFor()
  assert(requestUrls.every(url => !url.includes('#setup=')), 'Setup credentials must never enter request URLs')
  assert.equal(await page.evaluate(() => [...Object.values(localStorage)].some(v => v.includes('a'.repeat(43)))), false)
  console.log('Auth: passwordless setup, invalid-link recovery, fragment removal, refresh retention, additional-device link, logout, narrow layouts and no credential URL/storage leakage passed.')
} finally { await browser.close() }
