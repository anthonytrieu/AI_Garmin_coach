# Deploy Garmin Coach

## Public demo on Vercel

Import `anthonytrieu/AI_Garmin_coach`; use root directory `web`, Vite framework, `npm run build`, output `dist`. The committed `web/vercel.json` supplies SPA fallback. Leave `VITE_APP_MODE` unset (demo is default). Do not add Garmin, Groq, password, or private-backend settings to this project. Deploy only after checking screenshots and demo network isolation.

## Private Railway backend

Use the repository root and included Dockerfile. One replica and one worker. Attach a persistent volume at `/data` before starting. Configure variables directly in Railway:

| Variable | Value |
| --- | --- |
| `GARMIN_COACH_ENV` | `production` |
| `COACH_ORIGIN` | Exact personal Vercel origin, e.g. `https://your-personal-project.vercel.app` (no trailing slash) |
| `COACH_PASSWORD` | Random secret of at least 24 characters, saved in a password manager |
| `GROQ_API_KEY` | Your Groq key, server only |
| `GROQ_MODEL` | `llama-3.3-70b-versatile`, subject to account availability |
| `GARMIN_COACH_DATA` | `/data/coach` |
| `GARMINTOKENS` | `/data/garmin` |
| `GARMIN_COACH_PROFILE` | `/data/private/athlete.md` |
| `GARMIN_COACH_PLAN_DIR` | `/data/private/training` |
| `WEATHER_LATITUDE`, `WEATHER_LONGITUDE` | Your chosen forecast location |
| `WEATHER_TIMEZONE`, `WEATHER_LOCATION` | IANA timezone and display label |

Railway supplies `PORT`. Health check: `/healthz`. Local auth bypass is refused when Railway's environment marker exists. Never use `GARMIN_COACH_ENV=local` in hosted configurations. Keep private variables out of PR previews.

For Garmin provisioning, use an authenticated operator shell in the actual deployed container with its volume mounted, then run `garmin-setup` interactively and complete MFA. `railway run` locally is not a remote container shell and does not provision the hosted volume. Do not paste tokens into chat, commits or build logs. Place the owner's private profile and plans on the volume through a secure operator transfer; use `sessions.json` for structured sessions. On expiry, repeat interactive setup. There is no public setup endpoint.

## Private Vercel frontend

Create a separate Vercel project with root `web`. Set `VITE_APP_MODE=personal`. Generate the private rewrite file using:

```sh
node scripts/configure-private-vercel.mjs https://YOUR-BACKEND.up.railway.app
```

This writes ignored `web/vercel.personal.json`. Deploy this project with Vercel CLI's `--local-config vercel.personal.json` from `web`, or use its equivalent project configuration. Do not replace the public demo's committed config. The generated config places `/api/:path*` forwarding before SPA fallback. Keep the private origin stable; update `COACH_ORIGIN` for a changed domain. No secrets are needed in the frontend.

## Required hosted smoke checks

1. `/healthz` returns only health status; direct Railway `/api/rides` and conversations return 401 anonymously.
2. Owner login sets Secure/HttpOnly cookies. Reload retains the session; logout and expiry deny access again.
3. A request with an incorrect Origin cannot log in, delete conversations, or send chat.
4. Test a full streamed coach reply through Vercel, including multiple tool rounds and provider timeout/quota errors.
5. Confirm Garmin reads work without exposing tokens, and chats survive backend restart. Restart should revoke the web session.
6. Confirm demo traffic never calls `/api` or external providers.

Hosted cookie/streaming/timeout behavior and real Groq model quality remain unverified until account provisioning is complete. The application imposes a 100-second overall reply timeout; platform proxy limits may be lower. Shorten the request budget if deployment tests require it.

## Costs and data

Check current [Railway pricing](https://railway.com/pricing), [Vercel Hobby terms](https://vercel.com/docs/plans/hobby), and [Groq limits](https://console.groq.com/docs/rate-limits) before activation. Existing Railway workspace credits may be shared with other apps. The code does not enable billing or paid fallback. The Groq key's account must itself remain on the intended plan.

Groq receives bounded chat history, athlete/plan context and selected tool results. Review [data controls](https://console.groq.com/docs/your-data), including exceptions for reliability and abuse monitoring; do not interpret a free API as a privacy guarantee.

## Backup, restore and rollback

Use Railway volume backups before changes. For a portable SQLite backup, use SQLite's backup API in an authenticated operator shell; do not copy a database while a write may be in progress. Back up Garmin tokens and private profile/plan files through secure storage with restrictive permissions. Never attach these backups to GitHub issues/releases.

Test restore in an isolated private environment: restore the volume data, start the same compatible application revision, log in again, and verify chat history and Garmin access. Roll back code via the previous Railway deployment and Vercel deployment; preserve the volume. This release preserves the existing transcript schema. Avoid running a future incompatible schema migration without a backup and tested rollback.
