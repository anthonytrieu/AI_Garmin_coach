import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DEMO } from '@/lib/mode'
import { readTracking, writeTracking, uid, TrackingError } from '@/lib/tracking'
import type { Kind, Records, Row, Snapshot, Workout, Mutation } from '@/lib/tracking'

const key = DEMO ? 'demo-workout-draft-v1' : 'owner-workout-draft-v1'
type Draft = { id: string; revision: number; data: Workout; pending?: Mutation<'workout'>; dirty: boolean }
type Context = {
  snapshot: Snapshot; loading: boolean; error: string; status: string; draft: Draft | null;
  rows: <K extends Kind>(kind: K) => Row<K>[];
  save: <K extends Kind>(kind: K, id: string, data: Records[K] | null) => Promise<void>;
  editDraft: (id: string, data: Workout) => void; retry: () => void;
  recoverServerDraft: () => Promise<void>;
  finish: (status: 'completed' | 'discarded') => Promise<void>; reload: () => Promise<void>;
}
const TrackingContext = createContext<Context | null>(null)
export function useTracking() { const value = useContext(TrackingContext); if (!value) throw new Error('Tracking provider missing'); return value }
function cachedDraft(): Draft | null { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null } catch { return null } }

export default function TrackingProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ records: [], position: 0 }), snapshotRef = useRef(snapshot)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [status, setStatus] = useState('')
  const [draft, setDraft] = useState<Draft | null>(cachedDraft), draftRef = useRef(draft)
  const busy = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null), blocked = useRef(false)
  function persist(d: Draft | null) {
    draftRef.current = d; setDraft(d)
    try { if (d) localStorage.setItem(key, JSON.stringify(d)); else localStorage.removeItem(key) }
    catch { setStatus('Device storage unavailable. Keep this page open until server save succeeds.'); throw new Error('Device storage unavailable; keep this page open.') }
  }
  function accept(record: Row, position: number) {
    const next = { records: snapshotRef.current.records.filter(r => !(r.kind === record.kind && r.id === record.id)).concat(record), position }
    snapshotRef.current = next; setSnapshot(next)
  }
  async function flush() {
    if (busy.current || blocked.current || !draftRef.current) return
    busy.current = true
    try {
      while (draftRef.current && (draftRef.current.dirty || draftRef.current.pending)) {
        const d = draftRef.current
        const pending: Mutation<'workout'> = d.pending ?? { kind: 'workout', id: d.id, revision: d.revision, mutationId: uid(), data: structuredClone(d.data) }
        persist({ ...d, pending, dirty: false }); setStatus('Saving…')
        const result = await writeTracking(pending)
        accept(result.record, result.position)
        const latest = draftRef.current!
        if (pending.data?.status !== 'draft' && !latest.dirty) { persist(null); setStatus('Saved'); break }
        persist({ ...latest, revision: result.record.revision, pending: undefined })
        setStatus(DEMO ? 'Saved in this demo browser' : 'Saved on device and server')
      }
    } catch (e) {
      if (e instanceof TrackingError && e.status === 409) blocked.current = true
      if (e instanceof TrackingError && e.status === 422 && draftRef.current) {
        persist({ ...draftRef.current, pending: undefined, dirty: true })
      }
      setStatus(e instanceof TrackingError ? e.message : 'Offline or save failed · draft retained on this device. Retry when connected.')
    } finally { busy.current = false }
  }
  async function reload() {
    setLoading(true); setError('')
    try {
      const data = await readTracking(); snapshotRef.current = data; setSnapshot(data)
      if (draftRef.current && !draftRef.current.dirty && !draftRef.current.pending) {
        const server = data.records.find(r => r.kind === 'workout' && r.id === draftRef.current!.id) as Row<'workout'> | undefined
        if (server && server.revision > draftRef.current.revision) {
          persist(server.data?.status === 'draft' ? { id: server.id, revision: server.revision, data: server.data, dirty: false } : null)
        }
      }
      if (!draftRef.current) {
        const existing = data.records.find(r => r.kind === 'workout' && (r.data as Workout)?.status === 'draft') as Row<'workout'> | undefined
        if (existing?.data) persist({ id: existing.id, revision: existing.revision, data: existing.data, dirty: false })
      }
      await flush()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load records') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    void reload()
    const online = () => { void flush() }
    window.addEventListener('online', online)
    return () => { window.removeEventListener('online', online); if (timer.current) clearTimeout(timer.current) }
    // Refs serialize writes; mount once so navigation never interrupts a save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function editDraft(id: string, data: Workout) {
    const current = draftRef.current
    if (current && current.id !== id) throw new Error('Finish or discard your current draft first.')
    const row = snapshotRef.current.records.find(r => r.kind === 'workout' && r.id === id)
    persist({ ...current, id, revision: current?.revision ?? row?.revision ?? 0, data, dirty: true })
    setStatus('Saved on device · waiting to sync')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush() }, 500)
  }
  async function finish(state: 'completed' | 'discarded') {
    const d = draftRef.current; if (!d) return
    editDraft(d.id, { ...d.data, status: state }); await flush()
  }
  const writes = useRef(new Map<string, Mutation>())
  async function save<K extends Kind>(kind: K, id: string, data: Records[K] | null) {
    const cacheKey = kind + ':' + id
    let mutation = writes.current.get(cacheKey)
    if (mutation && JSON.stringify(mutation.data) !== JSON.stringify(data)) {
      const previous = await writeTracking(mutation)
      accept(previous.record, previous.position); writes.current.delete(cacheKey); mutation = undefined
    }
    if (!mutation) { const row = snapshotRef.current.records.find(r => r.kind === kind && r.id === id); mutation = { kind, id, data, revision: row?.revision ?? 0, mutationId: uid() }; writes.current.set(cacheKey, mutation) }
    try {
      const result = await writeTracking(mutation); writes.current.delete(cacheKey); accept(result.record, result.position)
    } catch (e) {
      if (e instanceof TrackingError && [409, 422].includes(e.status)) writes.current.delete(cacheKey)
      throw e
    }
  }
  async function recoverServerDraft() {
    if (busy.current) throw new Error('Wait for the current save to finish.')
    if (draftRef.current) localStorage.setItem(key + '-recovery-' + Date.now(), JSON.stringify(draftRef.current))
    persist(null); blocked.current = false; await reload(); setStatus('Server copy loaded; previous draft backed up on this device.')
  }
  const rows = <K extends Kind>(kind: K) => snapshot.records.filter(r => r.kind === kind && r.data !== null) as Row<K>[]
  return <TrackingContext.Provider value={{ snapshot, loading, error, status, draft, rows, save, editDraft, finish, reload, recoverServerDraft, retry: () => { blocked.current = false; void flush() } }}>{children}</TrackingContext.Provider>
}
