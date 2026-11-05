import { useEffect, useState, type ReactNode } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
export default function AuthGate({children}: {children: ReactNode}) {
  const [state, setState] = useState<"loading" | "login" | "ready">("loading")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void fetch("/api/auth/session").then(r => setState(r.ok ? "ready" : "login")).catch(() => {setError("Server unavailable. Please retry."); setState("login")})
  }, [])
  if (state === "loading") return <p className="p-6">Checking your session…</p>
  if (state === "ready") return <>{children}</>
  return <main className="mx-auto max-w-sm space-y-4 p-6 pt-24">
    <h1 className="text-2xl font-semibold">Your private coach</h1>
    <p className="text-sm text-muted-foreground">Sign in to access your Garmin data.</p>
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError("")
      try {
        const response = await fetch("/api/auth/login", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({password})})
        if (!response.ok) throw new Error(response.status === 429 ? "Too many attempts. Try again in a minute." : "Unable to sign in. Check your password.")
        setPassword(""); setState("ready")
      } catch (e) { setError(e instanceof Error ? e.message : "Unable to sign in") } finally {setBusy(false)}
    }}>
      <label className="block text-sm" htmlFor="password">Password</label>
      <Input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
      {error && <p role="alert" className="text-sm">{error}</p>}
      <Button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  </main>
}
