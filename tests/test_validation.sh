#!/usr/bin/env bash
# =============================================================================
# slide-maker / tests / test_validation.sh
# Validates the shared validation module: zone validation, module type checks,
# slide count guards, email validation.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0; FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }
check() { if eval "$2" >/dev/null 2>&1; then pass "$1"; else fail "$1"; fi; }

VA="packages/shared/src/validation.ts"

echo "═══════════════════════════════════════════════"
echo "  VALIDATION MODULE"
echo "═══════════════════════════════════════════════"
echo ""

echo "── Email Validation ──"
check "isValidCunyEmail exported" "grep -q 'export function isValidCunyEmail' '$VA'"
check "CUNY email regex defined" "grep -q 'cuny' '$VA'"

echo ""
echo "── Module Type Validation ──"
check "isValidModuleType exported" "grep -q 'export function isValidModuleType' '$VA'"
check "checks against MODULE_TYPES" "grep -q 'MODULE_TYPES' '$VA'"

echo ""
echo "── Zone Validation ──"
check "isValidZoneForLayout exported" "grep -q 'export function isValidZoneForLayout' '$VA'"
check "uses LAYOUT_ZONES lookup" "grep -q 'LAYOUT_ZONES' '$VA'"

echo ""
echo "── Module Placement Validation ──"
check "validateModulePlacement exported" "grep -q 'export function validateModulePlacement' '$VA'"
check "returns ValidationError array" "grep -q 'ValidationError' '$VA'"
check "validates type field" "grep -q \"field: 'type'\" '$VA'"
check "validates zone field" "grep -q \"field: 'zone'\" '$VA'"
check "validates layout field" "grep -q \"field: 'layout'\" '$VA'"
check "error messages include valid options" "grep -q 'Valid types\|Valid zones' '$VA'"

echo ""
echo "── Slide Count Guard ──"
check "MAX_SLIDES_PER_DECK constant" "grep -q 'MAX_SLIDES_PER_DECK' '$VA'"
check "isSlideCountWithinLimit exported" "grep -q 'export function isSlideCountWithinLimit' '$VA'"
check "limit is reasonable (>= 20)" "grep -q 'MAX_SLIDES_PER_DECK = [2-9][0-9]' '$VA' || grep -q 'MAX_SLIDES_PER_DECK = [1-9][0-9][0-9]' '$VA'"

echo ""
echo "── Imports ──"
check "imports LAYOUT_ZONES" "grep -q \"import.*LAYOUT_ZONES.*from.*block-types\" '$VA'"
check "imports MODULE_TYPES" "grep -q \"import.*MODULE_TYPES.*from.*block-types\" '$VA' || grep -q 'MODULE_TYPES' '$VA'"

echo ""
echo "── TypeScript Compilation ──"
if command -v pnpm >/dev/null 2>&1 && [ -d node_modules ]; then
  if pnpm exec tsc --noEmit -p packages/shared/tsconfig.json 2>&1; then
    pass "shared package still compiles clean with new validators"
  else
    fail "type errors after adding validation"
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
