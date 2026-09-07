# Slide Maker architecture reconciliation

Date: 2026-09-07. Status: review proposal; no implementation or rollout approval.

This document reconciles [PR #11](https://github.com/CUNY-AI-Lab/slide-maker/pull/11)
and [PR #12](https://github.com/CUNY-AI-Lab/slide-maker/pull/12) against source. The
useful first step is a shared, atomic deck edit path on the existing host. Document
storage, a new renderer, tool-based AI editing, and a Workers migration remain
separate decisions. None is required just to eliminate browser request fan-out.

Recommendation: use this reconciliation as the successor review baseline for both
PRs. Keep their detailed proposals available as design history; do not treat their
phase lists or configuration examples as an accepted implementation plan. The
September 7 revisions addressed the original reviews' dual writes, retained
parsers, per-mutation log keys, DNS compatibility, and approximate rate limiting.
The remaining conflicts below affect correctness or current service contracts.

## Evidence and current behavior

The inspected slide-maker base is `4cc0bf4b5b4d4a5d0372c7c1c525ab14ed54755c`.
The proposals are pinned at [#11, `7519049`](https://github.com/CUNY-AI-Lab/slide-maker/blob/75190496c1dacdfd258e4e65563bbebd032cb5d6/docs/superpowers/specs/2026-09-03-unified-architecture-design.md)
and [#12, `89af32f`](https://github.com/CUNY-AI-Lab/slide-maker/blob/89af32f3c634eea6467e4ff048dd09d65ef61e4a/docs/superpowers/specs/2026-09-03-cloudflare-transition-design.md).
Their full bodies, reviews, discussion comments, and diffs were read; neither had
inline review threads. These are source observations, not deployed-state checks.

| Concern | What the inspected source implements |
| --- | --- |
| Deck persistence | [Schema](../../../apps/api/src/db/schema.ts) has normalized `slides` and `content_blocks`, including block `source_node_ids` and slide timestamps. It has no document column, version column, or commit log. |
| Edits | [Client mutations](../../../apps/web/src/lib/utils/mutations.ts) dispatch several REST calls for `applyTemplate`. [Deck routes](../../../apps/api/src/routes/decks.ts) and [plan apply](../../../apps/api/src/routes/plan.ts) own persistence and generate IDs. Several individual routes already use SQLite transactions. |
| Authorization | Mutating deck routes check `deck_access` and reject viewers before checking the [edit lock](../../../apps/api/src/middleware/deck-lock.ts). The lock is not an access grant. Owner deletion and metadata editing have different lock behavior from slide/block editing. |
| AI | [Chat](../../../apps/api/src/routes/chat.ts) streams text and stores separately extracted fences. [Shared types](../../../packages/shared/src/mutations.ts) do not describe every client action. [Provider adapters](../../../apps/api/src/providers/) yield text; chat estimates tokens from text length. |
| Rendering | [Svelte renderers](../../../apps/web/src/lib/components/renderers/), [server HTML](../../../apps/api/src/export/html-renderer.ts), and separate [export artifact code](../../../apps/api/src/export/artifacts.ts) implement overlapping behavior. [ZIP export](../../../apps/api/src/export/index.ts) uses local files and `archiver`. |
| Uploads | [Files](../../../apps/api/src/routes/files.ts) counts bytes on disk, including existing sidecars, before writing. `uploaded_files` has neither byte size nor a reservation state. |
| Host and checks | [Svelte configuration](../../../apps/web/svelte.config.js) uses `adapter-auto` and a build-time `/slide-maker` base. [CI](../../../.github/workflows/ci.yml) builds and runs Vitest plus shell checks; Playwright is outside that workflow. The [deployment workflow](../../../.github/workflows/deploy.yml) is manually dispatched and documents its Tailscale reachability problem. |

Related contracts were read at the following commits. Their deployed versions,
bindings, and institutional hostname readiness were not probed here.

| Owner | Inspected source |
| --- | --- |
| Identity | [`65c74fc`, verifier and identity contract](https://github.com/CUNY-AI-Lab/cail-identity/tree/65c74fc53bb8549bd1906bdec55c75c3b273041f) |
| Doorway | [`8565e73`, route policy](https://github.com/CUNY-AI-Lab/cail-doorway/blob/8565e73f032e310d04c9955dfa2f00bdb54583f9/config/route-policy.json) and [Admission RPC type](https://github.com/CUNY-AI-Lab/cail-doorway/blob/8565e73f032e310d04c9955dfa2f00bdb54583f9/src/config.ts) |
| Admission | [`ec1e8be`, `AdmissionResolver`](https://github.com/CUNY-AI-Lab/cail-tools-admission/blob/ec1e8bec45c7b9477d4ce1a1b3b43a065a30b069/src/index.ts) and [administrator boundary](https://github.com/CUNY-AI-Lab/cail-tools-admission/blob/ec1e8bec45c7b9477d4ce1a1b3b43a065a30b069/README.md) |
| Gateway | [`f65eda6`, runtime contract](https://github.com/CUNY-AI-Lab/cail-gateway/blob/f65eda6195bffbac52c228f1ce3586d739578039/docs/gateway-contract.md) and [quota contract](https://github.com/CUNY-AI-Lab/cail-gateway/blob/f65eda6195bffbac52c228f1ce3586d739578039/docs/quota-design.md) |
| Kale | [`15e2c74`, release surface](https://github.com/CUNY-AI-Lab/cail-deploy/blob/15e2c742bad0d7190a2b1e9e4f58052a2d8f7075/README.md) and [artifact contract](https://github.com/CUNY-AI-Lab/cail-deploy/blob/15e2c742bad0d7190a2b1e9e4f58052a2d8f7075/src/domain/contracts.ts) |

## Shared edit direction

Carry forward one authoritative writer for deck edits. A reducer and a shared
loader can operate over today's tables; adopting JSON storage or a Durable Object
is a separate decision. Each implementation increment must identify every caller,
including chat, planner, direct canvas actions, metadata edits, and stale browser
clients. Moving current UI calls alone does not retire a server write route.
Remove replaced routes when their replacement takes traffic, or make any required
transition route delegate to the same writer with a defined retirement point.

The two proposals agree that a commit contains a whole batch, advances the deck
version once, and records inverses in undo order. Preserve that unit in responses,
history, and any future stream: #11's single `mutation`/`inverse` SSE example must
not represent #12's multi-mutation commit. A proposal is uncommitted data; it does
not advance the version or append history. Undo is a new edit with a new version.

Before implementing the writer, resolve these details in its focused PR:

- **Determinism and effects.** Today the server allocates IDs, `searchImage`
  performs network and file operations, and `updateTheme` creates a separate
  theme resource. A pure deck reducer cannot promise to undo those effects.
  Define which commands prepare resources outside the reducer, when they may
  run in proposal mode, and how rejected preparations are cleaned up. Resolved
  mutations need stable IDs and concrete template/artifact inputs so replay and
  inverses do not consult a changed catalog or generate different IDs.
- **Version versus content.** Apply/inverse identity can restore deck content;
  committed undo cannot restore the old revision number or append-only history.
  Specify where version increments happen, how empty batches/no-ops behave, and
  what the property test compares. A reducer identity test alone proves neither
  persistence atomicity nor replay from historical inputs.
- **Retries and conflicts.** A lost response after a successful commit must be
  distinguishable from a rejected edit. Choose the request identity and duplicate
  handling before enabling automatic retries. A stale edit or inverse may
  overwrite a later collaborator's change; define reconciliation instead of
  promising unconditional refetch-and-reapply. Acceptance needs the proposal's
  reviewed base or renewed review of changed effects, not just a fresh version.
- **Access and lock semantics.** The authenticated actor comes from the server,
  never a client `actor` field. Preserve deck-role checks for every transport.
  Decide whether metadata edits retain today's lock exception and how lock,
  version, validation, and persistence checks share the commit boundary.

## Preserve data before changing its representation

#11 Phase 1 creates `deck_commits` and advances versions. Phase 2 then inserts a
`system:import` row at the deck's current version with the same base version. For
any deck edited in Phase 1, that primary key already exists. It also contradicts
the rule that a commit advances the version once.

Record a representation migration separately from edit history, or specify a
distinct advancing migration event and its replay semantics. The implementation
must choose one; it must neither overwrite an existing commit nor duplicate its
key. Preserve pre-migration history and define the initial replay snapshot and
schema/registry versions. #11's later suggestion to compact old log rows also
needs a retention and snapshot decision before claiming permanent undo history.

The proposed document sketch omits slide timestamps and puts source-node metadata
on the slide, while current `source_node_ids` belongs to each block. The round
trip must account for every persisted field and relationship, including nulls,
string `split_ratio`, ordering, unknown existing data, and timestamps. Do not
silently coerce or discard rows to make a new schema validate. Use an explicit
canonical comparison when representations intentionally differ.

A migration plan must freeze all affected writers, not only `/mutations`, take a
consistent SQLite backup, verify every deck and referenced upload, and rehearse
restore on disposable state. Specify when writes resume. Restoring the old backup
after accepting new writes loses those edits; keeping the old tables for a release
cycle does not solve that. Rollback after writes resume requires a demonstrated
reverse migration/replay path or an explicitly accepted data-loss boundary.
Dropping tables and reclaiming server storage are later authorized operations.

## Workers and CAIL integration decisions

### Identity and administrator access

The inspected Doorway policy uses the `cail-doorway.ailab-452.workers.dev` origin
and issuer and contains no slide-maker route. #12's institutional hostname and
issuer are a proposed cutover, not current source configuration. Consume the
reviewed Identity/Doorway contract at implementation time and coordinate the
receiver before enabling a caller. Do not copy a speculative issuer into a
production verifier.

Current `AdmissionResolver.resolveMembership({ subject })` returns exactly
`{ ok: true, expiresAt, revision }` or a denial; Doorway validates those exact
keys. It returns neither `accessRole` nor `budgetScope`. #12's proposed
`membership.accessRole === 'admin'` check therefore cannot authorize an admin.
Admission's own admin HTTP surface has a separate audience and bootstrap
allowlist. A product cannot borrow that audience or infer admin access from
ordinary membership. Admission and slide-maker owners must agree on a supported
product-admin capability, or choose an operator-only administration plan before
removing the existing admin functions. Binding the present resolver alone does
not resolve this decision.

Legacy-account migration also needs its own design. #12 deletes Argon2 and
password fields while requiring a password-based legacy claim. Choose verified
operator linking or a bounded claim mechanism with an implemented verifier,
collision policy, expiry, and deletion criteria. Preserve ownership across all
user references: deck access and ownership, uploads, token usage, resource
creators, locks/presence, and future history actors. Define whether IDs are mapped
or rewritten and rehearse conflicts. Display names are ambiguous search labels;
capability links change who can acquire access and require an explicit product
decision about redemption, expiry, and revocation.

### Gateway transport and accounting

Use the current Gateway contract as the receiver contract. Its successful Chat
streams are largely provider-owned; consume through EOF so trailing usage and
errors remain observable. #12's claim that usage always arrives in a final chunk
is not a portable guarantee. Missing usage must remain unknown, not zero or a
character estimate. Structured logging must retain useful bounded diagnostics
without treating AI Gateway logs as a replacement for a payload transcript: the
Gateway explicitly disables prompt/response payload logging.

The managed app key proposed for #12's Node phase represents an app budget; it
does not establish the signed-in person's budget by adding `x-cail-app` or a deck
session header. Choose whether an app-funded intermediate phase is wanted, or
wait for verified person credentials. Never derive a human budget identity from
local email or an arbitrary header. Model capability filtering and tool protocol
tests are appropriate; model wording/quality diagnostics do not become admission
or release gates. Do not preserve a second fenced-parser path after switching to
tool-based editing.

Gateway remains the spend authority, but #12's claim of exact spend enforcement
is wrong. Its [quota contract](https://github.com/CUNY-AI-Lab/cail-gateway/blob/f65eda6195bffbac52c228f1ce3586d739578039/docs/quota-design.md)
and [Cloudflare spend-limit documentation](https://developers.cloudflare.com/ai-gateway/features/spend-limits/)
describe estimates and eventual consistency; concurrent requests can exceed a
limit before enforcement catches up. `/v1/quota` is display-only. Do not add a
second local spend authority to compensate.

### State ownership and uploads

#12 keeps name, slug, theme, and `updated_at` in D1 while #11's document also owns
them in the deck object. A Durable Object transaction does not include D1 or R2.
Before selecting that split, identify the authority for each field, gallery
consistency expectations, and recovery after any one write fails. A derived
gallery index needs a replay/rebuild rule; two editable copies are dual writes.
Specify deck deletion and access revocation across stores and open connections.
Keep access checks at the real mutation/read boundary; the proposed one-line RPC
is insufficient as an authorization description. WebSocket fan-out, reconnect,
duplicate suppression, and stale authorization are additional work, not a free
consequence of choosing Durable Objects. Existing polling can remain the sole
transport until a replacement is implemented and verified.

The upload proposal cannot sum sizes from the current database: that column does
not exist. Define byte accounting for files, extraction sidecars, downloaded
images, deletes, and concurrent uploads. If using D1 plus R2, choose an atomic
reservation/conditional-write and compensation approach supported by the actual
APIs; a read followed by an insert is not a quota transaction. Exercise failed
object writes, interrupted finalization, and retries without leaking quota or
orphaning referenced files. The Workers Rate Limiting binding may throttle these
requests, but it is [per-location and approximate](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

### Runtime, extraction, and release

#12 correctly acknowledges that Workers does not implement DNS `lookup`;
[`resolve4` and `resolve6` are supported](https://developers.cloudflare.com/workers/runtime-apis/nodejs/dns/).
However, the current Node guard checks each of two answers for private addresses;
it does not compare answer sets, and its caller does not pin the returned IP.
The [current test](../../../tests/ssrf-guard.test.ts) only tests `isPrivateIp`.
A replacement needs tests of the actual URL-validation/fetch boundary, mixed
A/AAAA answers, absent record families, DNS failures, redirects, and cancellation.
State the remaining resolution-to-connection gap without claiming that Worker
placement or lack of a private binding proves a URL safe.

The sample `env.staging` in #12 is incomplete: Wrangler environment variables and
bindings such as services, R2, and Durable Objects are
[not inherited](https://developers.cloudflare.com/workers/wrangler/configuration/#non-inheritable-keys).
Generate and check complete staging configuration with isolated data and identity
keys. A public staging browser cannot simply send a private identity JWT header
on normal navigation; define its access path separately from a test issuer in a
component harness. An empty staging base also does not validate the production
`/slide-maker` mount. Test that mount, asset routing, CSP, API paths, and direct
receiver denial before a doorway cutover.

Replacing file extraction with `AI.toMarkdown`, rendering with Svelte SSR, or
ZIP generation with `fflate` needs a focused runtime fixture exercise. Those
changes are candidates, not proven drop-ins. Measure export memory/CPU and bundle
size on representative decks, including large embedded artifact source and
uploads; a slide-count cap alone does not bound their serialized size. The sample
configuration's CPU limit and the proposal's latency/size estimates are not
measurements.

The April [Kale publishing design](2026-04-11-kale-deploy-integration-design.md)
is also a proposal. Choose a publishing product and access/revocation policy
separately; #11's Kale target and #12's public R2 target cannot both be treated as
settled. Do not create public buckets, DNS, or change existing published URLs as
a side effect of renderer consolidation. Consult Kale's current artifact/release
contract when that choice is scoped.

## Sequence and acceptance boundaries

Both proposals number unrelated work as phases 0–5/6. #12's gateway phase depends
on the AI package introduced only in #11 Phase 5; its transcript deletion also
precedes #11's proposed transcript-based model diagnostics. Review independent
increments by their actual prerequisites rather than interleaving these numbers.

| Increment | Scope and required evidence before advancing |
| --- | --- |
| Existing-host foundations | Capture representative export fixtures and unify duplicated parsing/loading where callers justify it. Verify real template replacement and rejection behavior. This work does not require a host decision. |
| Atomic edit path | Resolve the edit decisions above. Exercise the actual browser/API against disposable SQLite: compound success, mid-batch failure, viewer denial, lock/version conflicts, response loss, and undo. Retire or delegate every replaced writer. Normalized storage is a valid stopping point. |
| Optional representation migration | Approve field mapping and snapshot/history semantics; prove complete round-trip and restore with edits, references, and uploads. Freeze, resume, and post-resume recovery must be explicit before touching existing data. |
| Renderer/artifact/AI consolidation | Each package earns its boundary through current callers. Compare visible canvas/preview/export behavior and ZIP contents; exercise protocol cancellation, proposal acceptance, usage absence, and trailing errors. Recorded streams validate parsing; they do not prove live model behavior. |
| Optional Worker integration | Resolve identity/admin/account mapping, storage authority, gateway budget identity, and staging access first. Run caller-to-receiver tests against actual local Worker services with isolated stores, then coordinate receiver deployment before routing callers. Stub resolvers/test issuers do not prove CUNY login or live access. |
| Authorized cutover | Use the repository's reviewed CI release path, serialize releases, deploy the exact checked commit, and read back one serving version at 100%. Verify the user action plus public/campus routing, private file boundaries, and existing published URLs. A backup or health response alone is insufficient acceptance. |

This successor changes documentation only. No schema, credential, route, service
binding, application behavior, or published deck changes here. Existing build and
test CI can establish that the application is unchanged; it cannot validate any
of the proposed implementations or settle the owner decisions above.
