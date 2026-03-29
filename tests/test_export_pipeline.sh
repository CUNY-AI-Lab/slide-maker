#!/usr/bin/env bash
# =============================================================================
# slide-maker / tests / test_export_pipeline.sh
# Validates the HTML export pipeline: CSS framework, navigation JS, renderers.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0; FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }
check() { if eval "$2" >/dev/null 2>&1; then pass "$1"; else fail "$1"; fi }

CSS="apps/api/src/export/framework-css.ts"
NAV="apps/api/src/export/navigation.ts"
CAR="apps/api/src/export/carousel.ts"
REN="apps/api/src/export/html-renderer.ts"
IDX="apps/api/src/export/index.ts"

echo "═══════════════════════════════════════════════"
echo "  EXPORT PIPELINE"
echo "═══════════════════════════════════════════════"
echo ""

# --- Framework CSS ---
echo "── Framework CSS ──"
check "exports FRAMEWORK_CSS const" "grep -q 'export const FRAMEWORK_CSS' '$CSS'"
check "has :root custom properties" "grep -q ':root' '$CSS'"
check "defines --accent-cyan" "grep -q '\-\-accent-cyan' '$CSS'"
check "defines --accent-blue" "grep -q '\-\-accent-blue' '$CSS'"
check "defines --bg-light" "grep -q '\-\-bg-light' '$CSS'"
check "has .slide base class" "grep -q '\.slide' '$CSS'"
check "has .slide.active" "grep -q '\.slide\.active\|slide.active' '$CSS'"
check "has .title-slide layout" "grep -q '\.title-slide' '$CSS'"
check "has .layout-split" "grep -q '\.layout-split' '$CSS'"
check "has .layout-content" "grep -q '\.layout-content' '$CSS'"
check "has .layout-grid" "grep -q '\.layout-grid' '$CSS'"
check "has .layout-full-dark" "grep -q '\.layout-full-dark' '$CSS'"
check "has .layout-divider" "grep -q '\.layout-divider' '$CSS'"
check "has .closing-slide" "grep -q '\.closing-slide' '$CSS'"
check "has .card component" "grep -q '\.card' '$CSS'"
check "has .tip-box component" "grep -q '\.tip-box' '$CSS'"
check "has .prompt-block component" "grep -q '\.prompt-block' '$CSS'"
check "has .step-hidden class" "grep -q '\.step-hidden\|step-hidden' '$CSS'"
check "has .sr-only utility" "grep -q '\.sr-only\|sr-only' '$CSS'"
check "has .skip-link" "grep -q '\.skip-link\|skip-link' '$CSS'"
check "has focus-visible styles" "grep -q 'focus-visible' '$CSS'"
check "has responsive media queries" "grep -q '@media' '$CSS'"
check "has clamp() for typography" "grep -q 'clamp' '$CSS'"

echo ""

# --- Navigation JS ---
echo "── Navigation JS ──"
check "exports NAVIGATION_JS const" "grep -q 'export const NAVIGATION_JS' '$NAV'"
check "queries .slide elements" "grep -q 'querySelectorAll' '$NAV'"
check "handles keyboard (ArrowRight)" "grep -q 'ArrowRight' '$NAV'"
check "handles keyboard (ArrowLeft)" "grep -q 'ArrowLeft' '$NAV'"
check "handles keyboard (Escape)" "grep -q 'Escape' '$NAV'"
check "handles keyboard (Space)" "grep -q \"' '\" '$NAV'"
check "handles keyboard (Home)" "grep -q 'Home' '$NAV'"
check "handles keyboard (End)" "grep -q 'End' '$NAV'"
check "touch/swipe support" "grep -q 'touchstart\|pointerdown' '$NAV'"
check "hash routing" "grep -q 'location.hash\|hashchange' '$NAV'"
check "step reveal logic" "grep -q 'step-hidden\|data-step' '$NAV'"
check "announcer for screen readers" "grep -q 'announcer\|aria-live' '$NAV'"
check "slide counter update" "grep -q 'counter\|slide-counter' '$NAV'"
check "scrubber integration" "grep -q 'scrubber' '$NAV'"
check "overview mode" "grep -q 'overview\|Overview' '$NAV'"

echo ""

# --- Carousel JS ---
echo "── Carousel JS ──"
check "exports CAROUSEL_JS const" "grep -q 'export const CAROUSEL_JS' '$CAR'"
check "carousel init logic" "grep -q 'carousel\|Carousel' '$CAR'"
check "dot navigation" "grep -q 'dot\|indicator' '$CAR'"

echo ""

# --- HTML Renderer ---
echo "── HTML Renderer ──"
check "escape function (XSS protection)" "grep -q 'function esc\|&amp;\|&lt;' '$REN'"
check "imports NAVIGATION_JS" "grep -q 'NAVIGATION_JS' '$REN'"
check "imports CAROUSEL_JS" "grep -q 'CAROUSEL_JS' '$REN'"
check "renders heading module" "grep -q \"case 'heading'\" '$REN'"
check "renders text module" "grep -q \"case 'text'\" '$REN'"
check "renders card module" "grep -q \"case 'card'\" '$REN'"
check "renders label module" "grep -q \"case 'label'\" '$REN'"
check "renders tip-box module" "grep -q \"case 'tip-box'\" '$REN'"
check "renders prompt-block module" "grep -q \"case 'prompt-block'\" '$REN'"
check "renders image module" "grep -q \"case 'image'\" '$REN'"
check "renders carousel module" "grep -q \"case 'carousel'\" '$REN'"
check "renders comparison module" "grep -q \"case 'comparison'\" '$REN'"
check "renders card-grid module" "grep -q \"case 'card-grid'\" '$REN'"
check "renders flow module" "grep -q \"case 'flow'\" '$REN'"
check "renders stream-list module" "grep -q \"case 'stream-list'\" '$REN'"
check "step-hidden support in renderer" "grep -q 'step-hidden\|stepOrder\|step_order' '$REN'"
check "file URL rewriting for export" "grep -q 'rewriteSrc\|assets/' '$REN'"
check "ARIA attributes in output" "grep -q 'aria-\|role=' '$REN'"
check "skip-link in output" "grep -q 'skip-link\|Skip' '$REN'"
check "live region in output" "grep -q 'aria-live\|announcer' '$REN'"

echo ""

# --- Export Index ---
echo "── Export Index ──"
check "export index exists" "[ -f '$IDX' ]"
check "imports html-renderer" "grep -q 'html-renderer' '$IDX'"

echo ""
echo "═══════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  Results: $PASS/$TOTAL passed, $FAIL failed"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
