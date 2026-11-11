# Development handoff: Garmin Coach winter iteration

Last updated: November 10, 2026. This file captures conversation decisions; it is not evidence that planned features are implemented.

## Start here

1. Read `plan.md` for the next iteration's scope and acceptance checks.
2. Read this file for confirmed preferences and the finalized Legs exercise order/set counts.
3. Inspect Git status and applicable repository instructions. Preserve existing changes.
4. Read the latest entries in `PROJECT_PLAN.md` for deployment/validation history; its opening status and some README wording are stale.

Repository: `/Users/anthonytrieu/Desktop/projects/garmin-app/garmin`.
Remote: https://github.com/anthonytrieu/AI_Garmin_coach
Current branch at handoff: `portfolio-release`.
Existing draft PR: https://github.com/anthonytrieu/AI_Garmin_coach/pull/1 (last checked open; verify before updating).
The planning files are local/uncommitted at handoff. The earlier deployment roadmap also has a local link to plan.md. Implementation scope and layouts were approved; the local manual-tracking implementation is now built and tested (November 10). No new costs are authorized.

## What already exists

- React/Vite/TypeScript frontend under `web`; FastAPI/Python backend under `src/garmin_coach`.
- Public synthetic demo: https://garmin-coach-demo.vercel.app
- Private single-owner app: https://garmin-coach-personal.vercel.app
- Railway project GarminCoach, service coach-api; persistent `/data` volume for Garmin tokens, private context, and SQLite chat history.
- Backend: https://coach-api-production-a667.up.railway.app
- Existing dashboard, Schedule, cycling views, fueling planner, and streamed Groq coach.
- Owner login uses secure cookies. Restart revokes sessions. One process/replica is assumed.
- Demo and personal frontend deployment configurations are separate. Never deploy a personal build to the public demo project.
- Railway infrastructure: `.railway/railway.ts`; secrets unmanaged. Deprecated railway.json was removed. Prior IaC tooling showed builder drift despite a successful Dockerfile deployment; review plans for destructive changes, particularly volume replacement.
- Backend checks: `.venv/bin/python -m pytest -q`, `.venv/bin/ruff check src tests`, `.venv/bin/python -m mypy`. Use Python module invocations because some virtualenv console-script paths were stale after the repository moved.
- Last recorded validation: 73 tests, Ruff, mypy, GitHub checks, and a synthetic live tool-call test passed. This is historical evidence, not a fresh check.
- Groq model configured as `openai/gpt-oss-120b`. Repeated generic quota errors prompted a November 9 fix: smaller context/results, aggregate request guard, precise quota errors, and one bounded short retry. Deployment `b071ab32-ff8d-4ca6-b16a-cb7b9901fdd0` succeeded. The user's exact failed query was not replayed afterward.

## Product direction and confirmed preferences

- Approximately 95% iPhone usage. Fast one-handed entry is more important than feature count.
- Bodybuilding is now the main focus. Fondo is past: archive the old plan and update private coach context when implementing.
- Owner wants gradual weight/fat loss and abdominal definition, with an expressed desired pace of 0.5–1 lb/week. Record this as a preference; do not claim scale readings measure fat loss or prescribe a deficit automatically.
- Weigh-ins are pounds and currently recorded manually in Google Sheets. Manual entry and reviewed CSV import are implemented locally; no live Sheets connection.
- Meal entry asks for calories/protein for the amount eaten; no servings, carbs/fat or favourite controls.
- Today has Start workout and Add meal prominently; compact latest-weight card has Add weight; bike gauge has Log ride.
- Preserve Schedule. Proposed navigation: Today, Train, Schedule, Progress, Coach. Phone mockups should validate the five-tab layout.
- Ordinary logging, totals, and charts must work without AI.

## Lifting decisions

Five unique templates, six rotation positions:
**Upper A → Arms A → Legs → Upper B → Arms B → Legs**.

One shared Legs template and history, not A/B leg copies. Track rotation position separately from template ID. Rest days are flexible, and sessions need not fit in a calendar week.

Original user-supplied specification has been preserved in ignored `.local/workout-template-source.md` if available. It includes the four upper/arms templates, exercise order, set counts, personal starting-weight suggestions, notes, and the old two leg templates. This is private reference data; do not commit it or import its suggestions as completed sessions. Later conversation decisions override the original document.

- User normally works up to 10 reps. Proposed default ranges: preserve 6–10, change other template ranges to 8–10. Actual reps remain freely editable; confirm proposed template defaults in preview.
- Weight/reps editable on each set; direct typing plus configurable minus/plus increments. Changes carry into the next untouched set without overwriting completed/edited sets.
- Dumbbells are recorded per dumbbell. Machine chest press is plates on one side (70 means 45 + 25). Other conventions can remain unspecified: the owner understands their own numbers and explicitly does not want mandatory clarification. No silent doubling or machine-resistance assumptions.
- Allow Swap, Skip, Add exercise, and set-count changes during a workout. Swaps affect the current session by default; changing the saved template is separate.
- Show the replacement exercise's own history; preserve already completed original sets.
- Warm-ups separate; notes/RIR optional. Starting weights are suggestions only. Autosave and resume drafts.
- Exclude Bulgarian split squats and single-leg squat variations from the supplied templates.

### Confirmed shared Legs template

The owner confirmed this exercise order and **2 working sets for every exercise**. Use the same template at both Legs positions in the rotation.

| Exercise | Working sets | Target reps (editable default) |
| --- | --- | --- |
| Romanian Deadlift (RDL) | 2 | 8–10 |
| Leg Press | 2 | 8–10 |
| Glute Bridge | 2 | 8–10 |
| Leg Curl | 2 | 8–10 |
| Leg Extension | 2 | 8–10 |
| Hip Abductor | 2 | 8–10 |
| Hip Adductor | 2 | 8–10 |

No calf raises. Exercise order and set counts are confirmed; 8–10 remains an editable rep-range default reflecting the usual 10-rep ceiling. Actual reps and weights are freely editable. Keep glute bridge as named by the owner, rather than silently substituting hip thrust or reusing its suggested load. New/unknown starting weights remain blank. Allow exercise swaps during a session while preserving completed work.

## Cycling decisions

- Weekly target: **150 total bike minutes**. Power Zone 2 is the intended intensity, but exact time-in-zone verification is not required.
- Main gauge must say bike minutes, not measured Zone 2 minutes. From an empty week, 40 min means 40/150, approximately 27%, 110 remaining.
- Manual logging is primary. Coach can parse “I biked 40 minutes” into a compact dated Save ride card; confirmation writes the record and recalculates the gauge. Avoid duplicate submissions. Date defaults today unless stated otherwise; edits/deletes recalculate totals.
- Do not infer calories burned from duration alone. Preserve source for future reconciliation with imported rides.
- Owner reports MyWhoosh rides go to Strava and watch workouts are also posted there. No automatic integration is necessary initially.
- November 9 research: Strava getting-started documentation says a subscription is required to create an API app (https://developers.strava.com/docs/getting-started/). Recheck when considering integration. An MCP wrapper does not bypass provider requirements. No subscription purchase is authorized for this feature.

## Meal screenshot decisions

- Shared workflow for HelloFresh and Factor; no need for separate brand integrations.
- Attach screenshot(s) and say “I ate one serving.” Extract name, visible nutrition, and basis; use the already supplied portion amount. Show one editable confirmation card, then update calorie/protein counters after saving.
- Combine paired name/nutrition screenshots into one meal; prevent duplicate saves.
- Owner expects Factor to be similar. A Factor sample is useful later for testing, not a blocker now. Never assume one package equals one serving without label evidence.
- Private meal-label examples are retained outside the repository. They are extraction references, not consumed meal records; public tests use synthetic values.
- Screenshots were attached in this chat; temporary attachment paths may not survive. Do not depend on those paths for production or publish the screenshots as synthetic fixtures.
- Current chat is text-only. Select and validate OCR/image processing during implementation rather than assuming Groq model image support. Keep manual logging available if extraction fails or quota is exhausted.
- Missing protein is unknown, not zero; serving math and totals are deterministic. Incomplete food logs must not imply a measured calorie deficit.

## Scope order

1. Reviewable iPhone mockups and template preview.
2. Bare bones: workout logging/swaps/recovery, manual meals/recent meals, manual weigh-ins/trends, manual bike gauge, preserved Schedule, current private goals, basic expenditure estimates where available.
3. Friction reduction: screenshot extraction/confirmation, workout-note parsing, reviewed weight CSV import, bounded Coach access to saved logs.
4. Later: schedule template slots, gym attendance calendar, Copy workout for Strava, optional imports, more advanced trends/offline sync.

Future motivation calendar counts distinct completed gym days, with week/month highlights and neutral rest days. Planned workouts and abandoned drafts do not count. Future Copy workout produces actual completed exercises/sets with optional notes, for pasting into the description of an existing Strava activity; no API, AI, or automatic posting needed.

## Boundaries and practical cautions

- Do not introduce public signup, social features, a huge food/exercise catalogue, or paid fallbacks into the initial release.
- Keep public demo entirely synthetic and private app single-owner authenticated.
- Personal data is in ignored `.local/` and private Railway storage. Never print/commit secrets or tokens. This handoff contains no secret values.
- The owner chose to keep the existing Groq key despite prior rotation advice; do not repeatedly interrupt development about that choice or reproduce the key.
- Previous approvals covered existing Vercel/Railway hosting, registering the existing SSH public key, and transferring Garmin tokens/profile/plans. Prior approval for one personal Garmin-to-Groq test is not unlimited authorization for unrelated data transfers.
- New screenshot processing must make external processing clear. Back up SQLite before migrations and test restore. Use idempotent writes and accurate timezone/date handling.
- Remaining nonblocking preferences: week starts Monday by proposal, optional load increments, CSV columns when supplied. Weight convention ambiguity and absence of a Factor sample are explicitly not blockers.

Next action: follow the owner’s development instruction in the new chat, beginning with the iPhone-first design/template preview described in plan.md. The Legs order and two-set count are confirmed; do not ask for them again. No application code or deployments were changed while preparing this handoff.

## Phone design review — November 9, 2026

- Owner approved the implementation scope and requested phone mockups before production UI coding. Existing uncommitted `PROJECT_PLAN.md`, `context.md`, and `plan.md` work was preserved; no applicable AGENTS.md was found.
- Interactive synthetic preview: `/Users/anthonytrieu/.codex/visualizations/2026/11/10/01a1c321-072c-79b2-9123-18404f3ef8d7/garmin-phone-review.html`. Today, active workout, meal entry, compact Progress, confirmed shared Legs preview, and quick weight/ride entry. Schedule/Coach are navigation placeholders, not replacements.
- Local browser checks passed: draft retention between screens, replacement exercise starts with blank load, half-serving meal totals, and no phone-content horizontal overflow at 320/375/390/430 widths across five screens; no JavaScript errors. Real iPhone keyboard/background/relaunch checks remain outstanding.
- Preview state is synthetic and only simulates saving; no backend persistence, API calls, deployment, personal-data transfer, or paid services. Production source unchanged.
- Next: incorporate layout feedback, then implement Phase 1. Four upper/arms template import previews and full template review remain pending; do not re-confirm the settled Legs list. Monday–Sunday is displayed as a proposal, not a newly confirmed preference.

### Layout feedback — November 9, 2026

- Owner accepted the other layouts and requested Train → Upper / Arms / Legs. Upper opens previews of both Upper A and Upper B; Arms opens Arms A and Arms B. Legs opens the confirmed shared template. Implement this category picker as the initial Train entry point.
- Schedule synchronization was offered as an alternative, not a requirement. Keep existing Schedule intact; template scheduling stays deferred under the bare-bones scope.
- Updated the local phone preview with category navigation and both A/B exercise lists, preserving original exercise order/set counts from the private source. Rep targets retain 6–10 and otherwise preview 8–10. No personal starting weights or historical notes are included. Choosing a template does not advance the rotation or overwrite an existing draft.
- Remaining work: production implementation and actual iPhone validation. Other layouts need no repeat approval.
- Revised preview validation passed: all three Train category routes, both Upper/Arms A/B previews, variant selection, and nine width checks at 320/390/430px; zero JavaScript errors. Train rendering inspected.

### Custom entries and progress feedback — November 9, 2026

- Owner requests creating a completely new item while swapping. Interpret the in-session Swap flow as supporting a custom exercise, not only saved exercises. Preserve completed sets, start unknown loads blank, and keep template changes separate. Also expose Create workout in Train for a custom session; this covers the owner's use of “workout” without blocking on terminology.
- Owner proposes template-first history: compare Upper A with Upper A, Arms B with Arms B, etc., then select an exercise to inspect load progression. Adopt this as the primary Progress hierarchy. Both Legs rotation slots share history.
- Compare actual completed sessions by template identity; show dates, actual sets, weights and reps. Swapped exercises retain their own exercise history, with absent movements shown as not performed rather than zero. Exercise drill-down compares compatible equipment/conventions and shows reps alongside weight; no silent conversion or automatic progression.
- Custom sessions do not automatically advance the prescribed rotation. Saving a reusable custom template is a separate choice from starting a one-off session.

## Implementation handoff — November 10, 2026

- Built the local manual-tracking foundation: Today, Train category/A-B previews, custom workout creation, per-set weight/reps/targets/increments, warm-ups/RIR/notes, custom exercise creation during swaps, set counts/order, preserved completed sets, save-as-new-template, finish/discard, rotation advancement/manual override and repeat workout. Existing Schedule page and data paths are unchanged; cycling views remain accessible under Train.
- Added manual meals with recent/favourites, portion scaling, optional macros, edit/delete/undo and food-day completeness; manual dated pound weigh-ins (one per day), rolling seven-calendar-day average; bike entry/edit/delete and Monday–Sunday 150-minute gauge. Progress groups completed sessions by template and drills into compatible exercise/equipment/convention weight plus set/rep history; both Legs positions share history.
- API: `src/garmin_coach/web/tracking.py`, guarded by existing auth/Origin checks. Separate versioned `tracking.db` beside chat.db; validated revisioned JSON records, tombstones, idempotent mutation IDs, atomic completion/rotation, one active draft, initial pre-schema backup, private template provisioning and structured export. Existing chat DB is not migrated. This is a deliberate single-owner snapshot design, not normalized per-set tables.
- Drafts: immediate device storage, serialized server writes, lost-response retry, explicit offline/conflict status, portable export, and conflict recovery that preserves a device backup before loading the server copy. Cold offline app loading is not implemented; no service worker/full offline queues.
- Private `.local/tracking-templates.json` prepared from the supplied source. No personal loads/history are bundled in public code. Shared Legs retains confirmed seven exercises and two sets with blank unknown loads. Original profile was backed up under `.local/archive/before-winter-tracking/`; old fondo markdown moved into `.local/training/archive/`; local current profile/winter plan added. Existing Schedule JSON preserved. None of these private updates have been transferred to Railway.
- Coach supports a bounded local bike-note parser and explicit Save ride card without AI. General saved-log coaching, screenshot extraction and other deferred features remain deferred. Daily Garmin expenditure stays honestly unavailable until account fields are verified.
- Validation: 81 backend tests; Ruff and mypy pass; demo and personal builds pass; frontend lint has warnings only (existing warnings plus provider fast-refresh export warning); bundle-size warning remains. `web/check-tracking.mjs` verifies carry-forward, swaps, meal math, calendar boundaries, rolling averages, parser, rotation/conflicts and no-network demo behavior. Existing demo checks pass.
- Browser (Chromium) passed reload/offline recovery, deliberately lost response retry, custom swap preservation, completion/rotation, template history, meal/weight/ride entry, deletion/undo, Coach ride save without AI, custom workout, conflict backup/recovery, and 20 route/width checks at 320/375/390/430px. Compact-height focus check passed. WebKit executable is unavailable; actual iPhone Safari keyboard/background/home-screen checks remain pending. Restored SQLite backup was opened through an isolated application instance; chat preservation also tested.
- New setup/limits: `docs/tracking.md`. CI now includes deterministic tracking checks. No commit, push, deployment, real-data API test, external personal-data transfer or paid service activation. Existing uncommitted planning work preserved.
- Local demo preview remains on loopback port 5173. Synthetic private test UI/API processes (5174/8787) were stopped after validation; their disposable test records are under /private/tmp.
- Next release steps: actual iPhone review, production backup + private runtime provisioning, verified expenditure fields if available, then backend-first private/demo deployment and hosted persistence/auth checks. Current hosted versions are unchanged.

## Meal, schedule and import follow-up — November 10, 2026

- Latest owner request supersedes earlier deferred scope: Add meal now contains name, calories/protein and date/time, with recent meals but no serving/carbs/fat/favourite controls. Old stored meal totals remain compatible.
- Gym planning is primary at `/schedule`: template/date slots, rescheduling, start/resume and completion links. Previous cycling assignments remain accessible at `/cycling-schedule`. The existing bike gauge remains available; planning/imports never advance rotation.
- Coach now links to reviewed history import: local notes/CSV parsing, explicit year, editable dates/sets/template association, source preservation, optional bounded Groq extraction, atomic saves and duplicate protection. Unknown/assisted reps stay flagged; future suggestions are not completed sets. General Coach log-reading and screenshot OCR remain deferred.
- Actual supplied sources were checked locally and retained only under ignored `.local/import-review/`; they are review candidates, not saved history. Missing years are explicit review assumptions, not confirmed dates. No personal source was sent to Groq or added to public fixtures.
- Validation: 88 backend tests, Ruff/mypy, demo and personal builds, deterministic tracking/demo checks passed. Browser checks passed meal totals, schedule-to-completion, CSV save/repeat deduplication, uncertain notes, unchanged rotation on imports and six phone-width layout checks. New `web/check-import-browser.mjs` preserves the synthetic integration check. Existing frontend lint/bundle warnings remain. Actual iPhone Safari and live AI extraction quality remain unverified.
- No deployment, paid services, commit or push performed in this follow-up. Earlier deployment history remains historical.

## Release preparation — November 10, 2026

Owner authorized GitHub push and deployment to the existing hosting. Commit author/committer use the configured owner identity, without AI co-author trailers. Private production data was backed up at `/data/backups/release-2026-11-10-gym` with SQLite integrity checks before provisioning runtime templates/current winter context. Historical import candidates remain local and unsaved. Deployment results will be recorded after verification.
