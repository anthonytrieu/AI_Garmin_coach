# Private device access

The personal app no longer asks for a password. A device is connected once with a private setup link, then remembered for **90 days**, including through backend deployments and restarts. This remains a single-owner app: anyone you connect can access the owner's Garmin data and tracking records. Public demo behavior is unchanged.

Open the private link on your intended browser or phone and choose **Remember this device**. Link previews do not consume it; redemption requires an explicit same-origin POST. The credential is removed from the address bar immediately and is not stored in localStorage. Reloading before redemption requires reopening the original link.

From a connected device, choose **Device access → Create one-time link** to connect another browser. These links expire in 15 minutes and work once. Copy the link to your own device; do not publish or share it. **Sign out** forgets the current device, so a new link is needed afterward. Clearing cookies or using another browser also requires a link.

## Operator recovery

In an authenticated shell in the deployed container (with its existing volume and environment):

```sh
python -m garmin_coach.web.access create-link --label "Owner phone"
# Default: one use, expires in 24 hours. Optional: --hours 1 through 168.
```

This prints a credential-bearing URL. Keep it out of Git, build logs, screenshots and public pages. Creating a link does not sign in or change workout records. There is no anonymous endpoint for issuing links. If all devices are signed out, use this operator procedure.

To revoke every remembered device and unused setup link:

```sh
python -m garmin_coach.web.access revoke-all
```

## Persistence and boundaries

Sessions and links store only SHA-256 hashes of cryptographically random 256-bit tokens in `auth.db` under `GARMIN_COACH_DATA`. The file is owner-only. Existing chat/tracking schemas and records are unchanged. Back up `auth.db` along with the other private databases; restoring an old auth backup can restore previously revoked sessions or used links, so revoke all device access after a disaster restore before issuing fresh links.

Sessions have an absolute 90-day expiry. Logout revokes the server record. Setup atomically consumes a link and creates a fresh session, rotating any existing session on that browser. Replayed, expired and forged credentials fail. Browser cookies remain Secure, HttpOnly, SameSite=Strict and host-only under `/api`; exact Origin checks remain on mutations. Up to ten devices and twenty outstanding links are supported; successful setup evicts the oldest device if needed. This interim flow will be replaced by maintained Google/account identity and per-user authorization during the multi-user phase.

`COACH_PASSWORD` is no longer read and `/api/auth/login` no longer provides access. Existing pre-release sessions need a one-time device setup because their tokens lived only in the old process memory.

## Validation

Backend tests cover protected routes, Origin rejection, secure cookie flags, token hashing/file permissions, replay, expiry, concurrent redemption, restart persistence, rotation, device bounds, logout and operator revocation. The browser check uses mocked APIs and synthetic credentials to cover initial/existing-tab links, invalid link recovery, immediate fragment removal, remembered reloads, additional-device links, logout, narrow layouts and absence of URL/localStorage credential leakage.

```sh
python -m pytest -q
python -m ruff check src tests
python -m mypy
TRACKING_TEST_URL=http://127.0.0.1:5184 node web/check-auth-browser.mjs
```

## Production verification — November 11, 2026

- Source commits `46248a7` and `4dfa7f8` pushed with the configured owner author/committer. [Release CI passed](https://github.com/anthonytrieu/AI_Garmin_coach/actions/runs/43056333029).
- 97 backend tests, Ruff, mypy, demo/personal builds, frontend lint (existing warnings), deterministic demo/tracking/logging checks, and the synthetic passwordless browser check passed.
- Existing databases/runtime files were backed up under `/data/backups/passwordless-devices-2026-11-11`; SQLite integrity checks passed. Existing tracking and chat records were not migrated or changed.
- Backend `68b17f57-e259-44a6-8514-ef94b8804627` and personal frontend `dpl_GEkQffZvoawhSAHS364HCubnncXt` deployed successfully. The public demo remains independent and requires no setup link.
- Hosted checks used a separate disposable link/device: secure 90-day cookie, refresh retention, second-device issuance/redemption and independent logout passed. A real backend restart preserved the same authenticated device; final logout revoked it. Test sessions were revoked, no private tracking/chat records were written, and the owner's separate setup link was left unused.
- The owner's initial one-use link is retained only in an ignored owner-only local file and delivered privately. No credential-bearing URL was committed or included in deployment bundles. Physical iPhone/home-screen behavior remains a manual check.
