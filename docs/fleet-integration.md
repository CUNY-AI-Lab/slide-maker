# Institutional receiver integration

Status: source proposal only. This branch does not deploy, mount, or change public routing.

Owner: Slide Maker maintainer. Affected actions: institutional sign-in, existing deck access and sharing, AI chat and planning, model catalog and quota display. Node/Hono, SQLite, local uploaded files, normalized deck mutations and fenced model output remain the product architecture.

## Receiver contract

The institutional edge supplies `x-cail-identity-jwt` for the exact audience `cail:slide-maker` and a separate `x-cail-gateway-identity-jwt` for `cail:gateway`. Both verify against the configured public JWKS snapshot and exact issuer; a supplied Gateway token must have the same canonical subject as the app token. Slide Maker uses `@cuny-ai-lab/cail-identity` 5.2.6. Production does not accept password sessions. Missing, invalid, expired or wrong-audience credentials fail closed. A missing Gateway token permits ordinary authorized deck access but cannot start model work.

Configure `CAIL_IDENTITY_JWKS` (JSON), `CAIL_IDENTITY_ISSUER`, `PUBLIC_URL=https://tools.ailab.gc.cuny.edu/slide-maker`, and a reviewed `CAIL_GATEWAY_URL`. The web production build uses `/slide-maker`; the Node API still receives `/api/...` behind the existing path-stripping boundary. The current Node process must remain loopback-bound. This change deliberately does not introduce a private-network proxy or claim a transport decision for Node has been approved.

`@cuny-ai-lab/cail-client` 6.2.2 owns Gateway requests. Chat and planning forward only verified Gateway JWTs, pass cancellation, use Gateway catalog models, and consume streams through EOF including trailing usage/error frames. Gateway owns quota admission, routing, provider keys and usage accounting. Quota reads are display-only. Local historical token rows are retained and never authorize model work. There is no direct-provider fallback or application retry.

Operational events use `@cuny-ai-lab/cail-log` 0.6.4 with the tenant profile: bounded scalar request IDs and outcomes, no prompts, transcripts, canonical subjects, email addresses or provider exception text.

## Existing users and data

Take a consistent SQLite backup and preserve the uploads directory before the release. Rehearse restoration against a disposable copy. With the API stopped, run:

```sh
pnpm --filter @slide-maker/api identity:migrate
```

This adds nullable `users.canonical_subject` and a unique index in one transaction. It does not change user IDs, roles, password hashes, decks, collaborators, file IDs, usage history or URLs. It is safe to repeat. Existing null subjects remain unlinked.

An operator must independently verify the correspondence between an existing local user ID and the canonical institutional subject. Do not infer correspondence from an email address, name or Admission role. Then run against the intended database:

```sh
pnpm --filter @slide-maker/api identity:link EXISTING_USER_ID CAIL_CANONICAL_SUBJECT --operator-verified
```

The script refuses invalid subjects, unknown users, collisions and replacing an existing mapping. An unlinked SSO user receives 403. New enrollment requires operator creation and verification of a local approved account followed by the same link operation; no automatic account creation or email matching occurs. Product admin authority remains the existing SQLite role. Admission admin entitlement cannot grant it. Remapping is a separate reviewed operator action, not supported by this script.

## Private readiness and release proposal

Set a random operator-held `READINESS_TOKEN` and the exact 40-character deployed `RELEASE_SHA`. `GET /internal/ready` requires `Authorization: Bearer <READINESS_TOKEN>`; unauthenticated probes get 404. It awaits identity configuration, checks the migrated user column, requires Gateway configuration and returns the exact release. It does not prove a successful Gateway model call or a browser sign-in. Do not publish this route through the institutional application mount.

The existing SSH/manual staging workflow is historical and is not an approved institutional release mechanism. A subsequent reviewed release PR must establish the actual CI runner's supported private reachability; this proposal supplies no invented transport. The release design must:

1. Run the authoritative checks on main with private package read access, no deploy credentials in PR jobs, and a reviewed dependency lockfile.
2. Serialize releases, reject stale queued SHAs, deploy the exact checked SHA, and obtain a consistent database/upload backup before the additive migration.
3. Verify the new receiver privately at the expected SHA before enabling the institutional caller/mount. Preserve the loopback listener and existing CUID file paths.
4. Prove signed institutional login for a mapped user, role/sharing restrictions, a real Gateway model action, cancellation and export on the deployed route. Check campus and public DNS/access and existing published URLs.
5. Verify one active version at 100%. Roll back application code separately from data; never restore SQLite or uploads implicitly during rollback.

Source checks and disposable synthetic-provider tests are deterministic gates. Production traffic, paid model calls, deployment, mount activation and operator mappings are outside this branch's execution authority.

## Verification commands and scope

`bun run check` runs Svelte type checking, unit/SQLite/Hono regressions, the existing shell checks, and API/web builds. The receiver integration test is explicitly skipped without `CAIL_GATEWAY_SOURCE`; ordinary CI does not require ambient sibling repositories or private cross-repository credentials.

To repeat the local receiver gate, check out CAIL Gateway commit `f3a8b3cc4b6b8bc99125771da6a907dffbdb07c3` into an isolated checkout and run its `bun install --frozen-lockfile` with authorized package read access. From Slide Maker, run:

```sh
CAIL_GATEWAY_SOURCE=/path/to/frozen-gateway-checkout bun x --no-install vitest run tests/fleet-gateway-integration.test.ts
```

The harness archives the exact receiver SHA and checks its installed identity dependency against that manifest. Eight tests exercise the actual Hono app, cail-client, and Gateway receiver over Node loopback HTTP: audience/subject mismatches, catalog/quota, chat completion/correlation, denial without retry, trailing stream errors, cancellation, balanced planning with normalized plan application, and plan quota refusal without retry. The Gateway's unused `WorkerEntrypoint` export is shimmed for Node; Registry, Secrets Store, model discovery, provider and analytics transports are synthetic. This is not Workerd or deployed-path verification. SQLite account/role/sharing/file regressions separately use real signed identities, real Hono routers and disposable local storage; email delivery alone is mocked.

Institutional Sign Out clears local user state and navigates through the same-origin Doorway `/auth/logout`; password controls remain available only for local authentication. The mounted deployment must retain that Doorway route.

The isolated browser gate runs with `bun x --no-install playwright test --config e2e/fleet.config.ts`. It creates disposable SQLite/files and serves the actual UI/Hono under `/slide-maker`. A controlled edge fixture supplies signed identity server-side and a controlled Gateway HTTP fixture refuses one chat request with a quota error. It covers mounted sign-in, existing deck/thumbnail/file access, persisted canvas editing, catalog/quota display without local blocking, safe support-ID display and Doorway sign-out. The fixture is not live SSO or the actual Gateway receiver (the separate receiver gate covers that boundary).

Observed locally on this branch: `bun run check` passed (720 unit/integration assertions; 8 explicit receiver opt-in skips; all shell checks; API/web builds; Svelte 0 errors and 10 existing warnings). The explicit pinned receiver run passed all 8 tests, and the isolated Chromium scenario passed, including cancellation reaching its Gateway fixture. Private production reachability, live institutional login/model use, CI package grants, release execution and mounted URL/DNS checks remain unverified.
