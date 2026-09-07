# Slide Maker on Workers — Cloudflare Transition Design

**Date:** 2026-09-03
**Status:** Proposal (companion to `2026-09-03-unified-architecture-design.md`, PR #11)
**Scope:** Move the slide-maker's host from the Tailscale-only Debian box (PM2, Nginx, SQLite on disk, in-memory rate limits) to a single Cloudflare Worker behind the lab's CUNY-login doorway, and move model access onto the lab's model gateway the way the lab's own apps do it. The deck model, the editor, and the export format do not change.
**Revision 2026-09-07:** responds to the review on PR #12. Two platform claims in the first draft were wrong and are corrected in §2.10: the SSRF guard's `node:dns` `lookup` call does not run on Workers, and Rate Limiting bindings are per-location and approximate rather than global. Administrator authorization now comes from admission instead of a local subject list (§2.1, §2.3). The per-deck log uses the commit-per-batch version semantics of PR #11 §2.2 (§2.4). The fenced-JSON fallback is gone with PR #11's.
**Review scope:** this is a design for review. It is not approval to migrate accounts, create or change Cloudflare account resources, request doorway or admission changes, or deploy. §3 names the approval each phase needs before it runs.

Everything below about "how the lab does it" was read from the deployed Worker bundles on the CUNY AI Lab Cloudflare account on 2026-09-03 (`cail-cadavre`, `cail-model-api`, `cail-model-access-api`, `cail-doorway`, `cail-tools-admission`, `cail-deploy-service`, `agent-studio`) and from the `cail-doorway`, `cail-deploy`, and `cail-identity` repositories. Where something could not be determined from those sources, this document says so.

---

## 1. Why pair this with the unified architecture

PR #11 makes the application portable: it moves everything about the deck into runtime-neutral packages (`core`, `render`, `artifacts`, `ai`) and reduces `apps/api` to a Hono host that serves one write endpoint, one chat loop, files, sharing, and export. Hono runs natively on Workers. Once the host is that thin, where it runs becomes a configuration decision rather than a rewrite, and the best evidence for what that configuration should look like is what the lab deployed this week.

### 1.1 What the current host costs

- **Deploys cannot run from CI.** `.github/workflows/deploy.yml` is disabled because the staging server is reachable only over Tailscale. Every deploy is a person running `./deploy-staging.sh` from a VPN-connected machine, then `staging-processes.sh` over SSH with a password.
- **Two processes and three proxies for one app.** Browser → Cloudflare → Caddy → Nginx → PM2 (`slide-maker-api` on 3004, `slide-maker-web` on 4173). The Nginx config is shared with six other apps and "never use `sed` on it" is a documented rule.
- **A full root disk.** The 8.9 GB root drive is documented as nearly full, with `/var/log` and `/home` relocated by symlink and a standing instruction to monitor `df -h /`.
- **State that does not survive a restart.** `RateLimiterMemory` resets on every PM2 restart (a documented known limitation), so the login, registration, and chat limits are advisory.
- **A second identity system.** The app runs its own registration, verification email, admin approval, password reset, and argon2 hashing, gated by an email-domain regex, while the lab now has one CUNY-login boundary with a membership registry that every other tool uses.
- **Model access is per-app.** Three provider SDKs, three key sets in `.env`, prompt caching on one of them, and token accounting estimated at four characters per token because provider usage events are discarded. The lab meanwhile runs one gateway with per-person budgets.
- **Node-only dependencies pin the host.** `better-sqlite3`, `@node-rs/argon2`, `archiver`, `@hono/node-server`, `nodemailer`, and on-disk uploads under `apps/api/uploads` all assume a long-lived Node process with a local filesystem.

### 1.2 Reference one: `cail-cadavre`, the hosting shape

The Exquisite Corpse game was republished on 2026-09-02 as the Worker `cail-cadavre` (it had been a GitHub Pages front end talking to a proxy at inference-arcade.com). Its bundle is the most current statement of how a lab app is shaped on Workers:

| Concern | How cadavre does it |
|---|---|
| Framework | Hono module Worker; `export default app` plus a Durable Object class export |
| Inference, first tier | `env.AI.run(model, inputs, { gateway: { id: env.AI_GATEWAY_ID, skipCache: true } })` against Workers AI models (`@cf/deepseek-ai/deepseek-v4-flash-0731`, `@cf/google/gemma-4-26b-a4b-it`, `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, `@cf/mistralai/mistral-small-3.1-24b-instruct`, `@cf/meta/llama-3.1-8b-instruct-fp8`) |
| Inference, second tier | `fetch(CAIL_GATEWAY_URL + '/chat/completions')` with `Authorization: Bearer CAIL_GATEWAY_KEY` (a managed app key held as a Worker secret), OpenAI-compatible request and response |
| Model catalog | Fetched from `CAIL_CATALOG_URL`, cached five minutes, filtered by a policy var (`CADAVRE_MODEL_POLICY`: exclude regexes, provider allow-set), with a built-in fallback list |
| Request shaping | Clamped `max_tokens`, `temperature`, `top_p`; per-provider "thinking off" flags; every response wrapped in an OpenAI `chat.completion` envelope with `usage` |
| Spend control | A SQLite Durable Object (`CadavreStore`) keeps a per-day `spend` ledger: `reserveSpend` before the call against `CADAVRE_DAILY_TOKEN_CEILING`, `settleSpend` afterwards with the real `completion_tokens` via `waitUntil` |
| Abuse control | Rate Limiting bindings (`TURN_LIMIT`, `READING_LIMIT`, `WALL_LIMIT`) keyed by `cf-connecting-ip` |
| State | The same Durable Object holds the shared "wall" (pins, votes) in SQLite tables created in the constructor |
| Front end | Static pages served as Worker assets; `/ui/config.local.js` is generated by the Worker from vars so the page never ships a key |
| Operations | `/health` reports `RELEASE`, `CAIL_LOG_ENV`, the inference path, whether the gateway key is present, the policy, the model count, and today's spend against the ceiling |

cadavre is a public app with no login. The slide-maker is not, which is why the next two references matter more for it.

### 1.3 Reference two: `cail-model-api`, the lab's model gateway

cadavre's `CAIL_GATEWAY_URL` and `CAIL_CATALOG_URL` point at `cail-model-api` (it logs itself as `service: "cail-gateway"`, contract `cail.gateway.v1`). It is the OpenAI-compatible model API the lab publishes to its users at `https://tools.ailab.gc.cuny.edu/v1`, reached by a direct Worker route that bypasses the doorway so streamed bodies pass untouched.

| Aspect | What `cail-model-api` does |
|---|---|
| Surface | `GET /v1/catalog` (anonymous), `GET /v1/models`, `GET /v1/quota`, `POST /v1/chat/completions` (SSE streaming with `stream: true`; client-executed `tools[].type === "function"` and `tool_choice` accepted), `POST /v1/responses` (no streaming), `POST /v1/run` (raw Workers AI `{ model, input }`) |
| Credentials | Exactly one of `Authorization: Bearer sk-cail-{p\|a\|d}_…` (managed key: personal, app, deployment) or a doorway identity JWT with audience `cail:gateway`. Scopes are fixed: `models:invoke models:read quota:read` |
| Upstream | Everything through Cloudflare AI Gateway: Workers AI via the account's `/ai/v1/chat/completions`, OpenRouter via `gateway.ai.cloudflare.com/v1/{account}/{gateway}/openrouter/…` with `provider: { zdr: true, data_collection: "deny", allow_fallbacks: false }`. Provider keys live in AI Gateway, not in any Worker. No Anthropic, Bedrock, or direct OpenAI path exists in any lab Worker |
| Catalog | Dynamic: Workers AI text-generation models from `env.AI.models()`, OpenRouter models filtered to ZDR-verified endpoints; entries carry `provider`, `capabilities` (`function-calling`, `reasoning`, `vision`), `context_length`, `streaming`, `tier`, `recommended` |
| Budgets | No token counter anywhere. AI Gateway cost spend-limit rules partitioned by request metadata `{ user_id, budget_scope }`; the budget scope (`person`, `person-plus`, `admin`, `app`) comes from the admission registry. Overspend is an upstream 429 mapped to `quota_exceeded` with `retry-after`. `/v1/quota` returns a microdollar snapshot (`limit`, `estimated_used`, `estimated_remaining`, `window_seconds`) |
| Affinity | Optional `x-cail-session-id` becomes upstream session affinity, so one id per deck keeps a conversation on one provider cache |
| Correlation | `x-cail-request-id` echoed on every response; structured JSON logs via `@cuny-ai-lab/cail-log`; AI Gateway payload logging off |
| Stripped fields | Caller-supplied `user`, `metadata`, `api_key`, `provider`, `plugins`, and routing overrides are removed before forwarding, so an app cannot escape its budget partition |

### 1.4 Reference three: `cail-doorway` and admission, how authenticated tools get users

`cail-doorway` is the single public entry for `https://tools.ailab.gc.cuny.edu`. It terminates CUNY Login (OIDC at `ssologin.cuny.edu`), keeps one signed pseudonymous browser session, checks admission on every protected request, mints short-lived identity JWTs, and forwards to product Workers over explicit service bindings according to a checked-in `config/route-policy.json` whose `defaultDecision` is `deny`.

What a tool behind the doorway receives and must do:

- **A route-policy entry, compiled into the doorway.** `tools[]` gets `{ id, label, steward, landingPath, listed }`; `routes[]` gets entries of the shape `{ name, match: "prefix" | "exact", path, access: "public" | "authenticated", requestKind: "page" | "api", identityMode: "jwt", toolId, audience: "cail:<tool>", gatewayIdentity?: true }`. Agent Studio, Model Access, and Kale Deploy receive the full request path (`/agent-studio/api/...`); Site Studio and Workbench receive it with the prefix stripped. Onboarding a tool is therefore a doorway release, plus a service binding in the doorway's Wrangler configuration.
- **Identity by header, per request.** The doorway strips incoming `authorization`, `x-cail-*`, and its own cookies, then injects `x-cail-identity-jwt`: RS256, issuer `https://tools.ailab.gc.cuny.edu/cail-sso`, audience exactly the route's `cail:<tool>`, subject `cail-<32 hex>` (an HMAC of the CUNY subject; not reversible, not an email), a `log_sub` claim for operational logs, and an expiry capped at 300 seconds, the browser session, and the admission membership. On routes with `gatewayIdentity: true` it also injects `x-cail-gateway-identity-jwt` with audience `cail:gateway`. **No email, name, role, or budget claim is minted**; the README states that role and scope values never enter downstream identity claims.
- **Verification with the shared package.** `@cuny-ai-lab/cail-identity` (GitHub Packages, `@cuny-ai-lab` scope) exports `loadIdentityVerifierConfig({ jwks: env.CAIL_IDENTITY_JWKS, issuer: env.CAIL_IDENTITY_ISSUER, expectedAudience })` and `verifyIdentityJwt(token, config)`, returning `{ subject, operationalSubject?, email?, name?, entitlements }`. Its strict auth-error envelope (`{ error: { code, message, launch? } }`, codes such as `authentication_required` and `admission_required`) is what machine clients expect.
- **Admission is the allow-list.** There is no email-domain check in the doorway; access is CUNY Login plus an active membership in `cail-tools-admission` (individual memberships approved from the intake form at `ailab.gc.cuny.edu/request-access/`, or class enrollments via invite links). Membership carries `accessRole: member | admin` and a budget scope, and the doorway rechecks it on every request with a two-second RPC deadline.
- **Hygiene.** Response headers named `x-cail-*` are deleted (a WebSocket handshake echoing a JWT is turned into a 502); cross-origin writes are refused; authenticated responses get `cache-control: private, no-store`. Every fleet member exposes a JSON health route naming itself, probed by admission's fleet view over service bindings.
- **Model calls.** The canonical authenticated pattern is `agent-studio`: it forwards the gateway JWT as an ordinary bearer to `cail-model-api` over a service binding, adds `x-cail-app: <slug>` and `x-cail-session-id`, reads `/v1/models` the same way, and holds no provider key. Budget partitioning is then per person automatically.

### 1.5 What Kale Deploy is, and is not, for this app

The lab's deploy platform has two generations. `cail-deploy-service` (GitHub push-to-deploy into a Workers for Platforms namespace, `kale.project.json` shapes `static_site` and `worker_app`, managed `DB`/`FILES`/`CACHE`/`ASSETS` bindings) is described by the Kale README as retired. Its successor, `kale-release-control-plane` (August 2026; MCP endpoint on `workers.dev`, tools `kale.create_project`, `kale.upload_revision`, `kale.create_release`, `kale.approve_release`, `kale.rollback_release`), accepts Worker-native TypeScript source artifacts of at most 2 MiB and, in the skill's own words, "accepts no requested production bindings. If the app needs D1, R2, KV, secrets, or service bindings, stop and report that product boundary." It also has no public hostname until the lab's DNS namespace is delegated.

The slide-maker needs D1, R2, a Durable Object, an AI binding, secrets, and a doorway service binding, so Kale cannot host it today. That is not unusual: the lab's own first-party tools (`agent-studio`, `site-studio`, `cail-model-api`, `cail-cadavre`) are deployed directly with Wrangler from their repositories, with `bun run check` as the gate. This document follows that path for the app. The earlier `2026-04-11-kale-deploy-integration-design.md` plan for published decks is revisited in §2.9.

---

## 2. Target: one Worker behind the doorway, one gateway, one deck object

```
tools.ailab.gc.cuny.edu/slide-maker/…  ──▶  cail-doorway  ──service binding──▶  cail-slide-maker (Hono)
                                              (CUNY Login, admission,          ├── assets   apps/web/build, base path /slide-maker
                                               x-cail-identity-jwt,            ├── DECKS    Durable Object per deck (SQLite):
                                               x-cail-gateway-identity-jwt)    │            document · mutation log · lock · presence · WebSocket fan-out
                                                                               ├── DB       D1: users(sub) · decks index + access · uploaded_files ·
                                                                               │            chat_messages · templates · themes · artifacts · usage log
                                                                               ├── UPLOADS  R2 bucket {deckId}/{fileId}{ext}
                                                                               ├── GATEWAY  service binding → cail-model-api  (bearer = gateway JWT)
                                                                               ├── ADMISSION service binding → cail-tools-admission AdmissionResolver (admin role)
                                                                               ├── AI       Workers AI binding (toMarkdown for document extraction)
                                                                               └── CHAT_LIMIT · EXPORT_LIMIT · UPLOAD_LIMIT   (Rate Limiting bindings: per-location throttles, keyed by subject)
tools.ailab.gc.cuny.edu/v1/*  ──▶  cail-model-api  ──▶  Cloudflare AI Gateway  ──▶  Workers AI · OpenRouter (ZDR)
```

### 2.1 Decisions

| Decision | Choice | Alternative considered | Rationale |
|---|---|---|---|
| Host | One Worker with static assets, path-mounted behind the doorway at `/slide-maker/` | Own hostname with the app's own login (cadavre's public shape); keep PM2 on the Debian box | Authenticated lab tools live behind the doorway; the app already implements the `/slide-maker` base path; one artifact to deploy; CI can deploy it |
| Identity | Doorway JWT per request, verified with `@cuny-ai-lab/cail-identity`; users keyed by `cail-` subject | Keep registration, verification email, approval, and passwords | One sign-in for every lab tool; admission is the allow-list; deletes the argon2, email, and password-reset code and the host constraints that came with it |
| Admin role | Ask admission on each admin request: an `ADMISSION` service binding to the `AdmissionResolver` entrypoint of `cail-tools-admission`, `resolveMembership({ subject })`, admin if the result is `ok` with `accessRole === 'admin'` | A local list of admin subjects; a role claim in the identity JWT | Administrator authorization is owned by admission. The doorway decides its own admin routes the same way (it mints an admin-audience identity and lets admission make the final check), and its README rules role claims out of identity tokens. A local list would be a second authority that admission could not revoke |
| Sharing | Share by display name or by capability link; the collaborator list stores subjects | Share by email as today | The identity carries no email; capability links are the lab's own pattern for class invites |
| Model access | `GATEWAY` service binding to `cail-model-api` with the gateway JWT as bearer, `x-cail-app: slide-maker`, `x-cail-session-id: <deckId>`; model list from `/v1/models` filtered by capability | App-held provider keys through the app's own AI Gateway | No provider keys in the app; per-person budgets; one log for every model call in the lab; exactly how `agent-studio` does it |
| Claude and Bedrock | Not in the default path. The lab catalog is Workers AI plus ZDR-verified OpenRouter routes; if an `anthropic/…` route is admitted there, it appears in the dropdown like any other | Keep the direct Anthropic and Bedrock adapters | No lab Worker calls Anthropic or Bedrock; keeping them means keeping keys in the app. PR #11's adapters stay in the package for local development and can be re-enabled behind the app's own gateway if the lab decides to, with prompt caching as the one thing that path adds |
| Usage accounting | Provider `usage` events from the gateway stream logged per message; enforcement is the gateway's spend limits; the admin view reads `/v1/quota` | Local token caps in `users.tokenCap` | The cap the app enforces today is an estimate the gateway already enforces in dollars |
| Per-deck state | One SQLite Durable Object per deck (`DeckRoom`) holding the document, mutation log, lock, presence, WebSocket fan-out | Everything in D1 | PR #11 already made the deck a single document with a serialized write path; a Durable Object is exactly a single-writer, strongly consistent, per-key SQLite database with WebSockets attached. cadavre and admission both use the primitive |
| Account-wide tables | D1 via Drizzle (`drizzle-orm/d1`) | Turso, Hyperdrive to Postgres | The schema is already Drizzle SQLite; `drizzle-kit generate` emits migrations D1 applies natively (`migrations_pattern` supports the Drizzle layout) |
| Uploads | R2 | KV, D1 blobs | 10 MB files, 50 MB per deck; object storage with `Cache-Control` passthrough and no egress charge to Workers |
| Document text extraction | `env.AI.toMarkdown()` for PDF, Office documents, and images | `pdf-parse` + `mammoth` + `turndown` | The current stack needs Node streams and a DOM; the binding returns Markdown directly (`toMarkdown().supported()` lists the formats) |
| Export zip | `fflate` | `archiver` | Pure JS; assets stream from R2 |
| Rate limits | Rate Limiting bindings keyed by subject, as throttles only; every limit that must be exact is a count in the store that owns the data (§2.10) | `RateLimiterMemory`; a per-subject Durable Object counter for every limit | The binding counts per Cloudflare location and answers approximately (§2.10), so it bounds abuse rather than enforcing a quota. The quotas that cost money are the gateway's spend limits, which are exact already. Behind a service binding the client IP is not the right key, so the subject is |
| Email | None | Keep SES | Verification, approval, and reset emails disappear with the identity change; share notifications become in-app. Admission owns access emails |
| Realtime | `DeckRoom` WebSocket (hibernation API) broadcasting committed mutation rows | Keep 30 s presence polling | PR #11's "obvious next step" lands for free; polling stays as the fallback. The doorway forwards product WebSocket handshakes |
| Deploy | `wrangler deploy` from GitHub Actions with a scoped API token; `cail-slide-maker-staging` and `cail-slide-maker`; `RELEASE` stamped at deploy | Kale Deploy | Kale accepts no bindings today; first-party lab tools deploy with Wrangler |
| Logging and health | `@cuny-ai-lab/cail-log` events with `x-cail-request-id`; `/slide-maker/api/health` returns `{ ok, status: "ready", service: "cail-slide-maker", release }` | Console logs | Matches the fleet contract admission probes |

### 2.2 The Worker entry and configuration

```ts
// apps/api/src/worker.ts
import { createApp } from './app.js'          // the existing routers behind an identity middleware
import { DeckRoom } from './deck-room.js'      // Durable Object: document + log + lock + presence

export { DeckRoom }
export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => createApp(env).fetch(req, env, ctx),
}
```

```jsonc
// apps/api/wrangler.jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "cail-slide-maker",
  "main": "src/worker.ts",
  "compatibility_date": "2026-09-01",          // Node compatibility is on by default from 2026-08-04
  "assets": {
    "directory": "../web/build",               // SvelteKit adapter-static, base path /slide-maker
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/slide-maker/api/*"]
  },
  "ai": { "binding": "AI" },
  "services": [
    { "binding": "GATEWAY",   "service": "cail-model-api" },
    { "binding": "ADMISSION", "service": "cail-tools-admission", "entrypoint": "AdmissionResolver" }   // admin role, §2.3
  ],
  "d1_databases": [{
    "binding": "DB", "database_name": "cail-slide-maker", "database_id": "<uuid>",
    "migrations_dir": "drizzle", "migrations_pattern": "drizzle/*/migration.sql"
  }],
  "r2_buckets": [{ "binding": "UPLOADS", "bucket_name": "cail-slide-maker-uploads" }],
  "durable_objects": { "bindings": [{ "name": "DECKS", "class_name": "DeckRoom" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["DeckRoom"] }],
  "ratelimits": [                                 // per-location, approximate: throttles, not quotas (§2.10)
    { "name": "CHAT_LIMIT",   "namespace_id": "1001", "simple": { "limit": 30, "period": 60 } },
    { "name": "EXPORT_LIMIT", "namespace_id": "1002", "simple": { "limit": 5,  "period": 60 } },
    { "name": "UPLOAD_LIMIT", "namespace_id": "1003", "simple": { "limit": 20, "period": 60 } }
  ],
  "limits": { "cpu_ms": 60000 },
  "vars": {
    "CAIL_PRODUCT": "cail-slide-maker",
    "CAIL_LOG_ENV": "production",
    "CAIL_CANONICAL_ORIGIN": "https://tools.ailab.gc.cuny.edu",
    "CAIL_BASE_PATH": "/slide-maker",
    "CAIL_IDENTITY_ISSUER": "https://tools.ailab.gc.cuny.edu/cail-sso",
    "CAIL_IDENTITY_AUDIENCE": "cail:slide-maker",
    "CAIL_API_BASE": "https://tools.ailab.gc.cuny.edu/v1",
    "SLIDE_MAKER_MODEL_POLICY": "tools-required",
    "SLIDE_MAKER_DEFAULT_MODEL": "@cf/zai-org/glm-4.7-flash"
  },
  "env": {
    "staging": {
      "name": "cail-slide-maker-staging",
      "vars": { "CAIL_LOG_ENV": "staging", "CAIL_CANONICAL_ORIGIN": "https://slide-maker-staging.cuny.qzz.io", "CAIL_BASE_PATH": "" }
    }
  }
}
```

Secrets are set with `wrangler secret put`, never in `vars`: `CAIL_IDENTITY_JWKS` (the doorway's published key set, as the other tools carry it), `PEXELS_API_KEY`, `TAVILY_API_KEY`, `BRAVE_API_KEY`. There is no admin list to hold. Rate Limiting bindings count over 10 or 60 second periods, per Cloudflare location, with an approximate answer (§2.10); the three above bound how fast one subject can hit chat, export, and upload from one location, and nothing in the app depends on them for correctness. Nothing needs a 15-minute window once passwords are gone.

### 2.3 Identity middleware

```ts
// apps/api/src/middleware/identity.ts
import { loadIdentityVerifierConfig, verifyIdentityJwt, createCailAuthError, serializeCailAuthError } from '@cuny-ai-lab/cail-identity'

export function identity(env: Env) {
  const config = loadIdentityVerifierConfig({
    jwks: env.CAIL_IDENTITY_JWKS, issuer: env.CAIL_IDENTITY_ISSUER,
    expectedAudience: env.CAIL_IDENTITY_AUDIENCE, supportedIssuers: [CAIL_CANONICAL_ISSUER],
  })
  return async (c, next) => {
    const loaded = await config
    if (!loaded.ok) return c.json({ error: { code: 'identity_verification_misconfigured', message: 'Identity is not configured.' } }, 503)
    const token = c.req.header('x-cail-identity-jwt')
    const who = token ? await verifyIdentityJwt(token, loaded.config) : null
    if (!who) return c.body(serializeCailAuthError(createCailAuthError('authentication_required', 'Sign in to continue.', '/launch/slide-maker')), 401, { 'content-type': 'application/json' })
    c.set('user', await upsertUser(env.DB, who))                       // users(id = subject, display_name, last_seen_at)
    c.set('gatewayJwt', c.req.header('x-cail-gateway-identity-jwt'))   // forwarded to cail-model-api, never to the browser
    await next()
  }
}

// Mounted on /slide-maker/api/admin/*. Admission is the authority; nothing is cached or stored.
export function requireAdmin(env: Env) {
  return async (c, next) => {
    let membership
    try { membership = await env.ADMISSION.resolveMembership({ subject: c.get('user').id }) }
    catch { return c.json({ error: { code: 'admission_unavailable', message: 'Administrator authorization is temporarily unavailable.' } }, 503) }
    if (!membership.ok || membership.accessRole !== 'admin') {
      return c.json({ error: { code: 'permission_denied', message: 'Administrator access required.' } }, 403)
    }
    await next()
  }
}
```

- **Administrator authorization belongs to admission.** The app asks `AdmissionResolver.resolveMembership` on every admin request and treats `accessRole === 'admin'` on an `ok` result as the only admin signal; it holds no list, caches nothing across requests, and stores no role in D1, so a revocation in admission takes effect on the next request here exactly as it does at the doorway. The resolver is the private entrypoint the doorway itself binds (`ADMISSION_RESOLVER` in its Wrangler configuration, `resolveMembership({ subject })` returning `{ ok, expiresAt, revision, accessRole, budgetScope }` or `{ ok: false, code: 'not_admitted' }`); binding it from a product Worker is a request to admission's stewards, made together with the doorway route (§2.7). If admission would rather not expose the resolver to product Workers, the app ships with no admin surface at all: its two remaining admin functions, legacy account linking and deck import, run as operator `wrangler` scripts, and deck statistics move to the admission fleet view. Either way the app never decides who is an administrator.
- The `users` table becomes `{ id: subject, displayName, createdAt, lastSeenAt, legacyUserId? }`. `sessions`, `email_verifications`, `password_resets`, `passwordHash`, `status`, `emailVerified`, `tokenCap`, and the whole of `routes/auth.ts` are deleted.
- The first visit asks for a display name (the JWT has none). Sharing searches display names among users who have visited the app and also issues capability links (`/slide-maker/share/<token>`) that grant editor or viewer access to whoever opens them while signed in.
- Existing accounts: a one-time legacy claim. A signed-in user enters the email and password of their old account once; on success the old `users.id` is linked to the subject and every `deck_access`, `uploaded_files.uploadedBy`, and `decks.createdBy` row is rewritten. Admins can also link from the admin page. After a grace period the legacy table and its hashes are dropped.
- Locks, presence, undo actors, and the mutation log all key on the subject.
- The app never sets an identity cookie of its own; there is nothing to forge and nothing to CSRF beyond the doorway's own cross-origin write refusal, so `hono/csrf` is retained only as defense in depth.

### 2.4 Per-deck Durable Object

```ts
export class DeckRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS deck (id TEXT PRIMARY KEY, version INTEGER NOT NULL, document TEXT NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS commits (version INTEGER PRIMARY KEY, base_version INTEGER NOT NULL, actor_kind TEXT, actor_subject TEXT, message_id TEXT, mutations TEXT NOT NULL, inverses TEXT NOT NULL, created_at INTEGER);
      CREATE TABLE IF NOT EXISTS lock (subject TEXT, display_name TEXT, expires_at INTEGER);
      CREATE TABLE IF NOT EXISTS presence (subject TEXT PRIMARY KEY, display_name TEXT, active_slide_id TEXT, last_seen INTEGER);
    `)
  }
  async apply(batch: { baseVersion: number; mutations: Mutation[]; actor: Actor; mode: 'commit' | 'propose' }) {
    // rejects unless batch.baseVersion === deck.version; runs @slide-maker/core applyBatch against the
    // stored document; on success writes ONE commits row at version + 1 carrying the whole batch,
    // sets deck.version = version + 1, broadcasts { type: 'commit', version, mutations, inverses }
    // to every hibernating WebSocket. mode: 'propose' returns { mutations, inverses } and writes nothing.
  }
  async fetch(req: Request) { /* WebSocket upgrade → ctx.acceptWebSocket(server) */ }
}
```

Commit and version semantics are those of PR #11 §2.2, not a variant of them: a commit is one batch of any length, `version` increases by exactly one per commit, and the row holds the batch (`mutations[]` in application order, `inverses[]` in the order that undoes them). The first draft's `mutations (version INTEGER PRIMARY KEY, mutation, inverse)` table implied one version per mutation, which would have made the two designs disagree on what a version is; that table is gone. `version INTEGER PRIMARY KEY` here is PR #11's `(deck_id, version)` key with the deck implied by the object. Undo re-commits a commit's inverses as a new version; no row is ever rewritten, so the log is the same append-only history on both hosts and the Phase 5 import (§3) copies rows without translation.

The Hono route `POST /slide-maker/api/decks/:id/mutations` becomes a one-line RPC: `env.DECKS.get(env.DECKS.idFromName(deckId)).apply(batch)`. The lock check and the slide cap move inside `apply`, which is the only writer. The D1 `decks` row keeps the name, slug, theme, owner subject, `updated_at`, and access list so the gallery and admin stats never open a Durable Object. Point-in-time recovery on SQLite Durable Objects gives each deck a 30-day undo of last resort without any code.

### 2.5 The AI package on this host

The `@slide-maker/ai` adapters proposed in PR #11 emit a `ModelEvent` stream and take a tool schema. On this host one adapter does all the work, because the gateway is OpenAI-compatible for every model:

```ts
// packages/ai/src/providers/cail-gateway.ts
export async function* streamCailGateway(env: Env, req: ChatRequest, ctx: { gatewayJwt: string; deckId: string; requestId: string }): AsyncIterable<ModelEvent> {
  const res = await env.GATEWAY.fetch(`${env.CAIL_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ctx.gatewayJwt}`,           // the doorway-minted cail:gateway leg, never a stored key
      'x-cail-app': 'slide-maker',
      'x-cail-session-id': ctx.deckId,                     // upstream cache affinity per deck
      'x-cail-request-id': ctx.requestId,
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify({ model: req.model, messages: req.messages, tools: req.tools, tool_choice: req.tools ? 'auto' : undefined, stream: true, max_tokens: req.maxTokens }),
    redirect: 'manual',
  })
  if (!res.ok) yield* gatewayError(res)                    // quota_exceeded → surfaced with retry-after; insufficient_scope, admission_required → 403 to the browser
  else yield* parseOpenAiSse(res.body)                     // text_delta · tool_call · usage · done
}
```

- The dropdown is `GET /v1/models` with the same bearer, filtered by `SLIDE_MAKER_MODEL_POLICY`. Its only value is `tools-required`: entries whose `capabilities` include `function-calling` are offered, the rest are not, because the mutation tool is the only edit path (PR #11 keeps no fenced parser). Workers AI models documented with function calling today include `@cf/zai-org/glm-4.7-flash`, `@cf/openai/gpt-oss-120b`, `@cf/qwen/qwen3-30b-a3b-fp8`, `@cf/google/gemma-4-26b-a4b-it`, and `@cf/mistralai/mistral-small-3.1-24b-instruct`.
- Usage arrives in the stream's final chunk and is written to a per-message usage log. Enforcement is the gateway's spend limit for the person; the admin page shows `/v1/quota` for the signed-in admin and drops the per-user cap editor.
- The planner runs through the same adapter with `x-cail-session-id` set to the deck as well.
- Request budget: the current 120-second chat cap stays. HTTP-triggered Workers have no wall-clock limit; CPU time is the only budget and SSE parsing spends almost none.
- The direct Anthropic, Bedrock, and OpenRouter adapters remain in the package for local development against `.env` keys. Enabling any of them in production would be a deliberate departure from the lab convention and is not part of this plan.

### 2.6 Everything else, mapped

| Today (Node host) | On the Worker |
|---|---|
| Lucia sessions, cookies, `routes/auth.ts`, argon2, verification and reset emails | Doorway JWT per request; `users` keyed by subject; legacy claim for existing accounts |
| Admin approval queue, `users.status`, token caps | Admission owns access and the administrator role (`ADMISSION.resolveMembership`, §2.3); gateway quota for budgets |
| `better-sqlite3` + `sqlite.transaction()` | D1 for account tables; Durable Object SQLite for deck state; transactions are single-object by construction |
| `rate-limiter-flexible` in memory | Rate Limiting bindings keyed by subject as throttles; exact limits stay as counts in D1 and `DeckRoom` (§2.10) |
| `apps/api/uploads/{deckId}/{fileId}` on disk, symlinked to `/data` | R2 object `{deckId}/{fileId}{ext}`; the file route streams from R2 with `Cache-Control: private` |
| `pdf-parse`, `mammoth`, `turndown` | `env.AI.toMarkdown()` |
| `archiver` | `fflate`; export reads assets from R2 and the artifacts IIFE from `ASSETS` |
| `nodemailer` + `@aws-sdk/client-ses` | Deleted |
| Three provider SDKs and `.env` keys | One gateway adapter; keys nowhere |
| `dotenv` + `env.ts` | `Env` type generated by `wrangler types`; `env.ts` becomes a validator over `c.env` that fails closed like the other lab Workers |
| `debug/transcript-log.ts` writing files | Deleted; AI Gateway logs (in the lab's gateway) and Workers Logs replace it |
| SSRF guard on `node:dns/promises` `lookup` | Rewritten on `resolve4` and `resolve6`; `lookup` throws "Not implemented" on Workers (§2.10). Same policy, same tests |
| Presence polling every 30 s, lock heartbeat | `DeckRoom` WebSocket with hibernation; REST endpoints stay for clients without a socket |
| `@hono/node-server` `serve()` | Module Worker `fetch`; CSP headers from `hooks.server.ts` move into the Hono app |
| Vite dev proxy to `localhost:3001` with a forged `Origin` | `wrangler dev` with local D1, R2, and Durable Objects; the `GATEWAY` binding is remote; a test issuer from `@cuny-ai-lab/cail-identity/testing` mints identities locally |

### 2.7 Onboarding to the doorway

One pull request to `cail-doorway`, after the Worker exists:

```jsonc
// config/route-policy.json additions
{ "id": "slide-maker", "label": "Slide Maker", "steward": "CUNY AI Lab", "landingPath": "/slide-maker/", "listed": true }

{ "name": "slide-maker-api",  "match": "prefix", "path": "/slide-maker/api", "access": "authenticated", "requestKind": "api",
  "identityMode": "jwt", "toolId": "slide-maker", "audience": "cail:slide-maker", "gatewayIdentity": true },
{ "name": "slide-maker-page", "match": "prefix", "path": "/slide-maker",     "access": "authenticated", "requestKind": "page",
  "identityMode": "jwt", "toolId": "slide-maker", "audience": "cail:slide-maker", "gatewayIdentity": true }
```

plus a `SLIDE_MAKER` service binding in the doorway's Wrangler configuration, and optionally a binding in admission's fleet probe so the app appears on the systems page. The doorway forwards the full path, as it does for Agent Studio, which is why the app keeps its `/slide-maker` base path. The same request to the stewards asks whether a product Worker may bind admission's `AdmissionResolver` entrypoint for the admin check (§2.3); the answer decides whether the app has an admin page or operator scripts.

### 2.8 Hostnames, paths, staging

- Production: `https://tools.ailab.gc.cuny.edu/slide-maker/`. The base path stays; the SvelteKit `${base}/` discipline stays; the two `+server.ts` proxies go away because the API is same-origin.
- Staging: the doorway has no staging binding by policy, so `cail-slide-maker-staging` runs unfronted on a `cuny.qzz.io` hostname with an empty base path and a staging identity issuer whose keys only CI and the team hold. Playwright signs in by minting a JWT from that issuer, which is what the lab's own component tests do.
- Local: `wrangler dev` plus the SvelteKit dev server; the same test issuer.

### 2.9 Published decks

`generateDeckFiles()` from PR #11 writes a published deck to an R2 bucket with a public custom domain (`slide-decks.cuny.qzz.io` as the Kale spec planned, or a path under the lab's site once DNS is delegated). This replaces the GitHub Trees API client and the separate Kale project from `2026-04-11-kale-deploy-integration-design.md`: Kale's current release contract carries source artifacts of at most 2 MiB and no public hostname, neither of which fits a deck with images. If Kale later serves static assets on a public hostname, publishing becomes a `kale.upload_revision` call from the same file list.

### 2.10 Two platform facts the first draft got wrong

**DNS in the SSRF guard.** `apps/api/src/utils/ssrf-guard.ts` calls `lookup()` from `node:dns/promises` twice (resolve, resolve again, compare) and returns the first address. Under Workers Node compatibility, `node:dns` is implemented over DNS-over-HTTPS to 1.1.1.1: `resolve4`, `resolve6`, and the other record-type functions work, but `lookup`, `lookupService`, and `resolve` throw "Not implemented" (`developers.cloudflare.com/workers/runtime-apis/nodejs/dns/`). The first draft's "same code" was wrong. The guard is rewritten in Phase 2 so that one implementation runs on both hosts:

- resolve `A` and `AAAA` with `resolve4` and `resolve6` (both, so a hostname whose only private answer is an `AAAA` record is rejected), treating "no records" as a failure, and reject if any returned address is private; `isPrivateIp` and its range table do not change;
- resolve again and reject if the second answer set contains a private address or differs from the first, which is the rebinding check the current code does with `lookup`;
- keep `redirect: 'manual'` and the 10-second timeout on the fetch that follows.

What the guard cannot do on either host is pin the connection to the address it checked: Workers `fetch` resolves the hostname itself and takes no caller-supplied address, and the Node code never used the `resolvedIp` it returns (`routes/search.ts` discards it). So the residual risk is the same time-of-check gap as today, and on Workers it is smaller in consequence: the request leaves from Cloudflare's edge, and this Worker has no VPC, tunnel, or private-network binding, so there is no private network behind it for a rebound name to reach. The guard still refuses loopback, link-local (`169.254.169.254`-style), and RFC 1918 answers. `tests/ssrf-guard.test.ts` runs against the new resolver with the resolver stubbed.

**Rate Limiting bindings.** The binding counts per Cloudflare location, not globally, and its `limit()` answer is approximate and eventually consistent (`developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/`). A subject whose requests land on two locations gets roughly twice the configured rate; a burst can pass before the counter catches up. The first draft called this "global and durable"; it is neither. What the binding is for here: bounding how fast one subject can hit chat, export, and upload, so a runaway client or script cannot saturate the Worker or the gateway. What it is not for: anything the app must get right. Those are counts, and each lives where its data lives:

| Limit | Where it is enforced | Why it is exact |
|---|---|---|
| Chat spend | `cail-model-api` spend limits per person | AI Gateway enforces in dollars, upstream of the app |
| 10 MB per file, 50 MB per deck | The `uploaded_files` sum read inside the D1 upload transaction | one row set, one transaction |
| 60 slides per deck, lock ownership, `baseVersion` check | `DeckRoom.apply` | single-writer object |
| Login attempts | Nothing | no passwords |

`CHAT_LIMIT` keeps today's figure (30 per minute) because it was always a throttle; the difference is that the design now says so.

---

## 3. Migration plan

Each phase is deployable on the current host until Phase 5 flips traffic. Sizes are relative. Review of this document approves none of the following; each is asked for when its phase is ready: Phase 2 needs D1, R2, and Durable Object resources created on the lab's Cloudflare account and a scoped deploy token in CI; Phase 3 needs the doorway route, the doorway service binding, and admission's answer on the resolver binding; Phase 5 is the account and data migration and needs an explicit go from the lab.

### Phase 0 — Portability shims on the Node host (S)
- Replace `archiver` with `fflate` behind the existing `exportDeckAsZip()` signature; the golden zip test from PR #11 Phase 0 must pass on entry names and contents.
- Put uploads behind a `FileStore` interface (filesystem implementation now, R2 later); put rate limiting behind a `Limiter` interface; put document extraction behind an `extractMarkdown()` interface.
- Delete the file-based transcript log.
- Add the `@cuny-ai-lab` registry mapping to `.npmrc` and a `read:packages` token to CI so `@cuny-ai-lab/cail-identity` and `@cuny-ai-lab/cail-log` can be installed.

### Phase 1 — Gateway model access on the Node host (M)
- Add the `cail-gateway` adapter to `@slide-maker/ai`. On the Node host it authenticates with a managed app key (`sk-cail-a_…`, obtained from the lab, held in `.env` as `CAIL_GATEWAY_KEY`) exactly as cadavre does; the doorway JWT path is the same code with a different bearer.
- Model list from `/v1/models` with the capability filter; usage from the stream; the planner on the same adapter.
- Keep the Anthropic, Bedrock, and OpenRouter adapters selectable in development only.

### Phase 2 — Worker entry and local development (M)
- Add `apps/api/src/worker.ts`, `wrangler.jsonc`, `R2FileStore`, `BindingLimiter`, and the `toMarkdown` extractor. `createApp(env)` builds the Hono app from either the Node env or the Worker `Env`.
- Rewrite the SSRF guard on `resolve4`/`resolve6` (§2.10) and run `tests/ssrf-guard.test.ts` against it on both hosts.
- `drizzle-kit generate` produces D1 migrations from `schema.ts`; `wrangler d1 migrations apply` in CI.
- CI adds `wrangler deploy --dry-run` so the bundle is built on every PR, and `wrangler deploy --env staging` on `main`.

### Phase 3 — Identity (M)
- Identity middleware, `users` keyed by subject, display-name prompt, share-by-name and capability links, `requireAdmin` over the `ADMISSION` resolver binding, legacy claim endpoint, health route, `cail-log` events.
- Delete `routes/auth.ts`, Lucia, argon2, SES, the approval queue, and the token-cap editor.
- Open the doorway pull request and the admission request (§2.7). Until they land, staging runs with the test issuer and a stub resolver.

### Phase 4 — Deck Durable Object (M)
- `DeckRoom` implements `apply`, `get`, lock, presence, and WebSocket broadcast; the mutations route delegates to it. The client subscribes to the socket and applies broadcast mutations with the same reducer it already uses optimistically.

### Phase 5 — Cutover (M)
- Data: `sqlite3 .dump` of the account tables into D1 (users become legacy rows awaiting claim); an admin-only import creates one `DeckRoom` per deck from the document produced by PR #11 Phase 2; `wrangler r2 object put` for uploads.
- Merge the doorway route; announce the new address; keep the Debian processes stopped but present for one release cycle, then remove them and reclaim the root disk and the Nginx block.

---

## 4. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The doorway change is a release of someone else's Worker | It is a two-entry JSON addition and one binding, the same shape as every other tool; the app is fully testable on staging with the test issuer before the request is opened |
| No email or name in the identity | Display names are asked once; sharing uses names and links; the legacy claim links old accounts by proof of password rather than by email matching |
| Claude is not in the lab catalog | The mutation tool is exercised against `glm-4.7-flash`, `gpt-oss-120b`, and `gemma-4` on staging with the golden fixtures before the default is chosen; models that fail are not listed; a direct Anthropic path stays possible in the package if the lab decides to admit one |
| Admission declines to expose `AdmissionResolver` to a product Worker | The app ships with no admin surface; legacy linking and deck import become operator scripts (§2.3) |
| Rate Limiting bindings undercount across locations or lag | They are throttles only; every exact limit is a count in D1 or `DeckRoom` (§2.10) |
| The SSRF guard cannot pin the connection on Workers | Same gap as on Node today; no private network is reachable from the Worker (§2.10) |
| Gateway quota interrupts a streaming edit | `quota_exceeded` arrives with `retry-after`; the chat surfaces it as a distinct state rather than a generic failure, matching the doorway's own "keep quota outcomes distinct" rule |
| CPU time on the Worker (30 s default) for SSR export of a 60-slide deck plus zip | `limits.cpu_ms` raised to 60 s; export streams; measured against the golden fixtures in CI |
| Worker bundle size with the Svelte SSR renderer and the Hono app | Comfortably under the compressed bundle limit; the artifacts IIFE and the SPA are assets, not bundle |
| Durable Object per deck means a cold start on first request | Single-digit milliseconds; the gallery reads D1, not objects |
| Kale might later want to host the app | The app's Wrangler configuration is the same artifact Kale would consume once it accepts bindings; nothing here forecloses that |
| Two hosts during transition | Phases 0 and 1 run on both; Phases 2 to 4 are Worker-only behind staging; Phase 5 is the only one-way step and has the dump as its rollback |

---

## 5. Explicitly unchanged

The 7 layouts and 14 modules, the zone model, the export zip layout, the sharing roles (owner, editor, viewer), the CSP and sanitization invariants in `CLAUDE.md`, the SSRF policy (private ranges refused, redirects not followed; the resolver behind it changes per §2.10), the path traversal guard, and every package proposed in PR #11. This document changes the host, the identity boundary, and the model-access wiring, nothing above them.

---

## 6. Alternatives considered

- **Own hostname with the app's own login (cadavre's shape).** Right for a public game; wrong for a CUNY-gated tool that would then be the only lab tool with a second sign-in and its own approval queue.
- **Doorway in front, local accounts kept behind it.** Users would sign in twice and admins would approve twice. Rejected.
- **Cloudflare Pages for the SPA plus a separate API Worker.** Two deployables and cross-origin cookies again. The single Worker with assets is the newer, simpler shape and the one the lab uses.
- **Everything in D1, no Durable Objects.** Works for the document but loses the single-writer guarantee that the mutation log relies on, and realtime would need another primitive anyway.
- **Keep the Debian host and only route models through the lab gateway.** Phase 1 alone is worth doing and is written to run there. It does not fix deploys, disk, rate limits, or the second identity system.
- **Kale Deploy for the app.** Not possible under the current release contract (no bindings, 2 MiB source artifacts, no public hostname); revisit when that changes.

---

## 7. Relationship to PR #11

PR #11 is the precondition: the reducer and document make the deck Durable Object a thin shell, the render package makes SSR export host-neutral, and the `ai` package's `ModelEvent` contract is what the gateway adapter implements. The two documents share one definition of a commit and a version (PR #11 §2.2, §2.4 here) and one decision that tool use is the only AI edit path. Nothing in PR #11 assumes the Node host, and nothing here reopens the deck model. The two can be reviewed independently and land in order.
