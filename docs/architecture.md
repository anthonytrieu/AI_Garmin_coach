# Architecture and engineering decisions

## Shared data boundary

`client.py` is the Garmin library boundary. `normalize.py` converts provider payloads to explicit units and preserves unavailable values. The MCP server and HTTP API reuse the same functions, avoiding conflicting calculations across interfaces. Read-only scope excludes uploads and edits.

## Public demo

`web/src/lib/mode.ts` selects the build mode. Every ordinary build defaults to synthetic data; `VITE_APP_MODE=personal` explicitly selects the authenticated API. The demo uses generated data and authored coaching examples, with no anonymous AI usage. Dates are anchored to a reference week. It is independently deployable without a Python server.

## Owner authentication

The single-owner server uses FastAPI/Starlette middleware and random opaque device sessions. Setup uses single-use, expiring private links, issued by an operator or another trusted device. Links carry the credential in a URL fragment, which the frontend removes immediately; redemption requires an explicit button and a same-origin POST. Only SHA-256 token hashes are stored in a separate owner-only `auth.db` on the persistent volume. Link consumption and session creation are atomic.

Remembered devices expire after 90 days and survive deployment/restart. Secure/HttpOnly/SameSite=Strict cookies remain host-only under `/api`; logout revokes the database session. Ten devices and twenty outstanding links are allowed; redemption is limited to five attempts/minute per process. Additional-device links expire in 15 minutes; operator links default to 24 hours. Password login is removed. The operator can revoke every device/link with `python -m garmin_coach.web.access revoke-all`.

This is a temporary single-owner access mechanism, not a multi-user identity platform. Future Google/account sign-in should use a maintained identity provider and per-user data authorization. See [device access](device-access.md).


## AI boundary

Groq's streaming chat-completions endpoint replaces the machine-local Claude Agent SDK. The model can request only explicitly allowlisted Garmin functions; Pydantic validates arguments and rejects unknown fields. There are at most five provider rounds and four calls per round, bounded history/output, a two-minute in-memory tool cache, provider timeouts, and no automatic paid fallback. Existing SQLite transcript tables remain readable; old SDK session IDs are retained but no longer used.

Synchronous Garmin calls run in threads. A coroutine timeout ends waiting but cannot forcibly kill an already-running library request; this remains an operational limitation. The app serializes chat and protects conversation deletion during an active response. Dashboard requests can still run concurrently. Garmin/tool caches are process-local; trusted-device sessions persist on the volume.

## Persistence

SQLite transcripts and Garmin OAuth tokens live on a Railway volume. SQLite files have restrictive permissions. Volume backup and re-authentication are operator tasks, never public endpoints. Browser-local schedule/fuel state is device-specific and is not a server backup.

## Configuration and tradeoffs

Private athlete context, training plans and forecast location are runtime configuration. Public synthetic examples cannot reveal real Garmin data. Vercel external rewrites keep cookies and streaming same-origin; hosted end-to-end validation remains required before claiming production readiness.

The app favors a small single-owner deployment over premature queues, multiple replicas or a managed database. A multi-user version would need isolated Garmin accounts, per-user persistence, durable sessions, fair-use limits and a different database design.
