# Logging meals and rides in Coach

In the personal app's Coach, try:

- `I ate a jr chicken from mcdonalds add that to the meals today`
- `I ate two Jr Chickens from McDonalds yesterday`
- `I ate lunch 500 calories 30g protein`
- `I biked for 40 minutes, add that to today`

The app opens an editable confirmation. **Add meal** updates food calories/protein; **Save ride** updates manually logged cycling minutes. The request does not write automatically or invoke Groq. Unknown dates need an explicit date, and unknown foods need a portion and nutrition values. Supplied calorie/protein totals describe the whole meal, rather than multiplying the same totals by item count.

Known-food confirmations keep portion, date, totals and the primary save action visible. **Edit food & nutrition** exposes alternate matches, name, lookup, label values and time. Previous exact-name meals can be reused as a logged portion. Matching entries on the same date require confirming that this is an additional meal/ride. **Undo** removes the just-saved entry through the existing revisioned tracking API.

## Food coverage and sources

The initial restaurant entry covers **McDonald's Canada Junior Chicken**, using the [FatSecret Canada entry](https://mobile.fatsecret.ca/calories-nutrition/mcdonalds/junior-chicken/1-serving) checked November 10, 2026: one 132 g sandwich, 380 calories and 12 g protein. The source and Canadian portion are shown for review. This is a sourced reference, not a live McDonald's menu integration; formulations and other countries may differ. Additional foods or toppings are never silently omitted to force this match.

**Search packaged foods** uses [Open Food Facts](https://world.openfoodfacts.org/), a community-contributed database, through the authenticated `/api/nutrition/search` endpoint. Only the food query is sent upstream after the user requests a search; private logs, chat history and credentials are not sent. Results are restricted to Canadian entries and explicitly labeled per 100 g/100 ml according to the package nutrition label. The owner must select the right product and amount. Missing protein remains unknown. Restaurant coverage is limited; use the label/manual fields when the item is absent or uncertain. No calorie estimates are invented.

Open Food Facts attribution links appear on the confirmation. See its [API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/) and [data reuse terms](https://world.openfoodfacts.org/terms-of-use). Lookup requests have an eight-second timeout, fixed upstream URL, bounded results, a one-hour bounded cache, and a seven-second spacing limit for uncached searches. Lookup failures leave the manual form available.

## Persistence and privacy

The confirmation and its stable record ID are retained in browser storage under a mode-specific key, including the exact submitted payload. A retry reuses that record ID and the existing tracking mutation handling. After a lost response, refresh checks the same ID against the server before offering another save. Submitted fields stay locked while the outcome is uncertain. Backend validation errors allow correcting the form. TrackingProvider, record schemas, workout drafts and Garmin tools are unchanged.

The public demo has the same browser-only confirmation/undo behavior, with no live nutrition search, AI calls or personal API requests. Demo and owner pending entries use different storage keys. Like other private drafts, the pending meal/ride contains personal information in device storage. Close/Cancel clears the pending review; meals/rides have the existing server save behavior, rather than a new automatic offline queue.

## Validation

- 92 backend tests passed, including authenticated lookup, invalid nutrient filtering, missing protein, bounds, caching, upstream failures, rate limiting and no tracking mutations from lookup.
- Ruff/mypy passed. Demo and personal production builds passed. Frontend lint has only the existing warnings.
- `node web/check-coach-logging.mjs` covers intent/date/quantity parsing, supplied totals, source matching, previous portions and avoiding hypothetical/ambiguous matches. It is included in CI.
- `node web/check-coach-logging-browser.mjs` passed against fresh disposable local storage: confirmation/cancel, totals, saved refresh, committed save with lost response, duplicates, ride save/undo, unknown food validation, lookup selection/scaling, date review, unchanged normal AI routing, 320/390/1280px dialogs and demo isolation.
- Existing `check-demo.mjs` and `check-tracking.mjs` passed. Physical iPhone keyboard/background behavior remains a manual check.

The personal browser test explicitly refuses non-loopback origins. It requires an empty synthetic API and personal frontend at 5184, plus demo at 5183; `TRACKING_TEST_URL` and `DEMO_TEST_URL` override those test origins. Nutrition searches and normal AI responses are mocked in browser tests; no test meal/ride is written to production.
