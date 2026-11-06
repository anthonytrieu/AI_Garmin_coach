# Architecture and engineering decisions

## Shared data boundary

`client.py` is the Garmin library boundary. `normalize.py` converts provider payloads to explicit units and preserves unavailable values. The MCP server and HTTP API reuse the same functions, avoiding conflicting calculations across interfaces. Read-only scope excludes uploads and edits.

## Public demo

`web/src/lib/mode.ts` selects the build mode. Every ordinary build defaults to synthetic data; `VITE_APP_MODE=personal` explicitly selects the authenticated API. The demo uses generated data and authored coaching examples, with no anonymous AI usage. Dates are anchored to a reference week. It is independently deployable without a Python server.

## Owner authentication

The single-owner server uses FastAPI/Starlette middleware, constant-time password comparison, and cryptographically random opaque sessions kept in bounded server memory. This intentionally avoids a new identity-service dependency for a one-person app; it is not a multi-user identity platform. Production requires a 24+ character secret, HTTPS origin, Secure/HttpOnly/SameSite cookies, and exact Origin checks on mutations. Login is limited to five attempts per minute globally (including successful attempts), trading distributed brute-force resistance for possible temporary denial of login. Sessions expire after 12 hours; logout revokes the server token; restart revokes all sessions. Deploy one process/replica. A future multi-user version should replace this with a maintained identity provider and per-user authorization.

## AI boundary

Groq's streaming chat-completions endpoint replaces the machine-local Claude Agent SDK. The model can request only explicitly allowlisted Garmin functions; Pydantic validates arguments and rejects unknown fields. There are at most five provider rounds and four calls per round, bounded history/output, a two-minute in-memory tool cache, provider timeouts, and no automatic paid fallback. Existing SQLite transcript tables remain readable; old SDK session IDs are retained but no longer used.

Synchronous Garmin calls run in threads. A coroutine timeout ends waiting but cannot forcibly kill an already-running library request; this remains an operational limitation. The app serializes chat and protects conversation deletion during an active response. Dashboard requests can still run concurrently. Cache and sessions are process-local and reset on deploy.

## Persistence

SQLite transcripts and Garmin OAuth tokens live on a Railway volume. SQLite files have restrictive permissions. Volume backup and re-authentication are operator tasks, never public endpoints. Browser-local schedule/fuel state is device-specific and is not a server backup.

## Configuration and tradeoffs

Private athlete context, training plans and forecast location are runtime configuration. Public synthetic examples cannot reveal real Garmin data. Vercel external rewrites keep cookies and streaming same-origin; hosted end-to-end validation remains required before claiming production readiness.

The app favors a small single-owner deployment over premature queues, multiple replicas or a managed database. A multi-user version would need isolated Garmin accounts, per-user persistence, durable sessions, fair-use limits and a different database design.
