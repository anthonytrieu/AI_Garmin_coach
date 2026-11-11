import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTracking } from '@/components/tracking-provider'
import { mealTotals, today } from '@/lib/tracking'
import { Card, Empty, Page } from './shared'
export default function Food() {
  const t = useTracking(), [date, setDate] = useState(today), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const rows = t.rows('meal').filter(r => r.data!.date === date).sort((a, b) => a.data!.time.localeCompare(b.data!.time)), total = mealTotals(rows.map(r => r.data!)), complete = t.rows('food-day').find(r => r.id === date)?.data?.complete ?? false
  return <Page title="Food log"><label>Date<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label><Link className="track-button primary" to="/log/meal">＋ Add meal</Link><Card><h2>{Math.round(total.calories)} cal · {Math.round(total.protein)} g protein</h2>{total.unknownProtein && <small>Some protein values are unknown.</small>}<label className="track-check"><input type="checkbox" checked={complete} disabled={busy || !date || t.loading} onChange={async e => { setBusy(true); try { await t.save('food-day', date, { date, complete: e.target.checked }) } catch (err) { setError(String(err)) } finally { setBusy(false) } }} />This day's food log is complete</label><small>Logged intake does not establish a measured deficit.</small></Card>{error && <p role="alert">{error}</p>}{!rows.length && <Empty>No meals logged for this date.</Empty>}{rows.map(r => <Card key={r.id}><h2>{r.data!.name}</h2><p>{r.data!.time}</p><p>{Math.round(r.data!.calories * r.data!.servings)} cal · {r.data!.protein === null ? 'protein unknown' : `${Math.round(r.data!.protein * r.data!.servings)} g protein`}</p><div className="track-row"><Link className="track-button" to={`/log/meal/${r.id}`}>Edit</Link><Link className="track-button" to={`/log/meal?repeat=${r.id}`}>Repeat meal</Link></div></Card>)}</Page>
}
