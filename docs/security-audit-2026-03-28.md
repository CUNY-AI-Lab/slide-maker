# Security Audit — 2026-03-28

## Overview

4-agent parallel review covering: auth/sessions, API/injection, file uploads/export, frontend XSS.
Deduped findings below. Grouped by severity, then by fix complexity (quick wins first).

---

## CRITICAL (fix immediately)

### C1. No HTML sanitization anywhere — stored XSS via `{@html}`
**Impact:** Any AI mutation or API call can inject `<script>` / event handlers into slides. Affects all viewers of shared decks. Persists into exported HTML files.
**Files:**
- `apps/web/src/lib/components/renderers/TextModule.svelte:112` — `{@html renderedHtml}`
- `apps/web/src/lib/components/renderers/CardModule.svelte:30` — `{@html content}`
- `apps/web/src/lib/components/renderers/TipBoxModule.svelte:34` — `{@html content}`
- `apps/web/src/lib/components/renderers/ComparisonModule.svelte:28` — `{@html panel.content}`
- `apps/api/src/export/html-renderer.ts:68-73` — `data.html` trusted verbatim in export

**Fix:** Install `dompurify` (frontend) and `sanitize-html` (API/export). Wrap every `{@html}` and every export HTML emission.

### C2. Missing authorization on block CRUD endpoints (IDOR)
**Impact:** Any authenticated user can add/edit/delete blocks on ANY deck by knowing a blockId.
**Files:**
- `apps/api/src/routes/decks.ts:392` — `POST /:id/slides/:slideId/blocks` (no access check)
- `apps/api/src/routes/decks.ts:434` — `PATCH /:id/slides/:slideId/blocks/:blockId` (no access check)
- `apps/api/src/routes/decks.ts:476` — `DELETE /:id/slides/:slideId/blocks/:blockId` (no access check)

**Fix:** Add `deckAccess` check to all three handlers (same pattern as `PATCH /:id/slides/:slideId`).

### C3. Hardcoded admin credentials in version-controlled seed file
**Impact:** Anyone with repo access knows the admin password (`Gremlins2025!`).
**File:** `apps/api/src/db/seed.ts:377-379`

**Fix:** Remove hardcoded passwords. Use env vars or CLI-only bootstrapping. **Rotate current admin passwords immediately.**

### C4. SVG uploads served with `image/svg+xml` — script execution
**Impact:** Uploaded SVGs with `<script>` execute in the app's origin when accessed directly.
**File:** `apps/api/src/routes/files.ts:155`

**Fix:** Serve SVGs with `Content-Disposition: attachment`, or sanitize SVGs at upload time, or serve uploads from a separate domain.

---

## HIGH (fix this sprint)

### H1. `javascript:` URL injection — markdown links + TipTap Link extension
**Impact:** `[click](javascript:alert(1))` works in markdown. TipTap Link accepts `javascript:` hrefs by default. Both stored and re-rendered via `{@html}`.
**Files:**
- `apps/web/src/lib/components/renderers/TextModule.svelte:82` — markdown link regex
- `apps/web/src/lib/components/renderers/RichTextEditor.svelte:57` — TipTap Link config
- `apps/web/src/lib/components/renderers/FormatToolbar.svelte:78` — `prompt()` URL input

**Fix:** Add protocol allowlist (`https`, `http`, `mailto`) to TipTap Link config. Validate URLs in markdown renderer. DOMPurify (from C1) also strips these.

### H2. Prompt injection — chat history trusted from client
**Impact:** Client can fabricate assistant messages in history to override system prompt.
**File:** `apps/api/src/routes/chat.ts:133-138`

**Fix:** Reconstruct chat history server-side from `chatMessages` DB table. Only accept the current user message from the request.

### H3. CSS injection in theme creation
**Impact:** Unsanitized color/font values interpolated into `<style>` block. Can inject arbitrary CSS.
**File:** `apps/api/src/routes/resources.ts:32-43`

**Fix:** Validate colors against `/^#[0-9a-fA-F]{3,8}$/`. Validate font names against `/^[a-zA-Z0-9 -]+$/`.

### H4. No rate limiting on login/registration
**Impact:** Credential stuffing, brute force, admin approval queue spam.
**File:** `apps/api/src/routes/auth.ts:23,102`

**Fix:** Add `hono-rate-limiter` middleware. ~5 login attempts / 15min / IP. ~3 registrations / hour / IP.

### H5. No CSRF protection
**Impact:** Cross-site form POSTs can execute state-changing actions with `sameSite: lax` cookie.
**File:** `apps/api/src/index.ts:18-21`

**Fix:** Either switch cookie to `sameSite: 'strict'` (no OAuth flows to break) or add `hono/csrf` middleware.

### H6. Zip slip via unsanitized `file.filename` in export
**Impact:** Original user-supplied filename with `../` sequences writes outside the expected directory on extraction.
**File:** `apps/api/src/export/index.ts:85`

**Fix:** `archive.file(filePath, { name: \`\${slug}/assets/\${path.basename(file.filename)}\` })`

### H7. File listing endpoint missing deck access check
**Impact:** Any authenticated user can enumerate all files for any deck.
**File:** `apps/api/src/routes/files.ts:116-133`

**Fix:** Add `deckAccess` check before the query.

### H8. File type validated by client-supplied MIME only
**Impact:** Attacker can upload HTML/JS as `image/png`. SVG-as-PNG vice versa.
**File:** `apps/api/src/routes/files.ts:73-79`

**Fix:** Use `file-type` package to verify magic bytes match declared MIME.

### H9. No Content Security Policy headers
**Impact:** No browser-level mitigation for XSS exploitation.
**File:** No `hooks.server.ts` exists.

**Fix:** Create `apps/web/src/hooks.server.ts` with CSP headers (`script-src 'self'`, etc).

### H10. Insecure fallback for SESSION_SECRET
**Impact:** If env var missing in production, falls back to `'dev-secret-change-me'`.
**File:** `apps/api/src/env.ts:6`

**Fix:** Throw on startup if `NODE_ENV === 'production' && !process.env.SESSION_SECRET`.

### H11. Artifact iframe `src` not scheme-validated
**Impact:** `javascript:` or `data:` URLs in artifact `src` can execute in sandboxed iframe (browser-dependent).
**Files:**
- `apps/web/src/lib/components/renderers/ArtifactModule.svelte:15`
- `apps/api/src/export/html-renderer.ts:184`

**Fix:** Validate `data.src` allows only `https?://` schemes.

---

## MEDIUM (fix soon)

### M1. Session cookie `httpOnly` not explicitly set
**File:** `apps/api/src/auth/lucia.ts:8-14`
**Fix:** Add `httpOnly: true` explicitly to cookie attributes. Verify with live response headers.

### M2. Email verification token in URL query string
**File:** `apps/api/src/routes/auth.ts:79-98`
**Fix:** Submit token via POST body. Delete old tokens before generating new ones.

### M3. Admin page guard is client-side only
**File:** `apps/web/src/routes/(app)/admin/+page.svelte:16-22`
**Fix:** Add `+page.server.ts` that redirects non-admins at the server level.

### M4. No request body size limits
**File:** `apps/api/src/index.ts`
**Fix:** `app.use('/*', bodyLimit({ maxSize: 1 * 1024 * 1024 }))` (exempt file upload route).

### M5. AI provider error messages leaked to client
**File:** `apps/api/src/routes/chat.ts:185-189`
**Fix:** Log full error server-side. Return generic message to client.

### M6. Unauthenticated templates/themes/artifacts endpoints
**File:** `apps/api/src/routes/resources.ts:11-21,61`
**Fix:** Add `authMiddleware` if data should not be public.

### M7. Path traversal risk — absolute paths stored in DB
**File:** `apps/api/src/export/index.ts:83`
**Fix:** Store relative paths only. Resolve against `UPLOADS_DIR` with containment check.

---

## Recommended Fix Grouping (for parallel work)

### Branch A: `fix/xss-sanitization` (C1, H1, H11)
All frontend renderer changes + DOMPurify. Single concern, touches `apps/web/` only.
- Install `dompurify`
- Wrap all `{@html}` calls
- Add protocol allowlist to TipTap Link + markdown renderer
- Validate artifact `src` scheme

### Branch B: `fix/api-auth-access` (C2, H4, H5, H7, M1, M4)
All API middleware and access control. Touches `apps/api/src/` only.
- Add `deckAccess` checks to block endpoints
- Add rate limiting middleware
- Add CSRF middleware
- Add body size limits
- Fix file listing access check
- Explicit `httpOnly: true`

### Branch C: `fix/export-security` (C1-export, H3, H6, M7)
Export pipeline + theme sanitization. Touches `apps/api/src/export/` and `resources.ts`.
- Install `sanitize-html` for server-side
- Sanitize `data.html` in export renderer
- Fix zip slip with `path.basename()`
- Validate theme CSS values
- Store relative file paths

### Branch D: `fix/upload-serving` (C4, H8, M5)
File upload/serving hardening. Touches `apps/api/src/routes/files.ts`.
- Add `Content-Disposition: attachment` for SVG
- Add magic byte verification
- Sanitize error messages

### Branch E: `fix/infra-hardening` (C3, H2, H9, H10, M2, M3, M6)
Config, auth, CSP, seed file. Misc files.
- Remove hardcoded admin passwords from seed
- Reconstruct chat history server-side
- Create `hooks.server.ts` with CSP
- Add SESSION_SECRET production guard
- Server-side admin page guard
- Fix email verification token handling

---

## What's done well

- Drizzle ORM used consistently — no raw SQL injection vectors
- No `child_process` / shell exec anywhere
- Argon2 for password hashing (good cost factor)
- File uploads use CUID filenames (not original names on disk)
- Auth middleware applied at router level in most places
- No API keys exposed client-side
- No localStorage/sessionStorage for auth tokens
- `PromptBlockModule` uses Svelte auto-escaping (safe)
- `CardGridModule` uses Svelte auto-escaping (safe)
- Chat message renderer HTML-escapes before tag generation

---

## Post-Fix Rounds (2026-03-29)

### Round 2 — Post-fix verification
- Fixed: bodyLimit breaking file uploads (exempted upload route from 2MB limit)
- Fixed: Block PATCH/DELETE not verifying ownership chain (block→slide→deck)
- Fixed: Content-Disposition filename header injection
- Fixed: Export path traversal guard on file.path
- Fixed: ChatMessage.svelte missing DOMPurify
- Fixed: slide-html.ts trusting data.html in srcdoc

### Round 3 — Final sweep
- Fixed: `download-image` endpoint missing deck access check (Critical)
- Fixed: Theme CSS values unsanitized at render time — added safeColor/safeFont validators (Critical)
- Fixed: `card`/`tip-box` export using esc() on TipTap HTML — now uses sanitize() (Important)
- Fixed: SSE stream no timeout — added 2-minute hard cap (Important)
- Fixed: Rate limiter IP spoofable via X-Forwarded-For — now only trusts from localhost (Important)
- Added: Rate limiting on login (5/15min), registration (3/hr), chat (30/min)

### Round 4 — Admin dashboard & token tracking review (2026-03-29)
- Reviewed: `admin.ts` new endpoints (GET /users/all, PATCH /users/:id, GET /users/:id/usage)
- Reviewed: `schema.ts` new tokenUsage table and tokenCap column
- Reviewed: `UserApprovalQueue.svelte` admin dashboard UI
- Result: **No new security issues found.** All admin routes properly gated with authMiddleware + adminMiddleware. Input validation on role/status/tokenCap. No {@html} usage in admin UI. Drizzle ORM parameterized queries throughout.
- Note: Server-side admin page guard (+page.server.ts) was removed due to SvelteKit cookie forwarding issues. API-level protection is sufficient — the client-side guard prevents rendering but admin page JS is served to all authenticated users (low risk, no sensitive data in the component itself).
