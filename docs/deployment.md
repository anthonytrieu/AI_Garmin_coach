# Deploy Garmin Coach

## Public demo on Vercel

Import `anthonytrieu/AI_Garmin_coach`; use root directory `web`, Vite framework, `npm run build`, output `dist`. The committed `web/vercel.json` supplies SPA fallback. Leave `VITE_APP_MODE` unset (demo is default). Do not add Garmin, Groq, password, or private-backend settings to this project. Deploy only after checking screenshots and demo network isolation.

## Private Railway backend

Use the repository root and included Dockerfile. Infrastructure is defined in `.railway/railway.ts`; run `npm ci`, link the intended Railway project/service, and review `npm run infra:plan` before `npm run infra:apply`. Variables remain unmanaged and must be configured privately. Source deployment (`railway up`) is separate from infrastructure changes. One replica and one worker. Attach a persistent volume at `/data` before starting. Configure variables directly in Railway:

| Variable | Value |
| --- | --- |
| `GARMIN_COACH_ENV` | `production` |
| `COACH_ORIGIN` | Exact personal Vercel origin, e.g. `https://your-personal-project.vercel.app` (no trailing slash) |
| `GROQ_API_KEY` | Your Groq key, server only |
| `GROQ_MODEL` | `openai/gpt-oss-120b`, subject to account availability |
| `GARMIN_COACH_DATA` | `/data/coach` |
| `GARMINTOKENS` | `/data/garmin` |
| `GARMIN_COACH_PROFILE` | `/data/private/athlete.md` |
| `GARMIN_COACH_PLAN_DIR` | `/data/private/training` |
| `WEATHER_LATITUDE`, `WEATHER_LONGITUDE` | Your chosen forecast location |
| `WEATHER_TIMEZONE`, `WEATHER_LOCATION` | IANA timezone and display label |

Railway supplies `PORT`. Health check: `/healthz`. Local auth bypass is refused when Railway's environment marker exists. Never use `GARMIN_COACH_ENV=local` in hosted configurations. Keep private variables out of PR previews.

For Garmin provisioning, use an authenticated operator shell in the actual deployed container with its volume mounted, then run `garmin-setup` interactively and complete MFA. `railway run` locally is not a remote container shell and does not provision the hosted volume. Do not paste tokens into chat, commits or build logs. Place the owner's private profile and plans on the volume through a secure operator transfer; use `sessions.json` for structured sessions. On expiry, repeat interactive setup. There is no public Garmin-provisioning endpoint.

## Private Vercel frontend

Create a separate Vercel project with root `web`. Set `VITE_APP_MODE=personal`. Generate the private rewrite file using:

```sh
node scripts/configure-private-vercel.mjs https://YOUR-BACKEND.up.railway.app
```

This writes ignored `web/vercel.personal.json`. Deploy this project with Vercel CLI's `--local-config vercel.personal.json` from `web`, or use its equivalent project configuration. Do not replace the public demo's committed config. The generated config places `/api/:path*` forwarding before SPA fallback. Keep the private origin stable; update `COACH_ORIGIN` for a changed domain. No secrets are needed in the frontend.

## Required hosted smoke checks

1. `/healthz` returns only health status; direct Railway `/api/rides` and conversations return 401 anonymously.
2. A one-time setup link sets Secure/HttpOnly cookies. Reload and backend restart retain the session; logout and expiry deny access again.
3. A request with an incorrect Origin cannot log in, delete conversations, or send chat.
4. Test a full streamed coach reply through Vercel, including multiple tool rounds and provider timeout/quota errors.
5. Confirm Garmin reads work without exposing tokens, and chats survive backend restart. Restart should retain a trusted-device session.
6. Confirm demo traffic never calls `/api` or external providers.

Hosted owner login/logout, cookie flags, origin rejection, and a short live Groq streamed reply passed on November 5, 2026. After interactive reauthentication, a live Garmin ride read returned HTTP 200 through the private frontend. A live Garmin tool-assisted Groq response also completed. A backend restart preserved the synthetic chat and Garmin access and revoked the previous web session. Long-running proxy timeouts, volume restore, and broader model quality remain unverified. The application imposes a 100-second overall reply timeout; platform proxy limits may be lower. Shorten the request budget if deployment tests require it.

## Costs and data

Check current [Railway pricing](https://railway.com/pricing), [Vercel Hobby terms](https://vercel.com/docs/plans/hobby), and [Groq limits](https://console.groq.com/docs/rate-limits) before activation. Existing Railway workspace credits may be shared with other apps. The code does not enable billing or paid fallback. The Groq key's account must itself remain on the intended plan.

Groq receives bounded chat history, athlete/plan context and selected tool results. Review [data controls](https://console.groq.com/docs/your-data), including exceptions for reliability and abuse monitoring; do not interpret a free API as a privacy guarantee.

## Backup, restore and rollback

Use Railway volume backups before changes. For a portable SQLite backup, use SQLite's backup API in an authenticated operator shell; do not copy a database while a write may be in progress. Back up Garmin tokens and private profile/plan files through secure storage with restrictive permissions. Never attach these backups to GitHub issues/releases.

Test restore in an isolated private environment: restore the volume data, start the same compatible application revision, log in again, and verify chat history and Garmin access. Roll back code via the previous Railway deployment and Vercel deployment; preserve the volume. This release preserves the existing transcript schema. Avoid running a future incompatible schema migration without a backup and tested rollback.

## Current release

- Public synthetic demo: https://garmin-coach-demo.vercel.app
- Private owner app: https://garmin-coach-personal.vercel.app
- Backend health: https://coach-api-production-a667.up.railway.app/healthz
- Password login has been removed; `COACH_PASSWORD` is unused. Issue device links through an authenticated operator shell: `python -m garmin_coach.web.access create-link --label "Owner phone"`. Treat its output as a private credential and open it only on your own device. See [device access](device-access.md).
- Garmin tokens, athlete profile and training plans were transferred to the private volume with explicit owner approval. Files use owner-only permissions. Refresh rejected Garmin sessions using `garmin-setup`, then securely replace the volume tokens.
- The selected model is `openai/gpt-oss-120b`, confirmed available via this account's Models API. The initial Llama model was unavailable. Model availability and quotas can change; consult [Groq models](https://console.groq.com/docs/models). No billing or paid fallback was enabled.
- Rotate the Groq key shared in chat and replace `GROQ_API_KEY` directly in Railway.
