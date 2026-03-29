#!/usr/bin/env bash
# =============================================================================
# slide-maker / tests / run_all.sh
# Runs all test suites in sequence and reports overall results.
# =============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

SUITES=(
  "tests/test_structure.sh"
  "tests/test_shared_types.sh"
  "tests/test_templates.sh"
  "tests/test_export_pipeline.sh"
  "tests/test_system_prompt.sh"
  "tests/test_validation.sh"
)

SUITE_PASS=0
SUITE_FAIL=0

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║       SLIDE-MAKER FULL TEST SUITE             ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

for suite in "${SUITES[@]}"; do
  echo ""
  if bash "$suite"; then
    ((SUITE_PASS++))
  else
    ((SUITE_FAIL++))
  fi
  echo ""
done

TOTAL=$((SUITE_PASS + SUITE_FAIL))
echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║  OVERALL: $SUITE_PASS/$TOTAL suites passed, $SUITE_FAIL failed"
echo "╚═══════════════════════════════════════════════╝"
echo ""
[ "$SUITE_FAIL" -eq 0 ] && exit 0 || exit 1
