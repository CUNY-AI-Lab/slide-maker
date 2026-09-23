# Institutional handoff source acceptance

Branch: `codex/complete-slide-handoff-20260922`, combining #14 and documentation
#13 against canonical main `4cc0bf4`.

Completed locally:

- Frozen pnpm 9.15.0 installation; complete `pnpm check`: 724 tests passed,
  eight explicit receiver opt-in skips, shell checks and API/web builds passed.
  Svelte reports zero errors and ten existing warnings.
- Explicit actual Hono/cail-client to Gateway `c5b54be` with frozen receiver
  dependencies: all eight cases passed. The fixtures use canonical public model
  IDs, current Registry accounting methods and a reset quota key, and cover
  catalog/quota, audience/subject mismatch, streaming persistence, refusal,
  trailing errors, cancellation, plan preview/application and failed planning.
- Mounted Chrome flow: controlled institutional sign-in, existing deck/file/
  thumbnail access, persisted editing, quota display without local admission,
  safe refusal/reference text, cancellation, and institutional logout passed.
  Export passes ZIP integrity inspection and includes the edited heading and
  preserved uploaded-file bytes.
- Real disposable WAL-backed SQLite and upload snapshot/restoration checks
  preserve IDs, roles and ownership through repeated additive migration.
  Tampering, existing restore destinations, recursive destinations and upload
  symlinks are rejected. Source data remains unchanged.

Provider, Registry, catalog and edge identity are controlled fixtures. These
checks establish local source behavior, not live SSO, paid-provider use or a
production backup rehearsal. PR CI now runs the mounted browser/export scenario.

Release discovery found zero repository self-hosted runners and rejected the
available SSH authentication to the documented server. No production data was
read or changed, no accounts were linked, and no deployment or mount activation
was performed. The private release connection and operator-verified account
linking remain required.
