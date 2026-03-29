#!/usr/bin/env bash
# =============================================================================
# slide-maker / tests / test_shared_types.sh
# Validates shared package: type definitions, block types, mutations, exports.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0; FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }
check() { if eval "$2" >/dev/null 2>&1; then pass "$1"; else fail "$1"; fi }

BT="packages/shared/src/block-types.ts"
MU="packages/shared/src/mutations.ts"
TY="packages/shared/src/types.ts"
VA="packages/shared/src/validation.ts"
IX="packages/shared/src/index.ts"

echo "═══════════════════════════════════════════════"
echo "  SHARED TYPES & BLOCK DEFINITIONS"
echo "═══════════════════════════════════════════════"
echo ""

echo "── Layouts (block-types.ts) ──"
for layout in title-slide layout-split layout-content layout-grid layout-full-dark layout-divider closing-slide; do
  check "layout: $layout" "grep -q \"'$layout'\" '$BT'"
done

echo ""
echo "── Zones (block-types.ts) ──"
for zone in content stage main hero; do
  check "zone: $zone" "grep -q \"'$zone'\" '$BT'"
done

echo ""
echo "── Layout-Zone Mapping ──"
check "LAYOUT_ZONES exported" "grep -q 'export const LAYOUT_ZONES' '$BT'"
check "title-slide maps to hero" "grep -A1 'title-slide' '$BT' | grep -q 'hero'"
check "layout-split maps to content,stage" "grep -A1 'layout-split' '$BT' | grep -q 'content'"
check "layout-content maps to main" "grep -A1 'layout-content' '$BT' | grep -q 'main'"

echo ""
echo "── Module Types (12 required) ──"
for mod in heading text card label tip-box prompt-block image carousel comparison card-grid flow stream-list; do
  check "module: $mod" "grep -q \"'$mod'\" '$BT'"
done

echo ""
echo "── Data Interfaces ──"
for iface in HeadingData TextData CardData LabelData TipBoxData PromptBlockData ImageData CarouselData ComparisonData CardGridData FlowData StreamListData; do
  check "interface: $iface" "grep -q 'export interface $iface' '$BT'"
done
check "ModuleDataMap exported" "grep -q 'ModuleDataMap' '$BT'"

echo ""
echo "── Mutation Actions (mutations.ts) ──"
for action in addSlide removeSlide updateBlock addBlock removeBlock reorderSlides reorderBlocks applyTemplate setTheme updateMetadata; do
  check "mutation: $action" "grep -q \"'$action'\" '$MU'"
done
check "AddSlidePayload exported" "grep -q 'AddSlidePayload' '$MU'"
check "StreamEvent type" "grep -q 'StreamEvent' '$MU'"

echo ""
echo "── Core Types (types.ts) ──"
for typ in Deck Slide ContentBlock Template Theme User ChatMessage DeckMetadata; do
  check "type: $typ" "grep -q 'export interface $typ' '$TY'"
done
check "UserStatus type" "grep -q 'UserStatus' '$TY'"
check "UserRole type" "grep -q 'UserRole' '$TY'"

echo ""
echo "── Exports (index.ts) ──"
check "re-exports block-types" "grep -q 'block-types' '$IX'"
check "re-exports mutations" "grep -q 'mutations' '$IX'"
check "re-exports types" "grep -q 'types' '$IX'"

echo ""
echo "── TypeScript Compilation ──"
if command -v pnpm >/dev/null 2>&1 && [ -d node_modules ]; then
  if pnpm exec tsc --noEmit -p packages/shared/tsconfig.json 2>&1; then
    pass "shared package compiles clean"
  else
    fail "shared package has type errors"
  fi
else
  echo "  (skipping: pnpm or node_modules not available)"
fi

echo ""
echo "═══════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  Results: $PASS/$TOTAL passed, $FAIL failed"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
