import type { RideSummary, RideDetailResponse, SessionsResponse, WeekSummary, WellnessResponse, StatusResponse, ForecastResponse } from "./api"

// Generated from invented values; no Garmin export, route coordinates or account IDs.
const date = (offset: number) => new Date(Date.UTC(2026, 5, 17 + offset)).toISOString().slice(0, 10)
export const demoRides: RideSummary[] = Array.from({ length: 24 }, (_, i) => {
  const long = i % 3 === 0
  const duration = long ? 10800 : 3600 + (i % 3) * 1800
  const distance = duration / 3600 * 27
  return {
    activity_id: 9000 + i, name: ["Rolling hills endurance", "Recovery spin", "Steady tempo"][i % 3],
    activity_type: "road_biking", start_time_local: `${date(-i * 2)}T08:00:00`,
    duration_s: duration, moving_duration_s: duration, distance_km: distance,
    elevation_gain_m: long ? 800 : 260, avg_speed_kmh: 27,
    avg_hr_bpm: 130 + i % 3 * 5, max_hr_bpm: 166,
    avg_power_w: [150, 110, 180][i % 3], max_power_w: 360, normalized_power_w: [165, 120, 195][i % 3],
    avg_cadence_rpm: 86, left_balance_pct: 49 + (i % 3) * 0.5,
    right_balance_pct: 51 - (i % 3) * 0.5,
    calories_kcal: Math.round(duration / 3600 * 500), training_load: long ? 100 : 45,
    power_note: "Synthetic dual-sided power data",
  }
})
export const demoSessions: SessionsResponse = {
  plan: "Summer endurance — example plan", event_date: "2026-07-25",
  note: "Synthetic example. Adapt sessions to your recovery and availability.",
  weeks: Array.from({ length: 8 }, (_, i) => ({
    week: i + 1, start: date(-16 + i * 7), focus: i % 4 === 3 ? "Recovery and consistency" : "Build aerobic endurance",
    sessions: [
      { id: `w${i}-easy`, title: "Easy spin", kind: "easy", duration_min: 45, target: "Comfortable effort", detail: "Keep the effort conversational." },
      { id: `w${i}-tempo`, title: "Controlled tempo", kind: "tempo", duration_min: 60, target: "75–85% of current FTP", detail: "Warm up, ride two steady blocks, cool down.", alt: "45 minutes easy" },
      { id: `w${i}-long`, title: "Long endurance ride", kind: "long", duration_min: 150, target: "60–70% of current FTP", detail: "Build duration gradually. Practise a familiar fueling routine.", alt: "90 minutes easy" },
    ],
  })),
}
export const demoPlan = { name: "example-endurance-plan", markdown: `# Summer endurance\n\n**Synthetic portfolio example — not a personal prescription.**\n\nBuild consistency across eight weeks with an easy spin, controlled tempo session and a long endurance ride. Use the Schedule page to place sessions around your availability.\n\n## Week structure\n\n- Easy spin: 45 minutes at a conversational effort.\n- Controlled tempo: 60 minutes including two steady blocks.\n- Long endurance: 150 minutes, with a 90-minute easier alternative.\n\n## Recovery\n\nKeep an easy day between demanding sessions. If recovery data is missing, ask about sleep and subjective fatigue rather than assuming readiness.\n\n## Fueling\n\nUse the Fuel page to explore a timed plan. Practise tolerable amounts in training and adapt to conditions.\n\nThe example athlete has an FTP of 240 W. Every number in this demo is invented.` }
const status: StatusResponse = {
  training_status: { training_status_phrase: "PRODUCTIVE", acute_load: 420, chronic_load: 400, acwr_ratio: 1.05, acwr_status: "OPTIMAL", load_balance_phrase: "BALANCED", vo2max_cycling: 48 },
  ftp: { ftp_w: 240, set_on: date(-14), is_stale: false },
  vo2max: { vo2max_cycling: 48, fitness_age: null }, fitness_age: {},
}
function weeks(count: number): WeekSummary[] {
  return Array.from({ length: count }, (_, i) => {
    const start = date(-2 - i * 7), end = date(4 - i * 7)
    const rides = demoRides.filter(r => r.start_time_local!.slice(0, 10) >= start && r.start_time_local!.slice(0, 10) <= end)
    const sum = (key: keyof RideSummary) => rides.reduce((n, r) => n + Number(r[key]), 0)
    const hardest = [...rides].sort((a, b) => b.training_load! - a.training_load!)[0]
    return { week_start: start, week_end: end, ride_count: rides.length, total_duration_h: sum("duration_s") / 3600,
      total_moving_h: sum("moving_duration_s") / 3600, total_distance_km: sum("distance_km"),
      total_elevation_gain_m: sum("elevation_gain_m"), total_training_load: sum("training_load"),
      hardest_ride: hardest ? { activity_id: hardest.activity_id, name: hardest.name, date: hardest.start_time_local, training_load: hardest.training_load } : null }
  })
}
function wellness(days: number): WellnessResponse {
  return {
    sleep: { nights: Array.from({length: days}, (_, i) => ({date: date(i - days + 1), total_sleep_s: 27000 + i % 3 * 900, deep_s: 4500, light_s: 14400 + i % 3 * 900, rem_s: 8100, sleep_score: 80 + i % 5, sleep_score_qualifier: "GOOD", avg_overnight_hrv_ms: 52 + i % 4, resting_hr_bpm: 52})), missing_dates: [] },
    hrv: { days: Array.from({length: days}, (_, i) => ({date: date(i - days + 1), last_night_avg_ms: 52 + i % 4, weekly_avg_ms: 53, status: "BALANCED"})), missing_dates: [] },
    resting_hr: { days: Array.from({length: days}, (_, i) => ({date: date(i - days + 1), resting_hr_bpm: 52})), missing_dates: [] },
  }
}
function detail(id: number): RideDetailResponse {
  const r = demoRides.find(r => r.activity_id === id)
  if (!r) throw new Error("Example ride not found")
  const duration = r.duration_s!
  const zones = (boundary: string, low: number[]) => ({ total_time_s: duration, zones: [0.1, 0.65, 0.2, 0.04, 0.01].map((share, i) => ({zone: i + 1, time_s: duration * share, share_pct: share * 100, [boundary]: low[i]})) })
  return { summary: {...r, intensity_factor: r.normalized_power_w! / 240, training_stress_score: Math.round(duration / 3600 * (r.normalized_power_w! / 240) ** 2 * 100)},
    power_zones: zones("low_boundary_w", [0, 132, 180, 216, 252]), hr_zones: zones("low_boundary_bpm", [0, 110, 135, 150, 165]),
    weather: { conditions: "Synthetic clear weather", temp_c: 19, apparent_temp_c: 19, humidity_pct: 60, wind_kmh: 8, wind_direction: "W" },
    splits: { lap_count: 3, laps: Array.from({length: 3}, (_, i) => ({lap_index: i + 1, distance_km: r.distance_km! / 3, moving_duration_s: duration / 3, elevation_gain_m: r.elevation_gain_m! / 3, avg_power_w: r.avg_power_w, normalized_power_w: r.normalized_power_w, avg_hr_bpm: r.avg_hr_bpm})) },
    series: { point_count: 61, points: Array.from({length: 61}, (_, i) => ({ offset_s: duration * i / 60, distance_m: r.distance_km! * 1000 * i / 60, power_w: Math.round(r.avg_power_w! + Math.sin(i) * 35), hr_bpm: Math.round(r.avg_hr_bpm! + Math.sin(i / 5) * 8), cadence_rpm: 86, speed_kmh: 27, elevation_m: 80 + 40 * Math.sin(i / 8)})) },
  }
}
export async function demoGet(path: string): Promise<unknown> {
  const url = new URL(path, "https://demo.invalid")
  const n = (key: string, fallback: number) => Number(url.searchParams.get(key) ?? fallback)
  switch (url.pathname) {
    case "/api/rides": return demoRides.slice(0, n("limit", 10))
    case "/api/status": return status
    case "/api/weekly": return { weeks: weeks(n("weeks", 8)) }
    case "/api/wellness": return wellness(n("days", 7))
    case "/api/sessions": return demoSessions
    case "/api/plan": return demoPlan
    case "/api/chat/conversations": return []
    case "/api/courses": return [{course_id: 1, name: "Example rolling loop", activity_type: "road_biking", distance_km: 81, elevation_gain_m: 800, elevation_loss_m: 800}]
    case "/api/weather": return { location: "Example region (synthetic)", daily: Array.from({length: n("days", 7)}, (_, i) => ({date: date(i), temp_max_c: 19 + i % 3, temp_min_c: 12, precip_probability_pct: i % 3 * 10, wind_max_kmh: 8, conditions: "Mostly clear"})), next_36h: [] } satisfies ForecastResponse
    default: if (/^\/api\/rides\/\d+$/.test(url.pathname)) return detail(Number(url.pathname.split("/").pop()))
  }
  throw new Error("Not available in the demo")
}
export const exampleReplies = [
  {question: "How was my last ride?", answer: "**Example response — not live AI.**\n\nThe synthetic Rolling hills endurance ride covers 81 km in 3 hours, with 800 m of climbing and 150 W average power. Its 165 W normalized power is about 69% of the example athlete’s 240 W FTP. That suggests an endurance effort overall; it does not establish recovery readiness."},
  {question: "Am I recovered enough for intervals tomorrow?", answer: "**Example response — not live AI.**\n\nThe demo includes sleep and HRV, but no training-readiness score. I would ask about fatigue, soreness and how you slept before recommending intervals. If you feel unusually tired, choose the easy alternative instead of treating a single metric as clearance."},
  {question: "What should I focus on this weekend?", answer: "**Example response — not live AI.**\n\nThe example plan prioritizes a conversational endurance ride, with a shorter alternative. Place it after an easy day and use the Fuel page to explore a familiar fueling routine. A real plan would also consider your availability and recent training."},
]
