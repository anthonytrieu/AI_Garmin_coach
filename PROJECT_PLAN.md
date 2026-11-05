# Garmin Coach: portfolio and deployment plan

Created: November 4, 2026 (America/Vancouver).
Status: **Implementation approved November 5, 2026. Public demo deployed; private hosting awaits activation and secrets.**
Repository: https://github.com/anthonytrieu/AI_Garmin_coach

## Purpose and approval boundary

Turn the existing personal cycling coach into a credible resume project with a public, synthetic-data demo and a separate authenticated personal deployment. Use Vercel for the React frontend, Railway for the Python backend, and Groq's free API tier for personal AI use.

The user approved implementation and separately approved publishing the public Vercel demo. Approval to implement does not authorize rewriting published Git history, deleting existing work, changing repository visibility, or purchasing services. Prepare concrete changes before requesting any additional authorization that is actually needed.

This file is the durable project roadmap. At the start of future work, read this file and inspect Git status. After approved implementation, update the checkboxes, decisions, validation evidence, and next action. Do not mark planned work as complete without verification.

## Findings from the initial review

- GitHub reports the repository is public, with `main` as its default branch.
- Public files inspected include personal athlete context in `src/garmin_coach/web/chat.py`, personal training information in `training/whistler-gran-fondo-plan.md`, and a private Tailscale hostname in `docs/access-guide.md`. Avoid repeating the personal values in this plan. A private hostname does not itself grant access.
- This was a targeted inspection, **not a complete credential or Git-history audit**. No conclusion that the repository is free of secrets has been established.
- The local checkout's origin still points at `anthonytrieu/training.git`. Verify whether this is a repository rename and compare local/remote history before updating the URL or pushing.
- Existing uncommitted modifications: `.env.example`, `README.md`, `src/garmin_coach/web/chat.py`, `tests/test_web_api.py`, `web/src/lib/api.ts`, and `web/src/pages/coach.tsx`. Untracked work includes `src/garmin_coach/web/store.py` and `tests/test_store.py`. Preserve and review all of it.
- The app uses React/Vite, FastAPI, Garmin Connect via an unofficial library, and local SQLite chat storage. Current chat uses Claude Agent SDK and local Claude Code authentication.
- The backend currently has no application authentication, binds to localhost, and permits development CORS origins. It is not ready for public personal-data access.
- GitHub's description mentions Strava, but the current README says Strava is not implemented. Correct portfolio claims to match shipped functionality.
- GitHub currently reports no license, homepage, or topics. License choice remains an owner decision.

## Intended architecture

| Component | Personal deployment | Public portfolio demo |
| --- | --- | --- |
| Frontend | Vercel, authenticated access | Separate Vercel deployment, no login required |
| Data | Railway FastAPI accessing the owner's Garmin data | Bundled, clearly labeled synthetic fixtures |
| Coaching | Backend Groq API calls and read-only Garmin tools | Clearly labeled example conversations; no anonymous live AI |
| Storage | Single Railway instance with persistent volume for SQLite and Garmin tokens | Browser-local demo interactions where useful; no personal storage access |
| Secrets | Railway environment/private storage only | No Garmin credentials or AI keys |

The demo must function without Railway, Garmin, or an AI account. A demo query parameter or frontend toggle must never unlock personal endpoints. Keep real data and credentials out of demo builds, fixtures, logs, screenshots, and videos.

Preferred API routing: same-origin `/api` forwarding from the private frontend to Railway, subject to verifying streaming and session-cookie behavior. All protected endpoints enforce authentication in FastAPI even if Railway is accessed directly. If direct cross-origin requests are needed instead, document exact allowed origins and secure cookie/CSRF behavior.

## Phase 0 — Establish a safe baseline

- [x] Preserve and inspect existing local changes; compare the checkout with the intended remote without overwriting work.
- [x] Verify repository identity and branch history; update the stale origin only after confirming the relationship.
- [x] Record baseline backend tests, type/lint checks, and frontend build results, distinguishing pre-existing failures.
- [x] Create an implementation branch after approval.

Done when: the source of truth is established, existing work is preserved, and baseline failures are recorded.

## Phase 1 — Audit and prepare public source

- [x] Scan tracked files and available Git history for credentials, Garmin tokens, databases, exports, account identifiers, GPS routes, personal health details, hostnames, and local filesystem paths. Record scan scope and findings without secret values.
- [x] Review public branches/tags and relevant GitHub artifacts for exposure; do not assume a local default-branch scan covers everything published.
- [ ] If live credentials were exposed, prioritize revocation/rotation. Prepare any history-cleanup proposal separately; deleting current files does not erase history or copies.
- [x] Move personal athlete profile, location, goals, and training plans into private configuration/storage. Replace shipped examples with synthetic data.
- [x] Extend ignore rules for SQLite files and journals, local data directories, credentials, and exports; provide safe configuration examples.
- [ ] Sanitize existing documentation, launchd examples, prompts, fixtures, and images; explicitly verify rather than assume fixtures are synthetic.

Done when: the audit scope and unresolved findings are documented, current public source contains only intended public information, and any discovered credentials have a remediation path.

## Phase 2 — Build a useful public demo

- [x] Define a data-source interface so UI features can use either the private API or synthetic fixtures without duplicating pages.
- [x] Supply internally consistent synthetic rides, streams, power/HR zones, weekly trends, recovery context, courses, and training sessions.
- [x] Use a stable demo date/reference week so the schedule remains useful after calendar dates pass.
- [x] Include labeled example coach exchanges demonstrating data-backed explanations and missing-data handling.
- [x] Keep the existing dashboard, ride details, scheduling, and fueling flows usable in demo mode, with a reset option where state persists.
- [x] Show a persistent demo-data label and links to source/setup instructions. Do not imply example replies are live AI output.
- [ ] Verify direct navigation, mobile layouts, empty/error states, and that demo network traffic never reaches personal services.

Done when: a visitor can explore the core experience from a clean checkout or public demo URL without accounts, API keys, or a running backend.

## Phase 3 — Secure the personal backend

- [x] Implement single-owner authentication with server-enforced authorization and secure session cookies. Prefer a maintained auth solution; choose the concrete mechanism after checking hosting compatibility.
- [x] Protect all personal data and chat endpoints, including conversation deletion and streaming. Configure logout, expiry, CSRF protection where relevant, and login rate limiting.
- [x] Add validated environment settings for origins, deployment mode, data paths, credentials, and port binding. Fail closed on missing production auth configuration.
- [ ] Store Garmin tokens and SQLite on a persistent volume, with restrictive access and documented backup/restore steps. Use one backend replica initially.
- [x] Provide an operator-only Garmin onboarding/re-authentication procedure supporting MFA. Never expose an unauthenticated token-upload or setup endpoint.
- [x] Add minimal health checks and redacted logs. Never send Garmin authentication tokens to the AI provider.

Done when: anonymous requests to both the frontend API route and Railway's direct URL cannot access personal data, and restart/restore behavior has been tested.

## Phase 4 — Replace local Claude dependence with Groq

- [x] Introduce a small provider boundary and a Groq-backed chat implementation. Select a currently available free-tier model that supports the needed tool calls; keep the model configurable.
- [x] Preserve streaming, durable conversation history, and read-only Garmin tool access. Review compatibility of existing stored conversations rather than silently losing them.
- [x] Implement explicit tool-name allowlists, argument validation, bounded tool rounds, timeouts, cancellation, and predictable provider-error handling.
- [x] Keep training calculations in deterministic application code; let the model explain retrieved facts and distinguish uncertainty.
- [x] Cache appropriate Garmin summaries, bound context/output size, and avoid sending unnecessary health details or location data.
- [x] Handle quota exhaustion with a clear retry/unavailable message. Do not automatically enable billing or fall back to a paid provider.
- [x] Review current provider retention/data-use settings before sending personal data; document what is transmitted.
- [ ] Evaluate representative questions: recent rides, ride comparison, weekly planning, missing recovery data, and tool/provider failures. Record observed limitations rather than assuming parity with Claude.

Done when: the private coach works without a local Claude login, uses real tool results, preserves history, and handles free-tier limits gracefully.

## Phase 5 — Prepare and deploy

- [x] Add reproducible backend packaging/startup, health checks, and Railway volume configuration. Include required training/config assets explicitly.
- [ ] Configure separate Vercel demo and personal deployments, SPA routing, and private API forwarding. Verify repository root settings rather than assuming the local parent folders exist in GitHub.
- [x] Document environment variables and secure Garmin provisioning; prevent private credentials reaching preview deployments.
- [ ] Verify streamed chat through the complete Vercel/Railway route, including platform timeout limits.
- [x] Recheck current hosting allowances and AI quotas. Use the existing Railway workspace where appropriate, but do not assume hosting is free or that each app gets separate included credits.
- [x] Prepare a deployment checklist and rollback instructions; obtain any required account actions or spending authorization before activating services.
- [ ] Verify HTTPS, owner login/logout, private-data isolation, demo independence, persistent chats/tokens after restart, and rate-limit behavior on deployed URLs.

Done when: both deployment URLs work as intended and operational instructions are reproducible.

## Phase 6 — Present the project professionally

- [x] Rewrite the README around the problem, demo, screenshots, stack, architecture, setup, tradeoffs, and limitations.
- [x] Add an architecture diagram showing the public-demo boundary, authenticated backend, Garmin, Groq, and persistent storage.
- [ ] Add a short walkthrough using synthetic data, plus sanitized screenshots with no private routes or account details.
- [x] Add CI for meaningful backend tests/checks and the frontend build; ensure CI requires no real Garmin login or paid AI calls.
- [x] Add targeted coverage for authorization boundaries, demo isolation, provider/tool errors, and persistence. Avoid tests that merely duplicate implementation details.
- [ ] Correct the GitHub description, add relevant topics and the demo URL, and choose a license with the owner before adding it.
- [x] Document the unofficial Garmin API dependency, single-user scope, provider limits, and AI coaching limitations.
- [x] Draft resume bullets based only on implemented capabilities and measured results. Explain architectural decisions and any AI-assisted development accurately.
- [x] Add a README link to this plan so future contributors and coding sessions can find it.

Done when: a recruiter can understand the project quickly, explore it without credentials, and reproduce demo mode using documented commands.

## Validation strategy

Run the existing backend tests and appropriate lint/type checks, plus the production frontend build. Add meaningful tests as behavior changes. Mock Garmin and AI for automated checks; use a small controlled live check for integration validation. Inspect the demo at desktop and mobile widths. Record exact commands, results, limitations, and deployed smoke-test evidence in this file as work completes.

## Scope limits for the first portfolio release

No public account signup, multi-athlete SaaS, billing system, Strava integration, workout uploads, anonymous live AI, or custom model hosting. Retain a single-owner backend and a static public demo. Revisit these only after the initial release works reliably.

## Decisions still to finalize during implementation

- Concrete single-owner authentication mechanism and streaming-compatible routing.
- Groq model choice based on current availability, quotas, tool support, and evaluation.
- Which personal details the owner intentionally wants public; default to synthetic examples.
- License choice and any paid hosting commitment.
- Any remediation requiring credential rotation or published-history rewriting, based on audit evidence.

## Progress and handoff

- [x] Review the local structure and targeted public repository files.
- [x] Save this plan without modifying implementation files.
- [x] User approves implementation.
- [ ] Phases 0–6 implemented and validated.

Next action: finish review/merge of the implementation branch, then activate the private Railway deployment only after the owner decides on additional usage. Configure Groq and Garmin through private hosting settings/operator access, and run the hosted checks. Do not request API keys in chat.

### Implementation evidence — November 5, 2026

- Branch: `portfolio-release`. Original work backed up to `/private/tmp/garmin-coach-before-portfolio`; original personal profile/plans retained in ignored `.local/`.
- Remote `main` matched the baseline local commit; origin updated to `AI_Garmin_coach`. Public metadata showed one branch, no tags, zero Actions artifacts, and zero releases at the audit time.
- Baseline: 64 backend tests passed. Current: 70 tests passed; Python lint and mypy passed. Tests use mocked Garmin/Groq, including tool streaming and 429 behavior.
- Demo data test: `node web/check-demo.mjs` passes with fetch forbidden, checks 24 ride summaries/details, aggregate totals, stable schedule dates, and fueling timeline conservation for eight input combinations.
- Both demo and personal frontend production builds pass. Existing bundle-size and frontend fast-refresh/hook lint warnings remain; frontend lint reports no errors.
- Browser checked dashboard, ride details, schedule assignment + reload persistence, fueling page, and labeled coach example selection. Desktop screenshot saved under `docs/screenshots/`. Mobile viewport checks and a recorded walkthrough remain outstanding.
- Fixed date-only labels shifting a day across timezones and a pre-existing fueling bug that dropped servings when reminders were fewer than servings. Timeline totals now agree with summary totals.
- Public demo deployed and verified anonymously: https://garmin-coach-demo.vercel.app (dashboard and direct `/schedule` return HTTP 200). Vercel project: `alextrieus-projects/garmin-coach-demo`; deployment `dpl_D2NjBmEo3LVJVdTRo4u2huzWW9cs`.
- No Railway service was activated, no real Groq call made, no Garmin tokens uploaded, and no public Git history rewritten during this implementation.
- Authentication decision: bounded, random opaque owner sessions implemented with FastAPI/Starlette; no custom cryptography or third-party identity service. See architecture tradeoffs. Restart revokes sessions, and one process/replica is required.
- Real model-quality evaluation, hosted proxy streaming/cookies, persistent-volume restart/restore, Garmin reconnection, license selection, and historical personal-data remediation remain open. Threading timeouts cannot forcibly terminate an already-running Garmin library request.
