import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTracking } from '@/components/tracking-provider'
export function Page({ title, children }: { title: string; children: ReactNode }) { const t = useTracking(); return <div className="tracking-page"><h1>{title}</h1>{t.loading && <p role="status">Loading your records…</p>}{t.error && <div role="alert" className="track-card"><p>{t.error}</p><button onClick={() => void t.reload()}>Retry loading</button></div>}{children}</div> }
export function Card({ children }: { children: ReactNode }) { return <section className="track-card">{children}</section> }
export function SyncStatus() {
  const t = useTracking()
  const [confirm, setConfirm] = useState(false)
  function exportDraft() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(t.draft, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'workout-draft.json'; a.click(); URL.revokeObjectURL(url)
  }
  return <div className="track-sync">
    <span role="status">{t.status || 'Draft ready'}</span>
    <details>
      <summary>Sync & recovery</summary>
      <button onClick={t.retry}>Retry sync</button>
      {t.draft && <button onClick={exportDraft}>Export draft</button>}
      <button onClick={() => setConfirm(!confirm)} aria-expanded={confirm}>Resolve conflict</button>
      {confirm && <div>
        <p>Load the server copy? Your current draft will be backed up on this device first. Export it above for a portable copy.</p>
        <button onClick={() => { void t.recoverServerDraft().then(() => setConfirm(false)).catch(() => {}) }}>Back up draft & load server copy</button>
        <button onClick={() => setConfirm(false)}>Cancel</button>
      </div>}
    </details>
  </div>
}
export function Empty({ children }: { children: ReactNode }) { return <p className="track-muted">{children}</p> }
export function Back({ to = '/train', children = 'Train' }: { to?: string; children?: ReactNode }) { return <Link className="track-link" to={to}>‹ {children}</Link> }
