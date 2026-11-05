// Execute the real data adapter with fetch forbidden; no browser/backend needed.
import ts from 'typescript'
import assert from 'node:assert/strict'
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
const temp = mkdtempSync(join(tmpdir(), 'coach-demo-test-'))
try {
  for (const name of ['mode', 'demo', 'api', 'format', 'fueling']) {
    let source = readFileSync(new URL(`./src/lib/${name}.ts`, import.meta.url), 'utf8')
    source = source.replace('import.meta.env.VITE_APP_MODE', 'undefined').replaceAll('"./mode"', '"./mode.mjs"').replaceAll('"./demo"', '"./demo.mjs"')
    writeFileSync(join(temp, `${name}.mjs`), ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext}}).outputText)
  }
  globalThis.fetch = () => {throw new Error('Demo attempted a network request')}
  const {api} = await import(pathToFileURL(join(temp, 'api.mjs')))
  const rides = await api.rides(30)
  assert.equal(rides.length, 24)
  for (const ride of rides) {
    const detail = await api.rideDetail(ride.activity_id)
    assert.equal(detail.summary.distance_km, ride.distance_km)
    assert.equal(detail.splits.laps.reduce((sum, lap) => sum + lap.moving_duration_s, 0), ride.duration_s)
    assert.equal(Math.round(detail.power_zones.zones.reduce((sum, z) => sum + z.time_s, 0)), ride.duration_s)
  }
  const weeks = await api.weekly(8)
  assert.equal(weeks.weeks.reduce((sum,w) => sum + w.ride_count,0), rides.length)
  assert.equal(weeks.weeks.reduce((sum,w) => sum+w.total_distance_km,0), rides.reduce((sum,r) => sum+r.distance_km,0))
  await api.status(); await api.wellness(); await api.weather(); await api.courses(); await api.plan(); await api.conversations()
  const sessions = await api.sessions()
  assert(sessions.weeks.some(w => w.start === '2026-06-15'))
  await assert.rejects(() => api.rideDetail(-1))
  const {computePlan} = await import(pathToFileURL(join(temp, 'fueling.mjs')))
  for (const duration of [15, 60, 180, 285]) {
    for (const drink of ['water', 'maurten160']) {
      const plan = computePlan({duration_min: duration, intensity: 'tempo', carbs_per_h: 90,
        sweat_rate_l_h: 1, sodium_loss_mg_l: 950, drink_id: drink, solid_id: 'syrup', interval_min: 20, custom_products: []})
      for (const key of ['carbs_g','fluid_ml','sodium_mg']) assert.equal(Math.round(plan.rows.reduce((n,r) => n+r[key],0)), plan.totals[key])
    }
  }
  console.log('Demo adapter: all routes offline, 24 consistent rides, weekly totals and stable schedule verified.')
} finally {rmSync(temp, {recursive: true, force: true})}
