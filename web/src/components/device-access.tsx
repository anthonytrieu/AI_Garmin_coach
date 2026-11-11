import { useState } from 'react'
import { TrackingDialog } from '@/pages/tracking/dialog'

export default function DeviceAccess() {
  const [open, setOpen] = useState(false), [link, setLink] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false)
  return <>
    <button className="min-h-11 px-3" onClick={() => { setOpen(true); setError(''); setLink(''); setCopied(false) }}>Device access</button>
    {open && <TrackingDialog title="Device access" onClose={() => setOpen(false)}><div className="tracking-page !p-0">
      <h2>Connect another device</h2>
      <p>Open a one-time setup link on your other browser or phone. That device will stay signed in for 90 days.</p>
      {error && <p role="alert">{error}</p>}
      {!link ? <button className="primary" disabled={busy} onClick={async () => {
        setBusy(true); setError('')
        try {
          const response = await fetch('/api/auth/setup-link', { method: 'POST' })
          if (!response.ok) throw Error(response.status === 401 ? 'Your device session expired. Open a new private setup link.' : 'Could not create a setup link. Please retry later.')
          const body = await response.json(); setLink(body.url)
        } catch (err) { setError(err instanceof Error ? err.message : 'Could not create a link.') }
        finally { setBusy(false) }
      }}>{busy ? 'Creating…' : 'Create one-time link'}</button> : <>
        <label>Private setup link<input readOnly value={link} onFocus={event => event.target.select()} /></label>
        <p className="track-muted">This link expires in 15 minutes and works once. Only send it to your own device.</p>
        <button className="primary" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true) } catch { setError('Select the link above and copy it manually.') } }}>{copied ? 'Copied' : 'Copy link'}</button>
      </>}
      <button onClick={() => setOpen(false)}>Close</button>
    </div></TrackingDialog>}
  </>
}
