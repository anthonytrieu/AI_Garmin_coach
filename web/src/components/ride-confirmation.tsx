import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTracking } from '@/components/tracking-provider'
import type { BikeRide } from '@/lib/tracking'
import { uid } from '@/lib/tracking'
export default function RideConfirmation({ initial, onClose }: { initial: BikeRide; onClose: () => void }) {
  const t = useTracking(), [id] = useState(uid), [date, setDate] = useState(initial.date), [minutes, setMinutes] = useState(String(initial.minutes)), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState('')
  return <div className="tracking-page !p-0"><section className="track-card" aria-label="Confirm bike ride"><h2>{saved ? 'Ride saved' : 'Save this ride?'}</h2><small>Parsed on this device · no AI needed</small>{saved ? <><p>{minutes} min · {date} · manual</p><Link className="track-button" to="/">View weekly gauge</Link><button onClick={onClose}>Close</button></> : <form onSubmit={async e => { e.preventDefault(); if (busy || saved) return; setBusy(true); try { await t.save('ride', id, { ...initial, date, minutes: +minutes }); setSaved(true) } catch (err) { setError(String(err)) } finally { setBusy(false) } }}><fieldset disabled={busy || t.loading}><div className="track-columns"><label>Bike minutes<input type="number" min="0.1" max="1440" step="any" inputMode="decimal" required value={minutes} onChange={e => setMinutes(e.target.value)} /></label><label>Ride date<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label></div>{error && <p role="alert">{error}</p>}<button className="primary">{busy ? 'Saving…' : 'Save ride'}</button><button type="button" onClick={onClose}>Cancel</button></fieldset></form>}</section></div>
}
