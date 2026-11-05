import AuthGate from "@/components/auth-gate"
import DemoCoach from "@/pages/demo-coach"
import { DEMO } from "@/lib/mode"
import { BrowserRouter, Route, Routes } from "react-router-dom"
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

function AppRoutes() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/rides/:id" element={<RideDetail />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/fuel" element={<Fuel />} />
          <Route path="/coach" element={DEMO ? <DemoCoach /> : <Coach />} />
        </Route>
      </Routes>
    </>
  )
}
