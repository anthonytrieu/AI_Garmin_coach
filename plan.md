# Winter training and nutrition: product plan

Created: November 9, 2026 (America/Vancouver).
Status: Layouts accepted and local manual-tracking foundation implemented November 10, 2026. Local checks pass; actual iPhone validation and deployment remain pending.

This is the roadmap for the next product iteration. Read this file and inspect Git status before continuing. `PROJECT_PLAN.md` retains the earlier portfolio/deployment history. Update this plan with decisions, completed work, and validation evidence as implementation proceeds.

## 1. Purpose and confirmed preferences

Build a simple personal app that is faster to use than iPhone Notes and a weight spreadsheet. Approximately 95% of use will be on an iPhone.

- Primary focus: bodybuilding; gradual fat loss and improved abdominal definition.
- Owner-stated desired loss pace: 0.5–1 lb per week. This is a preference, not a prescribed calorie deficit or a promise of measured fat loss. Scale change does not directly measure body-fat change.
- Secondary goal: 150 bike minutes per week, with power Zone 2 as the intended training intensity. The owner prioritizes time on the bike over verifying actual time in zone; the main counter tracks cycling duration, not measured Zone 2 minutes.
- MyWhoosh rides currently reach Strava according to the owner. Automatic Garmin import is not a prerequisite for tracking.
- The gran fondo is over. Archive its plan and stop treating it as an upcoming event.
- Weight is logged in pounds. Existing weigh-ins are entered manually in Google Sheets.
- Food priorities: calories and protein. Carbohydrates and fat are optional.
- Five distinct lifting templates in a six-session rotation, with one shared **Legs** template used twice. Rest days are flexible; this is not six mandatory sessions per calendar week.
- Usually work up to 10 reps; targets remain editable and actual reps are never capped.
- Exercise selection is mostly consistent, but swapping must be easy during a workout.
- Starting weights and old template notes are suggestions, not verified completed workout history.

Do not publish personal weigh-ins, meals, workout weights, screenshots, or athlete notes in the public demo. Store personal seed data and goals privately at runtime. Review this planning document for personal preferences before including it in a public commit.

## 2. First-release navigation and phone UX

Make gym planning primary in Schedule and preserve the previous cycling schedule separately. Proposed five bottom tabs: **Today · Train · Schedule · Progress · Coach**; validate spacing on iPhone during mockup review. Keep controls reachable with one hand, avoid horizontal scrolling, and test with the iPhone keyboard open.

### Today

- Main actions: **Start workout** and **Add meal**.
- A compact weight card directly below the main actions: latest weigh-in, date, trend when available, and **+ Add weight**. Weight entry takes one tap to open, a numeric value, and Save; no trip to Progress required.
- Calories and protein logged today, with optional targets only when configured.
- Garmin estimated calories burned so far, clearly separated from a daily food target and completed-day expenditure.
- Weekly bike-minute gauge: recorded cycling duration toward 150, plus minutes remaining. Show manual/imported source; do not label unverified duration as measured Zone 2 time. Add a compact **Log ride** action beside it.
- Resume an unfinished workout instead of starting a duplicate.

### Train

- Suggest the next workout in the rotation; allow choosing any template.
- Start, resume, repeat a completed workout, and view history.
- Keep existing cycling views accessible within Train rather than making them the main daily workflow.

### Schedule

- Keep the previous cycling Schedule accessible at `/cycling-schedule`.
- Implemented locally: select Upper A, Arms A, or another saved template and assign it to a day; allow multiple sessions in one day and rescheduling.
- Start the scheduled template directly. Planning a workout must not mark it completed, advance rotation, or add activity minutes.
- Preserve completed history when future schedule entries or templates change.

### Progress

- Weight entries and seven-day rolling average; show missing data and avoid drawing conclusions from one weigh-in.
- Exercise-specific graphs with set details.
- Simple weekly summaries of logged workouts, food completeness, and cycling minutes.

### Coach

- Explain saved logs and trends, using current goals rather than the old event plan.
- Meal screenshots produce editable drafts with an explicit Save action.
- Ordinary logging, totals, charts, and progression suggestions must work without AI.

## 3. Workout tracking — initial release

### Templates and rotation

Create five templates: Upper A, Arms A, Legs, Upper B, and Arms B. Use the owner-supplied Workout Program Specification as the starting reference, with the later decision to consolidate both leg days into one shared Legs template. The rotation is:

1. Upper A
2. Arms A
3. Legs
4. Upper B
5. Arms B
6. Legs

Use the supplied document as the private import reference, not as proof that sessions were completed. Preserve unknown starting weights as null. Hip thrust at 115 lb is a planned progression, not an achieved baseline. Both Legs occurrences reference the same template and exercise histories, not separate A/B copies. Use the confirmed shared Legs list below; do not concatenate both old leg workouts or assume all their exercises are required. Leg press is a preferred option, and exercises can be swapped based on equipment availability. Record the actual selected movement; leg press and squat variants have separate histories. Preserve the exclusion of Bulgarian split squats and single-leg squat variations.

Proposed editable rep defaults: keep 6–10; convert 8–12 to 8–10; use 8–10 for the template's higher-rep ranges unless the owner overrides them. Confirm these defaults in the template preview before importing. Ten is a target ceiling, never an input validation ceiling.

Complete a workout to advance the suggested rotation; rest days and abandoned drafts do not advance it. Allow a manual override. Track the rotation position separately from template identity because Legs occurs twice. Completing the scheduled/current Legs occurrence advances to its correct successor (Upper B or Upper A). If an out-of-order workout leaves the position ambiguous, retain the current position or offer an explicit choice rather than guessing from the template name. Do not force missed workouts to be made up.

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

### Set entry

- Every set stores its own actual weight and reps.
- Tap weight to type, or use minus/plus with an exercise-specific configurable increment.
- Prefill from the last compatible session; use the template suggestion only when no history exists.
- Changing a set's weight carries it into the next untouched unfinished set. Never overwrite completed or explicitly edited sets silently.
- Completed sets remain editable. Support adding/removing sets and marking warm-ups separately.
- Optional notes and reps-in-reserve stay collapsed by default.
- A checkmark completes a set. Clearly distinguish a suggestion from a completed result.
- Autosave drafts locally as well as saving to the backend. Recover after closing/reopening the app; display saving, saved, offline draft, and failed-sync states accurately.

### Weight conventions

Store the weight exactly as entered in pounds. Convention labels are optional metadata, not mandatory setup. Use known preferences below without asking repeatedly; allow an unspecified convention for other exercises. If provided, snapshot the label on logged sets:

| Convention | Meaning |
| --- | --- |
| Per dumbbell | The entry is for one dumbbell, not the pair |
| Plates per side | The entry is plates loaded on one side; machine chest press is confirmed to use this convention |
| Stack display | The entry is the machine's displayed selection |
| Total external load | Total loaded weight, with explicit treatment of the bar |
| Bodyweight / assistance | Separate conventions if required; never infer from a zero or negative load |

Machine chest press at 70 lb means 45 + 25 lb on one side. Do not silently double it or add an assumed machine resistance. Do not block logging to clarify leg press, RDL, hip thrust, or other ambiguous entries: this is a personal app and the owner understands their numbers. Optional machine labels can distinguish equipment when useful. Never silently convert loads, invent total resistance, or rewrite history. Avoid cross-machine volume comparisons when conventions are unknown.

### Swapping and flexibility

- Each exercise has **Swap**, **Skip**, and **Add exercise** actions available during a workout.
- Search recent exercises first; allow a custom exercise without navigating a giant catalogue.
- Swapping affects this session by default. **Update template too** is a separate explicit choice.
- Load the replacement exercise's own last weight, reps, equipment, and convention; never copy the original movement's load blindly.
- Preserve any completed original sets as performed. Replace only the remaining work, or add the replacement as a separate exercise when that is clearer.
- Preserve the historical session snapshot if a template is edited later.

### Progression and charts

- Show last-session sets beside current entries.
- Suggest a load increase only when all prescribed working sets at the same load meet the upper target and the user confirms readiness; do not apply increases automatically.
- Mixed-weight sets, skipped sets, and warm-ups must not trigger a simplistic increase.
- First chart: heaviest working-set load per session for the same exercise/equipment/convention, with reps and all sets visible on tap.
- Show rep improvements at the same weight. Avoid implying heavier weight alone always means better performance.
- Defer estimated one-rep max, cross-machine volume comparisons, and automatic programming.

## 4. Food logging — initial release

### Manual logging first

- Add meal: name, calories, protein and date/time for the amount eaten. No servings, carbs/fat or favourite controls.
- Quick calorie-only entry is allowed. Missing protein is unknown, not zero.
- Repeat recent meals; edit total calories/protein before saving.
- Support snacks, drinks, extras, and backdated entries.
- Make edits/deletion easy; use an undo option for accidental deletion.
- Meal totals and daily totals are deterministic calculations, not model output.
- Let the user mark a day's food log complete. Do not treat unlogged food as proof of a deficit.

### Screenshot-assisted entry — HelloFresh and Factor

Included as the next increment after reliable manual logging, not a dependency for it:

1. Choose one or more images from Photos or attach them in Coach; support HelloFresh and Factor recipe screens or nutrition labels.
2. Extract visible meal name, nutrition values, and serving basis into a draft.
3. Show the original alongside editable extracted values and mark missing/uncertain fields.
4. Ask how many servings were eaten and allow extras/substitutions.
5. Show one compact confirmation card, then save and immediately update today's calorie/protein totals. Prevent duplicate entries on repeated taps/retries.

Example conversation: screenshot(s) + “I ate one serving of this meal.” Extract the specified serving quantity without asking again. Combine a meal-name screenshot and its nutrition screenshot into one draft, not two meals. Ask only for missing or ambiguous serving basis/date/details.

- Private meal-label examples are retained outside the repository. They are extraction references, not consumed meal records; public tests use synthetic values.

Prefer nutrition text from a recipe/app screenshot. Do not present calorie estimates from a plate photo as measured nutrition. Distinguish per-serving, per-100-g, and whole-recipe values. Do not assume recipe serving count equals servings eaten.

The current chat path is text-only. Evaluate browser OCR or an explicitly chosen image-capable provider with synthetic screenshots before selecting an approach. Keep a manual fallback. Do not assume current Groq model support, quotas, or pricing. Do not enable billing automatically. Default to discarding uploaded images after extraction/confirmation; retain structured entries, not a permanent photo archive. Explain any external image processing before upload.

## 5. Weight, expenditure, and cycling — initial release

### Weight

- Manual pound entry on Today, with editable date and optional note.
- Default to one daily weigh-in; an existing date prompts Edit rather than silently duplicating or averaging readings.
- Progress shows individual entries and a rolling seven-calendar-day average of available measurements, with enough context to see gaps.
- Keep Google Sheets history intact. Offer a one-time CSV import after checking the actual columns, units, and dates; show a preview and duplicate handling before saving.
- Google Sheets live sync is not required for first release. No spreadsheet connection is assumed.

### Expenditure and energy balance

- Verify available Garmin daily total/resting/active calorie fields against the actual account before wiring the UI.
- Use Garmin daily total expenditure once; do not add recorded workout calories again.
- Label expenditure as an estimate. Show data date, last sync, and missing/stale states.
- For today, distinguish expenditure so far from projected full-day maintenance; do not invent a final-day figure.
- For completed prior days with complete food logs, show logged intake minus estimated expenditure, explicitly labelled as an estimated balance.
- Keep food target, maintenance estimate, and observed Garmin expenditure distinct. Do not automatically prescribe a deficit from the owner's desired pace.
- Adaptive maintenance estimation from multiweek intake/weight trends is a later feature.

### Bike-minute tracking

- Confirmed: Zone 2 refers to **power**, not heart rate. Nevertheless, count all user-logged bike duration toward the 150-minute weekly goal; precise zone verification is out of initial scope.
- Use the owner's local timezone and an explicit week boundary (proposed Monday–Sunday).
- **Log ride** accepts minutes, date (default today), and an optional note/source. It works without AI or an integration.
- Coach flow: “I biked 40 minutes” produces a compact “40 min · Today · Save ride” card. After confirmation, persist the record and update the same gauge and weekly total. Resolve ambiguous dates/durations before writing.
- From an empty week, 40 minutes gives **40 / 150 min**, about **27%**, and **110 min remaining**. Add to existing minutes rather than resetting the total. Cap the gauge visually at 100%, retain over-goal totals, and keep remaining minutes nonnegative.
- Editing/deleting a ride recalculates totals. Repeated submissions must not double-count. Do not estimate calories burned from duration alone.
- Retain source and external activity IDs for future imports. Match/reconcile manual and imported entries rather than adding both silently.
- Future optional Strava sync: use the official API where appropriate; an MCP wrapper is not required and does not remove API requirements. As checked November 9, 2026, Strava's developer getting-started guide says a subscription is required to create an app: https://developers.strava.com/docs/getting-started/. Review current access tiers, OAuth, limits, and permitted AI uses before implementation. Do not buy a subscription or build an unofficial login workaround for the initial release.
- Manual logging is the default solution. File import can be evaluated later if the owner wants automation without maintaining a live integration.

## 6. Data and integration approach

- Keep the existing authenticated single-owner FastAPI/Railway backend and Vercel frontend.
- Extend persistent SQLite with versioned migrations for exercise/equipment definitions, templates, workout sessions/sets, meals/favourites, weigh-ins, bike-duration entries, goals, and sync metadata; scheduled-template links are a later addition.
- Snapshot exercise names, conventions, and targets on sessions so later template edits do not alter history.
- Store stable IDs, units, timestamps, local dates, source, and edit metadata. Dates must not shift when converted to UTC.
- Use client-generated IDs/idempotent writes to prevent duplicate saves after network retries.
- Basic offline scope: preserve and resume the active workout draft. Full offline meal/weight queues and multi-device conflict merging are future work; never silently discard a local draft.
- Keep existing owner authentication and origin validation on all new write/upload routes. Validate values, upload type/size, and ownership server-side.
- Export structured records and make a tested database backup before schema migrations. Do not rewrite existing chat history.
- Coach reads saved data through narrow tools. Proposed record changes require confirmation; free-text assistant responses alone never write records.
- Public demo uses synthetic workouts, meals, weights, and screenshots only. No personal API calls or provider credentials.

## 7. Delivery sequence and acceptance checks

### Phase 0 — reviewable design

- [x] Phone-sized layouts reviewed and accepted, with Train category picker and template-first history refinements.
- [ ] Walk through editing load between sets, swapping after completing a set, logging leftovers, and adding weight.
- [ ] Review template import, weight conventions, the shared Legs exercise list, and preserved Schedule navigation. Power Zone 2 intent and duration-based counting are already confirmed.
- [x] Owner approved implementation scope; requested layout review before production UI coding.

### Phase 1 — useful daily foundation

- [x] Add private data models, versioned tracking storage, backup/export support, and authenticated CRUD.
- [x] Implement templates, rotation, set entry, swaps, custom exercises/workouts, and recoverable workout drafts (local/browser validated).
- [x] Implement manual meals, recent-meal shortcuts, calorie/protein totals, edit/delete/undo and day completeness.
- [x] Implement manual weigh-ins, rolling averages, Today actions, and template-first exercise graphs.
- [x] Archive the old event plan and configure current goals privately in local files; hosted provisioning remains pending.
- [x] Add manual bike-duration logging, 150-minute gauge, and bounded local Coach save-confirmation with duplicate protection.
- [ ] Validate Garmin expenditure fields and add estimates with honest unavailable states; zone telemetry is not required.

Acceptance: complete an ordinary gym session and record a day's meals/weight entirely without AI. Changed loads and exercise swaps persist correctly. Reopening on iPhone restores an unfinished workout. Bike minutes update correctly after saves/edits/deletes and reset by the chosen calendar week. Records survive backend restart. Incomplete logs do not display a false deficit.

### Phase 2 — reduce logging friction

- [ ] Add HelloFresh and Factor screenshot extraction, including paired screenshots and serving scaling, with editable confirmation and manual fallback.
- [x] Add reviewed CSV weight-history import (local; year explicitly reviewed).
- [x] Add pasted workout-note parsing into a reviewable batch, with optional Groq extraction.
- [ ] Connect Coach to saved records using bounded context; respect provider limits.

Acceptance: screenshots never save unconfirmed values; serving calculations are correct; repeated saves/imports do not duplicate records; parsing failures preserve the user's input and allow manual completion.

### Phase 3 — release validation

- [ ] Test on actual iPhone Safari and home-screen launch, including small screens, numeric keyboards, photo selection, and background/resume.
- [ ] Verify accessibility, readable text, touch targets, loading/error states, and undo behavior.
- [ ] Test persistence, migration/restore, timezone boundaries, private-data isolation, and duplicate prevention.
- [ ] Refresh the synthetic demo and README only with implemented, verified capabilities.
- [ ] Deploy within previously approved services; review any new costs or third-party data sharing separately.

## 8. Future implementations — explicitly deferred

### Motivation: gym attendance at a glance

- Weekly and monthly calendar views highlight days with completed gym workouts, using readable colours plus labels/icons so colour is not the only signal.
- Show distinct gym days this week/month and completed-session counts separately; two workouts on one date count as one attendance day.
- Count actual completed workout logs, not planned Schedule entries, abandoned drafts, or cycling-only entries. Editing/deleting/backdating a session updates the calendar using the owner's local date.
- Rest days remain neutral. Prioritize consistency over daily streaks that imply training every day is required.
- Integrate with Schedule/Progress rather than adding another navigation tab.

### Copy workout summary to Strava

- Add **Copy workout** on the completed-workout screen and in workout history.
- Generate plain text from actual completed sets: workout name, exercises performed, weights/reps, and explicit load conventions (per dumbbell, plates per side, or stack display).
- Reflect swaps and mixed-weight sets; omit skipped exercises and unfinished sets. Notes are optional and previewable before copying.
- Provide a preview and copy confirmation; if iPhone clipboard access fails, offer selectable text for manual copying.
- The owner already records workouts on a watch and posts them to Strava. The summary is intended for pasting into the description of that existing activity; do not create a duplicate activity.
- This is a clipboard feature, not automatic Strava posting. It requires no Strava API integration or AI call and must not copy private profile/health context implicitly.

### Other deferred features

- Template slots, starting sessions and completion links were promoted from deferred scope by the November 10 request and are implemented locally.
- Optional Strava or activity-file import with source-aware duplicate reconciliation.

- Full offline food/weight logging with reliable background retry and conflict resolution.
- iPhone home-screen installation polish and optional rest timer.
- Barcode scanning, broader food search, and richer recipe reuse.
- Live Google Sheets or connected-scale weight sync.
- Multiweek maintenance calibration and more detailed weekly reviews.
- Additional lifting graphs, optional effort trends, and equipment-specific progression settings.
- Optional reminders, always opt-in.
- Nutrition targets and training-program changes only through explicit owner choices, not automatic escalation from a chart.

Do not add social features, public signup, paid subscriptions, a huge exercise database, or a full food catalogue to the initial release.

## 9. Remaining setup decisions

These do not prevent writing this plan:

1. Confirm the proposed Monday–Sunday week boundary; power Zone 2 intent and total-bike-minute tracking are settled.
2. Optional exercise-specific load increments; ambiguous weight conventions are not a blocker and must not require a setup questionnaire.
3. A sample Google Sheets export before defining the importer.
4. Validate Factor with a sample when available using the shared screenshot workflow; no separate brand-specific integration is assumed.
5. Review the proposed rep-range defaults in the template preview. The shared Legs exercise order and two working sets per exercise are confirmed; no further exercise-list confirmation is needed.

Next action: review the prepared phone layouts, incorporate feedback, then implement Phase 1 within the approved scope. No new paid services are authorized.

## Design progress — November 9, 2026

- Prepared interactive 390px phone preview with configurable 375/430px widths: Today, workout set editing/resume, swap preserving completed original work, manual meal entry with half-serving totals, quick pounds/bike entry, Progress, and shared Legs template. All example data is synthetic; preview is outside public repository source. Path recorded in `context.md`.
- Five-tab navigation retains Schedule. Schedule and Coach preview destinations are explicitly placeholders; existing app remains unchanged. Deferred features are not implemented.
- Browser verification: draft resume, blank replacement load, meal arithmetic/totals, 20 screen/width overflow checks (320/375/390/430), zero JavaScript errors. Inspected Today rendering. These checks do not establish production autosave, backend sync, or actual iPhone keyboard behavior.
- Full upper/arms import preview, layout acceptance, keyboard-open review, and persistence implementation remain pending. No backend migrations, tests, deployment, paid service, or personal-data transfer performed in this design step.

### Layout feedback — November 9, 2026

- Owner accepted the other layouts and requested Train → Upper / Arms / Legs. Upper opens previews of both Upper A and Upper B; Arms opens Arms A and Arms B. Legs opens the confirmed shared template. Implement this category picker as the initial Train entry point.
- Schedule synchronization was offered as an alternative, not a requirement. Keep existing Schedule intact; template scheduling stays deferred under the bare-bones scope.
- Updated the local phone preview with category navigation and both A/B exercise lists, preserving original exercise order/set counts from the private source. Rep targets retain 6–10 and otherwise preview 8–10. No personal starting weights or historical notes are included. Choosing a template does not advance the rotation or overwrite an existing draft.
- Remaining work: production implementation and actual iPhone validation. Other layouts need no repeat approval.
- Revised preview validation passed: all three Train category routes, both Upper/Arms A/B previews, variant selection, and nine width checks at 320/390/430px; zero JavaScript errors. Train rendering inspected.

### Custom workout creation and history refinement — November 9, 2026

- Add Create new exercise to in-session Swap alongside saved/recent exercise selection. Minimal name entry, editable working sets and targets, blank unknown loads; optional convention and equipment details never block entry. Preserve completed original sets and default changes to this session.
- Add Create workout to Train: name, add existing/custom exercises, edit order/sets/targets, then start. Saving as a reusable template is optional. Keep prescribed six-position rotation separate; custom sessions do not advance it automatically.
- Progress primary flow: choose workout template → compare dated completed sessions of that same template → choose exercise → inspect working-set weight and reps over time. Upper A compares with Upper A, Arms B with Arms B; both Legs positions share one history. Keep weight trends and weekly bike summaries accessible.
- Exercise comparisons preserve equipment/convention distinctions, actual mixed-load sets, and swaps. Missing exercises are not zero performance. No estimated 1RM or automatic programming in initial scope.
- This feedback is recorded for the implementation; the current phone preview has not yet been revised for these two flows.

## Local implementation evidence — November 10, 2026

The approved core flows are now implemented in the app, including the later custom exercise/workout and template-first history requests. See `context.md` for file-level handoff and `docs/tracking.md` for operations. Prior mockup limitations are historical; the implemented UI includes these flows.

- Storage decision: a separate versioned `tracking.db` uses validated JSON record snapshots, revision conflicts, mutation receipts and tombstones. It avoids modifying chat storage and preserves session history. Production data has not been migrated.
- 81 backend tests pass, including auth/Origin protection, duplicate retries, both Legs rotation positions, validation, weigh-in uniqueness, restart persistence, and opening a restored backup through the app. Ruff/mypy pass. Demo/personal frontend builds pass. Frontend lint has warnings only; bundle-size warning remains.
- Deterministic tracking and existing demo adapter checks pass with network access forbidden. Synthetic browser checks cover core daily flows, offline draft retention, lost-response retry, swaps/custom workouts, conflict recovery, delete/undo, local Coach ride confirmation and responsive layouts. Actual iPhone Safari/keyboard/home-screen validation remains unchecked; local WebKit is unavailable.
- Private template/profile/plan files stay ignored under `.local/`; original context backed up and Schedule JSON preserved. Public templates are deliberately separate synthetic examples. No new costs, private transfers or deployments.
- Expenditure remains unavailable rather than inventing account fields or a calorie deficit. Full offline asset loading, multi-device merge and deferred integrations are not implemented.
- Next: iPhone review and release provisioning/backup; deployment and hosted checks are still required. No repeat approval of settled layout/preferences is needed.

## Meal, schedule and import follow-up — November 10, 2026

- Latest owner request supersedes earlier deferred scope: Add meal now contains name, calories/protein and date/time, with recent meals but no serving/carbs/fat/favourite controls. Old stored meal totals remain compatible.
- Gym planning is primary at `/schedule`: template/date slots, rescheduling, start/resume and completion links. Previous cycling assignments remain accessible at `/cycling-schedule`. The existing bike gauge remains available; planning/imports never advance rotation.
- Coach now links to reviewed history import: local notes/CSV parsing, explicit year, editable dates/sets/template association, source preservation, optional bounded Groq extraction, atomic saves and duplicate protection. Unknown/assisted reps stay flagged; future suggestions are not completed sets. General Coach log-reading and screenshot OCR remain deferred.
- Actual supplied sources were checked locally and retained only under ignored `.local/import-review/`; they are review candidates, not saved history. Missing years are explicit review assumptions, not confirmed dates. No personal source was sent to Groq or added to public fixtures.
- Validation: 88 backend tests, Ruff/mypy, demo and personal builds, deterministic tracking/demo checks passed. Browser checks passed meal totals, schedule-to-completion, CSV save/repeat deduplication, uncertain notes, unchanged rotation on imports and six phone-width layout checks. New `web/check-import-browser.mjs` preserves the synthetic integration check. Existing frontend lint/bundle warnings remain. Actual iPhone Safari and live AI extraction quality remain unverified.
- No deployment, paid services, commit or push performed in this follow-up. Earlier deployment history remains historical.

## Release preparation — November 10, 2026

Owner authorized GitHub push and deployment to the existing hosting. Commit author/committer use the configured owner identity, without AI co-author trailers. Private production data was backed up at `/data/backups/release-2026-11-10-gym` with SQLite integrity checks before provisioning runtime templates/current winter context. Historical import candidates remain local and unsaved. Deployment results will be recorded after verification.

## Private release — November 10, 2026

- Approved source pushed to `portfolio-release` as `04c955b` (and preceding `408c446`); author and committer are the configured owner, with no AI co-author trailers. GitHub CI passed.
- Railway deployment `9cc2c5bc-633f-4630-adf3-4bd4ec2b7ed5` succeeded on the existing service/volume. Private Vercel deployment `dpl_F5tUxK8dZ1cc6wPmgaC4t97xMarV` is aliased to https://garmin-coach-personal.vercel.app. No infrastructure/billing changes.
- Before deployment, private SQLite/files were backed up under `/data/backups/release-2026-11-10-gym`; integrity checks passed. Private templates and winter context were provisioned separately from sanitized source bundles. Existing cycling schedule JSON was retained; old active plan markdown archived.
- Hosted checks passed anonymous denial, Origin protection, owner login and secure cookies, template loading, idempotent writes, CSV preview, restart persistence/session revocation and logout. Disposable synthetic note removed. Personal history import candidates remain local and unsaved; no AI extraction was invoked.
- Actual iPhone Safari review remains the next owner check. The public demo was not redeployed in this private release.

- Hosted browser QA found the shared button defaults to a non-submit button. The owner login now explicitly uses `type="submit"`; synthetic browser checks cover click submission, bad-password recovery and logout. Frontend rebuilt and redeployed with this fix.

- Final private frontend deployment: `dpl_CrXswJFEmdUA7jQ8SL9jpUVq2xZ1`. Hosted Chromium checks passed login/reload/logout, Train/Schedule/meal/import/Progress at 390px, simplified meal controls and import page. Existing public demo emitted no API requests. Actual iPhone remains to be tested by the owner. Repository history has only the configured owner author and no co-author trailers.
