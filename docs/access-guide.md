# Access guide

Public demo: use the deployed Vercel URL, or run `cd web && npm ci && npm run dev`. It needs no login and contains synthetic data only.

Personal app: use the configured HTTPS frontend and owner password. Expired sessions require login again. Garmin re-authentication is a separate operator task; see [deployment](deployment.md).

Local development: explicitly set `GARMIN_COACH_ENV=local`, run the backend, and start Vite with `VITE_APP_MODE=personal`. Keep the server on loopback. A private tunnel is optional and is not configured by this repository.
