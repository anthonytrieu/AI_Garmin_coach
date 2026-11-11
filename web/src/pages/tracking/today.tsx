import { Link } from 'react-router-dom'
import { useTracking } from '@/components/tracking-provider'
import { dayOffset, mealTotals, today, weekStart, weightAverage } from '@/lib/tracking'
import { Card, Page } from './shared'
export default function Today() {
  const t = useTracking(), date = today(), meals = t.rows('meal').filter(r => r.data!.date === date), totals = mealTotals(meals.map(r => r.data!)), weights = t.rows('weight').map(r => r.data!).sort((a, b) => b.date.localeCompare(a.date)), latest = weights.find(w => w.date <= date), avg = weightAverage(weights, date), start = weekStart(date), end = dayOffset(start, 6)
  const minutes = t.rows('ride').filter(r => r.data!.date >= start && r.data!.date <= end).reduce((n, r) => n + r.data!.minutes, 0)
  const complete = t.rows('food-day').find(r => r.id === date)?.data?.complete ?? false
  return <Page title="Today"><p className="track-muted">{new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p><div className="track-columns"><Link className="track-button primary" to={t.draft ? '/workout' : '/train'}>{t.draft ? 'Resume workout' : 'Start workout'}</Link><Link className="track-button" to="/log/meal">＋ Add meal</Link></div>
    <Card><div className="track-row between"><div><small>Latest weight{latest ? ` · ${latest.date}` : ''}</small><h2>{latest ? `${latest.pounds} lb` : 'No weigh-ins yet'}</h2>{avg.average !== null && <small>7-day average {avg.average.toFixed(1)} lb · {avg.count}/7 days</small>}</div><Link className="track-button" to="/log/weight">＋ Add weight</Link></div></Card>
    <Card><div className="track-row between"><h2>Food today</h2><span className="track-muted">{complete ? 'Marked complete' : 'Log incomplete'}</span></div><div className="track-columns"><div><strong className="track-number">{Math.round(totals.calories).toLocaleString()}</strong><small>calories logged</small></div><div><strong className="track-number">{Math.round(totals.protein)} g</strong><small>protein logged{totals.unknownProtein ? ' · some unknown' : ''}</small></div></div><p className="track-muted">Targets not set</p><Link to="/food">View meals & mark day complete →</Link></Card>
    <Card><div className="track-row between"><h2>Bike this week</h2><Link className="track-button" to="/log/ride">Log ride</Link></div><p><strong className="track-number">{minutes}</strong> / 150 min</p><progress aria-label="Weekly bike minutes" value={Math.min(minutes, 150)} max={150} /><p>{Math.max(0, 150 - minutes)} min remaining</p><small>Mon–Sun · {start} to {end}<br />Manually logged bike minutes · intended intensity: power Zone 2</small></Card>
    <p className="track-muted">Garmin expenditure estimate unavailable. Food totals are logged intake, not a measured deficit.</p>
  </Page>
}
