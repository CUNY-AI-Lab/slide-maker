# Database and upload snapshots

Stop every API and upload writer before backup and keep them stopped until
verification finishes. SQLite's online backup API includes committed WAL state;
the copied database is converted to a self-contained journal without modifying
the source. Uploads and extraction sidecars are copied byte-for-byte. The tool
rejects symlinks within uploads, destinations within uploads, and changing
source files. These checks do not replace stopping writers.

Run from the repository with its frozen dependencies installed. Paths below
are explicit operator inputs; use a new protected snapshot directory on the
data volume, not the small root volume.

```sh
pnpm --filter @slide-maker/api state:snapshot backup /data/slide-maker-storage/db/slide-maker.db /data/slide-maker-storage/uploads /data/slide-maker-backups/RELEASE_SHA --writers-stopped
pnpm --filter @slide-maker/api state:snapshot verify /data/slide-maker-backups/RELEASE_SHA
pnpm --filter @slide-maker/api state:snapshot restore-new /data/slide-maker-backups/RELEASE_SHA /data/slide-maker-restore-rehearsals/RELEASE_SHA
```

Create the parent backup and rehearsal directories before running these
commands. Destinations must not exist. A failed backup remains incomplete and
cannot pass verification; choose a new destination after resolving the failure.
The manifest records relative paths, byte counts and SHA-256 digests. Verification
also checks SQLite integrity and foreign keys and rejects extra/missing files.
Backups contain application data and belong in protected storage, not Git or CI
artifacts.

`restore-new` restores and verifies bytes in a new directory only. It neither
repoints a running application nor overwrites a live database. Rehearse the
additive identity migration on that copied database and inspect preserved user
IDs, product roles, deck ownership, sharing and file references before release.
Absolute file paths in SQLite remain unchanged; a rehearsal must use an isolated
process with the appropriate upload mapping. Do not expose a restored test
application to real users or enable its email delivery.

Rollback after user writes resume is an application-code operation. Restoring an
older data snapshot would discard later edits and must never happen implicitly.
The snapshot unit suite exercises real WAL-backed SQLite, uploads, restoration,
repeated identity migration, checksum tampering and refusal to overwrite a
destination. Production backup/restoration rehearsal still requires access to
the actual server and its data.
