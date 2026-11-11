import { DEMO } from "@/lib/mode"
import { useEffect, useState } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { Button } from "@/components/ui/button"

const NAV = [
  { to: "/", label: "Today", icon: "◫" },
  { to: "/train", label: "Train", icon: "▤" },
  { to: "/schedule", label: "Schedule", icon: "▦" },
  { to: "/progress", label: "Progress", icon: "◒" },
  { to: "/coach", label: "Coach", icon: "◍" },
]

function useDarkMode() {
  const [dark, setDark] = useState(
    () =>
      localStorage.theme === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches),
  )
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.theme = dark ? "dark" : "light"
  }, [dark])
  return { dark, toggle: () => setDark((d) => !d) }
}

export default function Layout() {
  const { dark, toggle } = useDarkMode()
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-52 shrink-0 flex-col border-r bg-sidebar px-3 py-5 sm:flex">
        <div className="mb-6 px-2">
          <div className="text-sm font-semibold tracking-tight">garmin-coach</div>
          <div className="text-xs text-muted-foreground">Training, simply</div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `rounded-md px-2 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                }`
              }
            >
              <span className="mr-2 opacity-60">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-2">
          <Button variant="ghost" size="sm" onClick={toggle} className="w-full justify-start">
            {dark ? "☀ Light mode" : "☾ Dark mode"}
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap gap-2 items-center justify-between border-b px-4 py-2 sm:hidden">
          <span className="text-sm font-semibold">garmin-coach</span>
          <button onClick={toggle} className="min-h-11 px-3">{dark ? "Light" : "Dark"}</button>
        </header>
        {DEMO ? <div className="flex flex-wrap items-center gap-3 border-b bg-accent/40 px-4 py-2 text-xs">
          <strong>Portfolio demo · synthetic data · June 17, 2026</strong>
          <a className="underline" href="https://github.com/anthonytrieu/AI_Garmin_coach">Source & setup</a>
          <button className="underline" onClick={() => { Object.keys(localStorage).filter(k => k.startsWith("demo-")).forEach(k => localStorage.removeItem(k)); window.location.reload() }}>Reset demo</button>
        </div> : <div className="border-b px-4 py-2 text-right text-xs"><button onClick={async () => { await fetch("/api/auth/logout", {method: "POST"}); window.location.reload() }}>Sign out</button></div>}
        <main className="min-w-0 flex-1 pb-24 sm:pb-0">
          <Outlet />
        </main>
        <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t bg-background px-1 pt-2 sm:hidden" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
          {NAV.map(i => <NavLink key={i.to} to={i.to} end={i.to === "/"} className={({ isActive }) => `flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] ${isActive ? "bg-accent text-foreground" : "text-muted-foreground"}`}><span className="text-lg" aria-hidden="true">{i.icon}</span>{i.label}</NavLink>)}
        </nav>
      </div>
    </div>
  )
}
