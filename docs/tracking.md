# Manual training and daily tracking

The phone navigation is Today, Train, Schedule, Progress and Coach. Schedule keeps its existing implementation; cycling pages remain under Train. Tracking requires no AI provider. Screenshot extraction, CSV import, scheduled lifting templates, automatic activity imports, and full offline sync are deferred.

## Private storage and templates

Set `GARMIN_COACH_DATA` to persistent private storage. Tracking uses `tracking.db` beside the existing `chat.db`, so it never rewrites chat tables. Version 1 stores validated, revisioned JSON records for templates, workout snapshots, meals, weigh-ins, bike rides, food-day completeness and rotation overrides. Dates are local calendar dates; timestamps are UTC. Browser dates use the device timezone. The initial weekly boundary is Monday–Sunday.

`GARMIN_COACH_TEMPLATES` optionally points to a private JSON file containing an array of `{ "id": "stable-id", "data": { "name": "Workout", "group": "Custom", "exercises": [...] } }` records. See `Template`/`Exercise` in `src/garmin_coach/web/tracking.py` for the validated schema. It is imported only if there are no template records, including tombstones. Template edits are never overwritten by subsequent startup imports. If no file is supplied, create custom workouts in Train. Do not put the owner's file, athlete context or load suggestions in the public repository or frontend bundle.

The predefined rotation uses stable IDs `upper-a`, `arms-a`, `legs`, `upper-b`, `arms-b`, `legs`. Rotation position is separate from template identity. Finishing the currently suggested position advances it atomically with the workout save. Repeated saves do not advance it again; custom/out-of-order sessions do not guess the next position. Train offers an explicit position override.

Both deployment modes use the same UI. The demo adapter has its own generic synthetic templates and browser storage; it never calls private tracking or AI endpoints. Demo reset removes `demo-*` keys. Private records require the existing owner authentication and Origin checks.

## Drafts and conflicts

The active workout is written to device storage immediately and queued to the backend after 500 ms. Writes are serialized and use mutation IDs plus expected record revisions. A lost response retries the exact mutation; the backend returns its previous result. One unfinished workout is allowed on the server. Values edited explicitly and completed sets are never overwritten by carry-forward. Swapping keeps completed original sets, uses the replacement's own compatible history, and leaves unknown loads blank.

The status distinguishes device-only pending saves, server saves, offline/failure and conflicts. On conflict, export the draft or use **Resolve conflict → Back up draft & load server copy**. This retains a device recovery snapshot before loading the server copy. It does not merge devices automatically. Server conflicts for non-workout entries require reloading the record before retrying; keep a copy of unsaved values first. Meals/weights do not have an offline queue; keep their entry screen open on save failure.

Local drafts contain personal data and remain on the owner's device. No service worker is installed: a workout draft survives reload/reopening when the app can load, but a cold launch without cached app assets still needs connectivity. Actual iPhone background/relaunch and keyboard behavior require device validation.

## Backup, migration and export

Before the initial schema is applied, an unversioned tracking database is backed up to `tracking-before-v1.db` via SQLite's backup API. This backup may be empty on a new installation. Future migrations must take a fresh version-specific backup before changing existing records. Before deploying, also back up the existing production `chat.db`, `tracking.db` if present, private templates, athlete profile and plan files.

For an online-consistent backup, use Python's `sqlite3.Connection.backup()` into a separate private file and check `PRAGMA integrity_check` on the copy. Copying a live `.db` with an ordinary filesystem copy is insufficient. Restore with the service stopped, preserve owner-only permissions, and test the restored copy in an isolated data directory before replacing production storage. Never replace the Railway volume. Automated tests verify backup integrity/readback and that chat history survives tracking initialization; production restore remains a deployment check.

Progress offers a JSON export of loaded structured records. `/api/tracking/export` provides an authenticated versioned export. Exports and draft recovery JSON are private; no public fixture should be derived from them. A JSON restore/import UI is not included.

## Validation

```sh
.venv/bin/python -m pytest -q
.venv/bin/python -m ruff check src tests
.venv/bin/python -m mypy
npm --prefix web run build
npm --prefix web run lint
node web/check-demo.mjs
node web/check-tracking.mjs
```

`web/check-tracking-browser.mjs` is an optional local integration check. It requires a disposable, empty local API on port 8787, personal Vite on 5174 and demo Vite on 5173. Provision five synthetic templates using the rotation IDs above, each with a two-set exercise named `Synthetic press` and suggested load 20. Never run it against real owner storage: it creates workouts, meals, a weigh-in and a ride. It verifies reload/offline recovery, a deliberately lost PUT response, swaps, completion, progress, daily entry and responsive routes. It writes only synthetic screenshots to `/private/tmp`.

## Current limits

Garmin daily expenditure is shown as unavailable until the account's daily fields are verified; no final-day projection or deficit is invented. Coach recognizes the bounded local syntax `I biked 40 minutes`, optionally with `today`, `yesterday`, or `on YYYY-MM-DD`, and shows a confirmation card. General Coach access to structured logs remains deferred. No paid provider or integration is enabled.

The new implementation has not been deployed. Before release: validate on actual iPhone Safari/home-screen use; back up production data; provision the private runtime templates/current context; deploy the backend before the private frontend; test auth, persistence after restart, and smoke-test demo isolation. The local private profile/plan update does not update Railway automatically.
