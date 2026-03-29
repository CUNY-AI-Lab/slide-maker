#!/usr/bin/env bash
# =============================================================================
# slide-maker / tests / test_structure.sh
# Validates monorepo structure, file inventory, and workspace wiring.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0; FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }
check() { if eval "$2" >/dev/null 2>&1; then pass "$1"; else fail "$1"; fi }

echo "═══════════════════════════════════════════════"
echo "  MONOREPO STRUCTURE"
echo "═══════════════════════════════════════════════"
echo ""

echo "── Workspace Root ──"
check "package.json exists" '[ -f package.json ]'
check "pnpm-workspace.yaml exists" '[ -f pnpm-workspace.yaml ]'
check "turbo.json exists" '[ -f turbo.json ]'
check "CLAUDE.md exists" '[ -f CLAUDE.md ]'
check ".env.example exists" '[ -f .env.example ]'
check ".gitignore exists" '[ -f .gitignore ]'

echo ""
echo "── apps/web (SvelteKit frontend) ──"
check "apps/web/package.json" '[ -f apps/web/package.json ]'
check "apps/web/svelte.config.js" '[ -f apps/web/svelte.config.js ]'
check "apps/web/vite.config.ts" '[ -f apps/web/vite.config.ts ]'
check "apps/web/src/app.html" '[ -f apps/web/src/app.html ]'
check "apps/web/src/app.css" '[ -f apps/web/src/app.css ]'
check "apps/web/src/routes layout" '[ -f apps/web/src/routes/+layout.svelte ]'
check "apps/web/src/routes/(app) layout" '[ -f "apps/web/src/routes/(app)/+layout.svelte" ]'
check "deck editor page" '[ -f "apps/web/src/routes/(app)/deck/[id]/+page.svelte" ]'
check "login page" '[ -f apps/web/src/routes/login/+page.svelte ]'
check "register page" '[ -f apps/web/src/routes/register/+page.svelte ]'

echo ""
echo "── apps/api (Hono backend) ──"
check "apps/api/package.json" '[ -f apps/api/package.json ]'
check "apps/api/src/index.ts" '[ -f apps/api/src/index.ts ]'
check "apps/api/src/db/schema.ts" '[ -f apps/api/src/db/schema.ts ]'
check "apps/api/src/db/seed.ts" '[ -f apps/api/src/db/seed.ts ]'
check "apps/api/src/prompts/system.ts" '[ -f apps/api/src/prompts/system.ts ]'
check "apps/api/drizzle.config.ts" '[ -f apps/api/drizzle.config.ts ]'

echo ""
echo "── apps/api routes ──"
for route in auth chat decks export files providers resources sharing admin; do
  check "route: $route.ts" "[ -f apps/api/src/routes/${route}.ts ]"
done

echo ""
echo "── apps/api middleware ──"
check "auth middleware" '[ -f apps/api/src/middleware/auth.ts ]'
check "admin middleware" '[ -f apps/api/src/middleware/admin.ts ]'

echo ""
echo "── apps/api providers ──"
check "anthropic provider" '[ -f apps/api/src/providers/anthropic.ts ]'
check "openrouter provider" '[ -f apps/api/src/providers/openrouter.ts ]'
check "provider index" '[ -f apps/api/src/providers/index.ts ]'

echo ""
echo "── apps/api export modules ─��"
check "html-renderer.ts" '[ -f apps/api/src/export/html-renderer.ts ]'
check "framework-css.ts" '[ -f apps/api/src/export/framework-css.ts ]'
check "navigation.ts" '[ -f apps/api/src/export/navigation.ts ]'
check "carousel.ts" '[ -f apps/api/src/export/carousel.ts ]'
check "export index.ts" '[ -f apps/api/src/export/index.ts ]'

echo ""
echo "── packages/shared ──"
check "packages/shared/package.json" '[ -f packages/shared/package.json ]'
check "block-types.ts" '[ -f packages/shared/src/block-types.ts ]'
check "mutations.ts" '[ -f packages/shared/src/mutations.ts ]'
check "types.ts" '[ -f packages/shared/src/types.ts ]'
check "validation.ts" '[ -f packages/shared/src/validation.ts ]'
check "index.ts" '[ -f packages/shared/src/index.ts ]'

echo ""
echo "── Svelte components (renderers) ──"
for comp in ModuleRenderer HeadingModule TextModule CardModule LabelModule TipBoxModule \
  PromptBlockModule ImageModule CarouselModule ComparisonModule CardGridModule FlowModule StreamListModule; do
  check "renderer: $comp" "[ -f apps/web/src/lib/components/renderers/${comp}.svelte ]"
done

echo ""
echo "── Svelte components (canvas) ──"
for comp in SlideCanvas SlideRenderer CanvasToolbar FormatToolbar SplitHandle ZoneDrop; do
  check "canvas: $comp" "[ -f apps/web/src/lib/components/canvas/${comp}.svelte ]"
done

echo ""
echo "── Svelte components (outline) ──"
for comp in SlideOutline SlideCard BlockItem AddSlideMenu ModulePicker; do
  check "outline: $comp" "[ -f apps/web/src/lib/components/outline/${comp}.svelte ]"
done

echo ""
echo "── Svelte components (chat) ──"
for comp in ChatPanel ChatInput ChatMessage ModelSelector; do
  check "chat: $comp" "[ -f apps/web/src/lib/components/chat/${comp}.svelte ]"
done

echo ""
echo "── Svelte stores ──"
for store in deck chat ui auth; do
  check "store: $store.ts" "[ -f apps/web/src/lib/stores/${store}.ts ]"
done
check "api.ts utility" '[ -f apps/web/src/lib/api.ts ]'

echo ""
echo "── Templates (seed data) ──"
TEMPLATE_COUNT=$(find templates -name '*.json' 2>/dev/null | wc -l)
check "has seed templates (>= 10)" '[ "$TEMPLATE_COUNT" -ge 10 ]'
echo "  (found $TEMPLATE_COUNT template files)"

echo ""
echo "── Deployment ──"
check "nginx config" '[ -f nginx/slide-maker.conf ]'
check "deploy script" '[ -f deploy-staging.sh ]'
check "GitHub Actions workflow" '[ -f .github/workflows/deploy.yml ]'

echo ""
echo "═══════════════════════════════════════════��═══"
TOTAL=$((PASS + FAIL))
echo "  Results: $PASS/$TOTAL passed, $FAIL failed"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
