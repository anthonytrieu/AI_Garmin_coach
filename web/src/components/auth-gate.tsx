import { useEffect, useState, type ReactNode } from "react"
import { Button } from "./ui/button"

// Keep the setup credential only in module memory, never in storage or request URLs.
let pendingSetupToken = ""
function captureSetupLink() {
  const fragment = new URLSearchParams(window.location.hash.slice(1))
  if (!fragment.has("setup")) return
  pendingSetupToken = fragment.get("setup") ?? ""
  fragment.delete("setup")
  const remaining = fragment.toString()
  window.history.replaceState(null, "", window.location.pathname + window.location.search + (remaining ? "#" + remaining : ""))
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "setup" | "ready">("loading")
  const [hasLink, setHasLink] = useState(() => { captureSetupLink(); return !!pendingSetupToken })
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  async function checkSession() {
    try {
      const response = await fetch("/api/auth/session")
      if (response.ok) { pendingSetupToken = ""; setHasLink(false); setState("ready") }
      else if (response.status === 401) setState("setup")
      else { setError("The server is unavailable. Please retry."); setState("setup") }
    } catch { setError("Unable to reach your coach. Check your connection and retry."); setState("setup") }
  }
  useEffect(() => {
    const receiveLink = () => { captureSetupLink(); if (pendingSetupToken) { setHasLink(true); setError(""); setState("setup") } }
    window.addEventListener("hashchange", receiveLink)
    void checkSession()
    return () => window.removeEventListener("hashchange", receiveLink)
  }, [])
  if (state === "loading") return <p className="p-6">Checking your device…</p>
  if (state === "ready") return <>{children}</>
  return <main className="mx-auto max-w-sm space-y-4 p-6 pt-24">
    <h1 className="text-2xl font-semibold">Your private coach</h1>
    <p className="text-sm text-muted-foreground">{hasLink ? "Remember this personal device for 90 days. You’ll stay signed in when the app is updated." : "Open your one-time private setup link to connect this device. Once connected, you won’t need to enter a password."}</p>
    {error && <p role="alert" className="text-sm">{error}</p>}
    {hasLink ? <Button type="button" disabled={busy} onClick={async () => {
      if (busy) return
      setBusy(true); setError("")
      try {
        const response = await fetch("/api/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: pendingSetupToken }) })
        if (!response.ok) throw Error(response.status === 429 ? "Too many attempts. Wait a minute and retry." : response.status === 401 ? "This link has expired or was already used. Open a fresh private setup link." : "Unable to connect this device. Please retry.")
        pendingSetupToken = ""; setHasLink(false); setState("ready")
      } catch (err) {
        // A response may be lost after the cookie was set. Check before asking for another link.
        try { if ((await fetch("/api/auth/session")).ok) { pendingSetupToken = ""; setHasLink(false); setState("ready"); return } } catch { /* Keep the retry available. */ }
        setError(err instanceof Error ? err.message : "Unable to connect this device.")
      } finally { setBusy(false) }
    }}>{busy ? "Connecting…" : "Remember this device"}</Button> : <Button type="button" onClick={() => { setError(""); void checkSession() }}>Check this device</Button>}
    <p className="text-sm text-muted-foreground">Setup links work once. A new browser, cleared cookies, or signing out will require a new link.</p>
  </main>
}
