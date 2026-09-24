# Private CI release

The manual `Private fleet release` workflow replaces the historical password/
sudo staging workflow. It is source implementation, not a record of deployment.
The existing host is `100.111.252.53` on Tailscale. The workflow uses an ephemeral
Tailscale node and SSH with a verified host key; it does not provision either
access mechanism or expose a new public listener.

## Operator prerequisites

- Merge the receiver and release PRs, and wait for **Test and build** and
  **Release safeguards** on the exact `main` push. The source check and release
  use Node 22.23.1; the existing pnpm lock and version 9.15.0 remain unchanged.
- Create the GitHub `production` environment with exactly one deployment branch
  rule: branch `main`. Supply its `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`,
  `SLIDE_SSH_USER`, `SLIDE_SSH_KEY` and `SLIDE_SSH_KNOWN_HOSTS` secrets. Obtain the
  SSH fingerprint through the host's trusted administrative channel. Do not
  populate known hosts from an unverified connection or disable host checking.
- Restrict the OAuth client/tag to `tag:slide-maker-deploy`, with network access
  only to this host's SSH port. Tailscale action, binary version and binary digest
  are pinned. A network connection does not grant an SSH account permission.
- The existing service owner must have key-based SSH access, Node 22.23.1,
  pnpm 9.15.0, the tested PM2 CLI 7.0.4, `flock`, `lsof`, `ps`, `tar` and `sha256sum`. Use the same
  service account and PM2 home as the existing API/web processes. No sudo,
  password injection or automatic user creation is performed.
- Pre-create `/data/slide-maker-releases` and its `incoming` subdirectory,
  `/data/slide-maker-backups`, `/data/slide-maker-rehearsals` and
  `/data/slide-maker-config`, owned by that account with mode 0700. These must
  be separate from the current database and uploads. Allow room for the source,
  dependencies, a full snapshot and a disposable restored copy.
- In `/data/slide-maker-config/production.env` (owner only, mode 0600), preserve
  existing application configuration and provide the canonical fleet values
  from [fleet-integration.md](fleet-integration.md), `SESSION_SECRET`, a private
  `READINESS_TOKEN`, and **verified existing** absolute `DATABASE_URL=file:...`
  and `SLIDE_UPLOADS_PATH=...`. The script checks that the current API actually
  holds that database and that its existing uploads resolve to that directory.
  It refuses guessed, missing or deployment-local data paths. Keep package/CI
  credentials and Node/PM2 override settings out of this application file.
- Stop any independent database or upload writers for the release window.
  The workflow stops the API and checks for remaining database handles; uploads
  are verified unchanged while copying. Account linking is a separate,
  independently verified operator operation; the release never matches email
  addresses or grants local roles.

The job token needs read access to the private CAIL packages. It crosses only
the verified SSH stdin for installation and source checks, remains out of
application environment and PM2 files, and is never written to disk. A temporary
npm configuration contains only an environment placeholder and is removed even
when installation fails. Command output that could include credentials stays
out of CI logs. Snapshot and PM2 recovery files are private host data.

## Release and failure behavior

Dispatch from `main` with its full current SHA. The workflow loads its guard
from trusted main, requires the latest successful main-push CI and release-check
runs, and rejects stale SHAs or missing environment protection. It uses both
GitHub concurrency and a host file lock. A release is a `git archive` of the
verified SHA, transferred once, digest-checked, and extracted into a unique
SHA/run/attempt directory. It never changes the old checkout or storage paths.

After a frozen install and production build, the host validates both identity
verifiers. It then records existing PM2 definitions, stops the API, verifies
exclusive database access, creates a consistent SQLite/uploads snapshot, and
restores and migrates a disposable copy. A further main/CI check precedes the
live additive identity migration. Any earlier failure cannot migrate live data.
The two application processes are recreated to prevent stale listener arguments.
Both stay on `127.0.0.1` (API 3004, web 4173); the API runs TypeScript through
the pinned installed runtime without a file watcher.

Acceptance checks require exactly one online process for each component, the
new source directory and SHA, one loopback listener on each port, unauthenticated
readiness rejection, authenticated readiness at the exact SHA, and the mounted
web response. Only then does PM2 save its state and the `current` symlink advance.

A failure after stopping writers attempts to restore the captured old process
definitions and save that process state. It does **not** restore the live database
or uploads. The nullable identity migration is backward compatible with the
previous code. Failed recovery is an explicit error. No upload, migration or
activation is retried automatically; inspect the exact run before dispatching
again. Failed release directories and state snapshots remain for investigation.

## Remaining acceptance

The [September 23 host audit](operations/2026-09-23-private-host-audit.md)
verified administrative SSH access, the existing database/uploads paths, and a
backup, restoration and additive identity migration against a private copy of
actual production state. It also repaired an existing native SQLite/Node ABI
mismatch by pinning only the legacy API to Node 22.23.1. The live application
source and identity schema were not migrated.

The protected host release has not been run. Its Tailscale OAuth connection,
dedicated SSH key, private release configuration/directories and release runtime
still need provisioning. The shared host defaults remain Node 24.19.0, pnpm
10.33.0 and PM2 6.0.13. Do not globally upgrade or replace these to satisfy the
release pins: the account also runs other applications. The API's private Node
22 runtime does not by itself satisfy the CI host's PATH/toolchain contract.
Source checks and the successful production-copy rehearsal do not prove the
remaining network, credential or live traffic requirements.

The CI connection does not create the private Doorway-to-Node browser ingress.
Keep that mount disabled until its transport is established and the receiver is
verified. Then separately exercise mapped-user CUNY login, unchanged local roles,
old decks/files/sharing, a real Gateway model action, cancellation and exported
file bytes through the deployed route, including public and campus access.
