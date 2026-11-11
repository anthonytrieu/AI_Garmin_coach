import DeviceAccess from './device-access'
import { House, Dumbbell, CalendarDays, ChartNoAxesCombined, MessageCircle, Sun, Moon } from 'lucide-react'
import { useTracking } from '@/components/tracking-provider'
import { DEMO } from "@/lib/mode"
import { useEffect, useState } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"

const NAV = [
  { to: "/", label: "Today", icon: House },
  { to: "/train", label: "Train", icon: Dumbbell },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/progress", label: "Progress", icon: ChartNoAxesCombined },
  { to: "/coach", label: "Coach", icon: MessageCircle },
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
  const { pathname } = useLocation()
  const { dark, toggle } = useDarkMode()
  const { draft } = useTracking()
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
                  (isActive || (item.to === "/train" && pathname === "/workout"))
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                }`
              }
            >
              <item.icon size={20} className="mr-2 inline-block" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-2">
          <Button variant="ghost" size="sm" onClick={toggle} className="w-full justify-start">
            {dark ? <Sun size={18} /> : <Moon size={18} />}{dark ? "Light mode" : "Dark mode"}
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
        </div> : <div className="flex items-center justify-end border-b px-4 py-1 text-xs"><DeviceAccess /><button className="min-h-11 px-3" onClick={async () => { await fetch("/api/auth/logout", {method: "POST"}); window.location.reload() }}>Sign out</button></div>}
        <main className="min-w-0 flex-1 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-0">
          {draft?.data.status === "draft" && pathname !== "/workout" && <NavLink className="workout-resume" to="/workout"><Dumbbell size={18} /><span>{draft.data.name}<small>Workout in progress</small></span><strong>Resume →</strong></NavLink>}
          <Outlet />
        </main>
        <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t bg-background px-1 pt-2 sm:hidden" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
          {NAV.map(i => <NavLink key={i.to} to={i.to} end={i.to === "/"} className={({ isActive }) => `flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] ${(isActive || (i.to === "/train" && pathname === "/workout")) ? "bg-accent text-primary" : "text-muted-foreground"}`}><i.icon size={21} strokeWidth={2} aria-hidden="true" />{i.label}</NavLink>)}
        </nav>
      </div>
    </div>
  )
}
