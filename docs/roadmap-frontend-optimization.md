# Frontend Optimization & Export Pipeline Roadmap

Summary of the audit, fixes landed, and follow‑ups to harden the export pipeline and tighten the AI prompt context around artifacts.

## Completed This Session
- Removed dead code from the old iframe preview path:
  - Deleted `apps/web/src/lib/utils/slide-html.ts`
  - Deleted `apps/web/src/lib/utils/framework-css-client.ts`
- Fixed container query consistency in Carousel renderer:
  - `max-height: 55vh` → `55cqi` in `CarouselModule.svelte`
- Extracted artifact HTML into separate files in export ZIP:
  - `apps/api/src/export/html-renderer.ts`: added `extractArtifacts` option, exported `renderModule`, and tracked extracted artifacts
  - `apps/api/src/export/index.ts`: writes extracted artifact files under `artifacts/` in the ZIP
  - New tests: `tests/export-artifacts.test.ts` (Vitest) — verifies `iframe src` points to `artifacts/` and `srcdoc` inlining behavior when disabled
- System prompt now lists available artifacts for AI awareness:
  - `apps/api/src/prompts/system.ts`: added “Available Artifacts” section and guidance
  - `apps/api/src/routes/chat.ts`: queries artifacts and passes them to `buildSystemPrompt`

## Rationale
- Large decks with multiple artifacts were bloating `index.html` via `srcdoc`. Extracting artifact sources into standalone files makes the export smaller, cacheable, and safer to process.
- Listing artifacts in the system prompt gives the assistant practical context to suggest concrete visualizations without guessing.

## What’s Next
- Optional: add an export-time size cap per artifact and surface totals in `manifest.json` for visibility.
- Optional: add a checksum to each artifact filename for long‑term cacheability across exports.
- Optional: add an integration test that unzips the export and asserts artifact file presence and `iframe src` references.

## Deferred (Not in Scope)
Library additions recommended earlier (Moveable, PaneForge, Melt UI, Floating UI, Endo, Unovis) are intentionally deferred. The current code is simpler and sufficient, and the near‑term priority is export stability and artifact handling — not adding 6 new UI or runtime dependencies.

