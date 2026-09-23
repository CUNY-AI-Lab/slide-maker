# September 23 private host audit

Administrative SSH to the existing Tailscale host succeeded. The live checkout
remains at `9efd29c62f07a9e431116ee89c5b4513c4499c8f`, with its existing local
files preserved. Neither the fleet receiver nor the protected CI release was
deployed during this audit.

## Existing API repair

PM2 reported the API online, but port 3004 had no listener. The TypeScript
watcher remained alive after its child failed to load the native SQLite module:
the module required Node ABI 127, while the host's Node 24.19.0 used ABI 137.

A private Node 22.23.1 runtime was installed at
`/data/slide-maker-storage/operations/runtime/node-v22.23.1-linux-x64`. Its
official Linux x64 archive was verified with SHA-256
`9749e988f437343b7fa832c69ded82a312e41a03116d766797ac14f6f9eee578`.
An in-memory SQLite check passed before any process was restarted.

Only `slide-maker-api` was restarted with this runtime first in its PATH. Its
saved PM2 definition received the same PATH change; the other saved process
definitions were preserved. No shared Node, pnpm or PM2 installation changed.
The earlier process definition, saved PM2 state and SQLite backup remain private
under `/data/slide-maker-storage/operations/runtime-repair-20260923T144922Z`.

Readback:

- Loopback `/api/health`: 200; anonymous `/api/auth/me` and `/api/decks`: 401.
- Database integrity: `quick_check=ok`; no foreign-key violations.
- Existing records preserved: 9 users, 26 decks, 52 uploaded-file records,
  281 slides and 740 content blocks.
- Other PM2 process IDs and statuses were unchanged.
- The legacy public URL returned 403 from the host's network, so this receipt
  does not establish public or campus browser access.
- Saved startup configuration was checked, but no server reboot was performed.

## Production-copy rehearsal

The snapshot utility and migration module came from source
`7e5275a118aeb13909e83f4c2f84bc304283d5a5`. The installed Identity 5.2.6, jose
6.2.3 and zod 4.4.3 runtime files were copied into the private rehearsal directory;
the running checkout and its dependencies were unchanged.

The API was stopped, absence of database/WAL/SHM holders was verified, and the
utility took a SQLite backup plus all uploads. The API recovered in 4.33 seconds
from the stop request. The snapshot was restored into a new directory and
verified against its byte/hash manifest: 78 files total, including all 77 upload
files (48,799,114 bytes). The 52 database upload records and 77 stored files are
different inventories; the rehearsal retained the entire storage directory.

The actual additive identity migration ran twice against the restored copy.
All original column values across 16 tables were preserved. The new nullable
column and unique index were present, all nine accounts remained unlinked, and
SQLite integrity and foreign-key checks passed. The original snapshot still
passed its manifest check after the migration rehearsal.

Private artifacts and the machine-readable receipt are under
`/data/slide-maker-storage/operations/rehearsal-20260923-7e5275a`.
No production identity column, account association or role was changed.

## Remaining release requirements

The host's shared defaults are Node 24.19.0, pnpm 10.33.0 and PM2 6.0.13. The
protected release still requires its pinned runtime, private directories and
configuration, Tailscale OAuth access, a dedicated SSH key and verified host
key material in the main-only GitHub environment. The administrative password
used for this inspection was not installed in CI.

Nginx still proxies the legacy Slide Maker routes directly to the existing
API/web pair. Doorway-to-Node ingress, mapped-user CUNY login, current Gateway
model work, exported bytes and public/campus access need their own deployed
acceptance. A successful state rehearsal does not establish those outcomes.
