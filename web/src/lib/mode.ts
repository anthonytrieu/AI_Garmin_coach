// Build-time isolation: the public demo never depends on an API or credentials.
export const DEMO = import.meta.env.VITE_APP_MODE !== "personal"
export const DEMO_TODAY = "2026-06-17"
export const storageKey = (name: string) => `${DEMO ? "demo" : "garmin-coach"}-${name}`
