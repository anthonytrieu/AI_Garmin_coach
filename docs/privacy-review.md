# Public-source privacy review

Reviewed November 5, 2026. This document records scope, not a certification that no secrets exist.

## Evidence

- Public GitHub `main` matched local commit `5534df0e5bc09de02b44b45ecf7c07d5f24bbbcc` before changes.
- `git ls-remote` returned one branch (`main`) and no tags.
- Pattern scan covered 15 reachable commits and 169 blobs for selected provider-token prefixes, private-key headers, token/database filenames, private Tailscale hosts, and local user paths.
- No selected credential pattern matched. Private machine paths and Tailscale hostnames did match historical documents. Targeted review also confirmed real athlete context and training plans in public source.
- GitHub Actions artifact metadata reported zero artifacts. Release metadata reported zero releases.

## Current cleanup

Personal athlete context and original training plans were preserved in ignored `.local/` files. Public plans now contain synthetic examples; the website's demo dataset is generated independently of Garmin exports. Documentation no longer publishes the personal hostname or training narrative. Existing test fixtures had placeholder IDs and null route coordinates; recognizable FTP/VO2 values were replaced. Historical fixtures are sanitized regression fixtures derived from provider-shaped responses, not asserted to be wholly invented raw payloads. Only the new public demo is described as synthetic throughout.

## Remaining history exposure

Old commits retain previously published personal information. Current-file cleanup cannot erase Git history, forks, clones, or caches. No history rewrite or repository visibility change has been performed. If the owner wants historical personal details removed, prepare a separate reviewed history-rewrite procedure with collaborator/backup implications. If a credential is discovered later, revoke it before relying on history cleanup.

Never include credential values in scan reports. Avoid treating a pattern scan as exhaustive: arbitrary passwords, screenshots, less familiar token formats, and external copies require separate review.
