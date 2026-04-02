# TODO

Working list of near-term fixes and enhancements. Grouped by area and written as small, verifiable tasks.

## Editor Interaction
- [ ] Heading modules have no format toolbar — clicking a heading gives no UI for changing level, font size, or alignment (the AI can set these via mutations but there's no manual control)
- [ ] Artifact modules need an alignment control — they don't receive the format toolbar either, so there's no way to align artifacts from the canvas
- [ ] Module drag & drop within zones (ZoneDrop)
  - [ ] Integrate `svelte-dnd-action` for vertical reordering without fighting resize controls
  - [ ] Keyboard reorder (focusable list items; Alt+Arrow or Cmd/Ctrl+Arrow to move)
  - [ ] Live order persistence and optimistic update (keeps current `reorderBlocks` API)
- [ ] Drag from Resources → Canvas
  - [ ] Drop images/files/artifacts into a zone to auto-create modules
  - [ ] Visual drop affordances and a11y roles/labels
- [ ] Split handle a11y
  - [ ] Focusable handle with arrow-key resizing and value change announcements

## LLM Debug Dashboard
- [ ] Proof of concept — verify stream event capture and transcript logging work end-to-end
- [ ] Confirm dev-only route gating is solid

## Markdown → HTML Rendering
- [ ] Thorough audit of markdown-to-HTML rendering in preview and zip export
  - [ ] Check all module types that accept markdown (text, card, tip-box, prompt-block, comparison, card-grid, stream-list)
  - [ ] Verify inline formatting (bold, italic, code, links, lists) renders correctly in preview iframe
  - [ ] Verify same output in exported zip HTML
  - [ ] Fix any discrepancies between editor, preview, and export

## Artifacts — JS Primitives Standard
- [ ] Establish native JS (canvas/DOM) as the standard path for all artifacts going forward
- [ ] Audit remaining iframe-fallback artifacts and plan migration to native factories
- [ ] Design artifact reusability: bind artifacts to user accounts so they can be saved and reused across decks
  - [ ] DB schema for user-owned artifacts (extend `artifacts` table with `userId`, `isPublic`)
  - [ ] UI for browsing/inserting saved artifacts from Resources panel
- [ ] Document the native artifact authoring guide (factory pattern, registration, export parity)

## System Prompt Optimization
- [ ] Reduce verbosity in `apps/api/src/prompts/system.ts`
- [ ] Ensure the model doesn't overproduce — tighten instructions around response length and mutation density
- [ ] Trim redundant examples and repetitive framing
- [ ] Test with multiple models to confirm behavior stays on track after edits

## Chat Panel Features
- [ ] Starter prompts — show contextual prompt chips when chat is empty or a new deck is created
  - [ ] Design chip set (e.g. "Create a title slide", "Add a two-column layout", "Help me outline a presentation on...")
  - [ ] Wire chips to send as user messages
- [ ] Suggested next prompts — after assistant response, offer 2-3 follow-up chips based on current deck state
  - [ ] Generate suggestions server-side (lightweight, no extra LLM call — rule-based on deck state)
  - [ ] Render as clickable chips below the assistant message
- [ ] Async mutation confirmation — Y/N approval before applying mutations
  - [ ] Show mutation preview (what will be added/changed) with Accept / Reject controls
  - [ ] Only apply mutations on user approval
  - [ ] Option to toggle auto-apply for power users
- [ ] Write design spec for these features under `docs/superpowers/specs/`

## Undo / Redo Hardening
- [ ] Group/coalesce rapid mutations (typing, quick slider changes) into a single history entry
- [ ] Ensure reverse mutations exist for all actions (slides, blocks, steps, theme, metadata, split ratio)
- [ ] Preserve redo branch only when appropriate; clear on new divergent edits
- [ ] Add unit tests for history push/pop, grouped mutations, and failure paths

## Accessibility
- [ ] Replace ad-hoc popovers/dialogs with an ARIA-compliant pattern
- [ ] Remove `a11y_*` suppressions across components and add axe checks in CI
- [ ] Ensure all canvas controls are keyboard navigable (module move, delete, step select)

## Export/Preview Consistency
- [x] Unify artifact sizing across editor/preview/export
- [ ] View mode WYSIWYG: render via iframe srcdoc using FRAMEWORK_CSS_PREVIEW + client-side renderSlideHtml
- [ ] Integration test: unzip export and assert artifact files + iframe src references

## Testing
- [ ] Unit: ZoneDrop reorder → `reorderBlocks` mapping (including keyboard path)
- [ ] Unit: History store coalescing and redo branch behavior
- [ ] E2E: drag from Resources to canvas creates expected module
- [ ] E2E: chat can add a slide, add module, and set fields end-to-end

## Security
- [ ] Re-verify CSP in artifact HTML when user-provided `rawSource` is injected
- [ ] Keep iframe sandbox minimal; consider `allow-same-origin` only when required and safe

## Repo Cleanup
- [ ] Remove stray files from root (conversation transcripts, debug screenshots, scratch docs)
- [ ] Add `test-results/` to .gitignore
