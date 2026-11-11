import ImportHistory from "@/pages/tracking/import-history"
import CyclingSchedule from "@/pages/cycling-schedule"
import TrackingProvider from "@/components/tracking-provider"
import Today from "@/pages/tracking/today"
import Train from "@/pages/tracking/train"
import Workout from "@/pages/tracking/workout"
import Entry from "@/pages/tracking/entry"
import Food from "@/pages/tracking/food"
import Progress from "@/pages/tracking/progress"
import AuthGate from "@/components/auth-gate"
import DemoCoach from "@/pages/demo-coach"
import { DEMO } from "@/lib/mode"
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom"
import Layout from "@/components/layout"
import Coach from "@/pages/coach"
import Dashboard from "@/pages/dashboard"
import Fuel from "@/pages/fuel"
import Plan from "@/pages/plan"
import Schedule from "@/pages/schedule"
import RideDetail from "@/pages/ride-detail"

export default function App() {
  return <BrowserRouter>{DEMO ? <AppRoutes /> : <AuthGate><AppRoutes /></AuthGate>}</BrowserRouter>
}

function EntryRoute() { const location = useLocation(); return <Entry key={location.pathname + location.search} /> }

function AppRoutes() {
  return (
    <TrackingProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Today />} />
          <Route path="/train" element={<Train />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/import" element={<ImportHistory />} />
          <Route path="/food" element={<Food />} />
          <Route path="/log/:kind" element={<EntryRoute />} />
          <Route path="/log/:kind/:id" element={<EntryRoute />} />
          <Route path="/cycling" element={<Dashboard />} />
          <Route path="/rides/:id" element={<RideDetail />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/cycling-schedule" element={<CyclingSchedule />} />
          <Route path="/fuel" element={<Fuel />} />
          <Route path="/coach" element={DEMO ? <DemoCoach /> : <Coach />} />
        </Route>
      </Routes>
    </TrackingProvider>
  )
}
