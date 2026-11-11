// Requires a local personal-mode Vite server on 5174; all API calls are mocked.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  let loggedIn = false, attempts = 0
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/login') {
      attempts++; loggedIn = route.request().postDataJSON().password === 'synthetic-password'
      return route.fulfill({ status: loggedIn ? 200 : 401, json: { authenticated: loggedIn } })
    }
    if (path === '/api/auth/logout') loggedIn = false
    await route.fulfill({ status: loggedIn ? 200 : 401, json: path === '/api/tracking' ? { records: [], position: 0 } : { authenticated: loggedIn } })
  })
  await page.goto('http://127.0.0.1:5174')
  await page.getByLabel('Password', { exact: true }).fill('wrong')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('alert').waitFor()
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor()
  assert.equal(attempts, 2)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByLabel('Password', { exact: true }).waitFor()
  console.log('Auth: click submits, invalid password displays error, corrected login and logout pass.')
} finally { await browser.close() }
