# Institutional handoff completion

Integrate #14 on canonical main and retain #13's architecture reconciliation as
the source for separate future design decisions. Preserve Node/Hono, SQLite,
existing local user IDs and roles, deck sharing, upload URLs, normalized edits,
and export behavior. Do not infer new product-admin rights from Admission roles
or link accounts by email.

Update the actual Gateway receiver check to the current canonical model and
accounting contracts, including trusted reset quota keys. Preserve safe error
codes and retry hints while keeping provider details private. Readiness must
reject a noncanonical Gateway origin or an extra `/v1` suffix.

Provide a verified database/upload snapshot and restoration tool. A snapshot
requires paused writers, includes WAL-backed committed data, hashes all files,
and checks SQLite integrity. Restoration is into a new directory only and must
never overwrite live state. Production rehearsal remains a separate operation.

The mounted browser gate must exercise sign-in through the controlled edge,
persisted deck edits, catalog and quota display, refusal without replay,
cancellation, existing file access, ZIP export contents and institutional logout.
Run it in PR CI with the same locked package manager as the rest of the project.

Release infrastructure is unresolved: the repository has no self-hosted runners,
and available SSH authentication to the documented server is rejected. A
private CI connection and verified account mappings are required before a
production cutover. This source integration does not claim those operations.
