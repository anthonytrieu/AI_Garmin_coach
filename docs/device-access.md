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
