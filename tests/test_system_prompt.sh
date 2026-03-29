#!/usr/bin/env bash
# =============================================================================
# slide-maker / tests / test_system_prompt.sh
# Validates the AI system prompt builder covers all module types, layouts,
# mutations, and follows the documented conventions.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0; FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }
check() { if eval "$2" >/dev/null 2>&1; then pass "$1"; else fail "$1"; fi }

SYS="apps/api/src/prompts/system.ts"

echo "═══════════════════════════════════════════════"
echo "  SYSTEM PROMPT BUILDER"
echo "═══════════════════════════════════════════════"
echo ""

echo "── Function Signature ──"
check "exports buildSystemPrompt" "grep -q 'export function buildSystemPrompt' '$SYS'"
check "accepts deck parameter" "grep -q 'deck:' '$SYS'"
check "accepts activeSlideId" "grep -q 'activeSlideId' '$SYS'"
check "accepts templates" "grep -q 'templates' '$SYS'"
check "accepts theme" "grep -q 'theme' '$SYS'"
check "accepts files (uploads)" "grep -q 'files' '$SYS'"

echo ""
echo "── Layout Documentation ──"
for layout in title-slide layout-split layout-content layout-grid layout-full-dark layout-divider closing-slide; do
  check "documents layout: $layout" "grep -q '$layout' '$SYS'"
done

echo ""
echo "── Module Documentation ──"
for mod in heading text card label tip-box prompt-block image carousel comparison card-grid flow stream-list; do
  check "documents module: $mod" "grep -q '$mod' '$SYS'"
done

echo ""
echo "── Zone Documentation ──"
for zone in content stage main hero; do
  check "documents zone: $zone" "grep -q '\"$zone\"' '$SYS'"
done

echo ""
echo "── Mutation Actions Documented ──"
for action in addSlide removeSlide updateBlock addBlock removeBlock reorderSlides setTheme updateMetadata; do
  check "mutation: $action" "grep -q '$action' '$SYS'"
done

echo ""
echo "── Key Guidelines ──"
check "warns against inventing module types" "grep -qi 'do not invent\|ONLY.*12 module\|only the.*module' '$SYS'"
check "zone field required" "grep -qi 'zone.*field\|MUST.*zone\|every module.*zone' '$SYS'"
check "layout-split zone rules" "grep -q 'content.*left\|stage.*right' '$SYS'"
check "step reveal documented" "grep -q 'stepOrder\|step_order\|progressive' '$SYS'"
check "carousel sync documented" "grep -q 'syncSteps\|sync' '$SYS'"
check "active slide marker" "grep -q 'ACTIVE' '$SYS'"
check "file URL usage documented" "grep -qi 'uploaded.*file\|file.*url\|EXACT url' '$SYS'"
check "conversational text alongside mutations" "grep -qi 'conversational\|alongside\|Never respond with only mutation' '$SYS'"

echo ""
echo "── Dynamic State Injection ──"
check "injects deck name" "grep -q 'deck.name' '$SYS'"
check "injects slide count" "grep -q 'deck.slides.length' '$SYS'"
check "injects slides summary" "grep -q 'slidesSummary' '$SYS'"
check "injects templates list" "grep -q 'templatesList' '$SYS'"
check "injects theme info" "grep -q 'themeInfo' '$SYS'"
check "injects uploaded files" "grep -q 'files' '$SYS'"

echo ""
echo "═══════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  Results: $PASS/$TOTAL passed, $FAIL failed"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
