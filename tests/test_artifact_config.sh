#!/usr/bin/env bash
# =============================================================================
# slide-maker / tests / test_artifact_config.sh
# Validates artifact config resolution utility and chat draft integration.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0; FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }
check() { if eval "$2" >/dev/null 2>&1; then pass "$1"; else fail "$1"; fi; }

UTIL="apps/web/src/lib/utils/artifact-config.ts"
SHARED="packages/shared/src/artifact-registry.ts"
TAB="apps/web/src/lib/components/resources/ArtifactsTab.svelte"
INPUT="apps/web/src/lib/components/chat/ChatInput.svelte"
STORE="apps/web/src/lib/stores/chat.ts"
TEST="tests/artifact-config.test.ts"

echo "═══════════════════════════════════════════════"
echo "  ARTIFACT CONFIG UTILITY"
echo "═══════════════════════════════════════════════"
echo ""

echo "── Utility Module ──"
check "artifact-config.ts exists" "[ -f '$UTIL' ]"
check "getResolvedConfig exported" "grep -q 'export function getResolvedConfig' '$UTIL'"
check "buildAtRef exported" "grep -q 'export function buildAtRef' '$UTIL'"
check "buildArtifactBlockData exported" "grep -q 'export function buildArtifactBlockData' '$UTIL'"
check "ArtifactConfigField type exported" "grep -q 'export interface ArtifactConfigField' '$UTIL'"
check "ArtifactRef type exported" "grep -q 'export interface ArtifactRef' '$UTIL'"
check "shared buildAtRef includes @artifact: prefix" "grep -q '@artifact:' '$SHARED'"
check "shared buildAtRef includes json fenced block" "grep -q 'json' '$SHARED'"
check "shared registry resolves config" "grep -q 'export function getResolvedConfig' '$SHARED'"
check "shared registry resolves factory" "grep -q 'export function resolveArtifactFactory' '$SHARED'"

echo ""
echo "── ArtifactsTab Integration ──"
check "imports getResolvedConfig" "grep -q 'getResolvedConfig' '$TAB'"
check "imports chatDraft store" "grep -q 'chatDraft' '$TAB'"
check "copyConfig uses getResolvedConfig" "grep -q 'getResolvedConfig' '$TAB'"
check "injectAtRef uses canonical artifact token" "grep -Fq 'chatDraft.set' '$TAB' && grep -Fq '@artifact:' '$TAB'"
check "artifact insert uses canonical reference builder" "grep -q 'buildArtifactReferenceData' '$TAB'"
check "artifact insert preserves registryId" "grep -q 'registryId: artifact.id' '$TAB'"
check "clipboard copy button exists" "grep -q 'copyConfig' '$TAB'"
check "@ inject button exists" "grep -q 'injectAtRef' '$TAB'"

echo ""
echo "── Chat Draft Store ──"
check "chatDraft exported from store" "grep -q 'export const chatDraft' '$STORE'"
check "chatDraft is a writable" "grep -q 'writable' '$STORE'"

echo ""
echo "── ChatInput Integration ──"
check "imports chatDraft" "grep -q 'chatDraft' '$INPUT'"
check "consumes chatDraft in effect" "grep -q 'chatDraft' '$INPUT'"
check "focuses rich editor after draft" "grep -Fq 'richEditor?.focus()' '$INPUT'"

echo ""
echo "── Vitest Unit Tests ──"
check "test file exists" "[ -f '$TEST' ]"
check "tests getResolvedConfig flat config" "grep -q 'flat config' '$TEST'"
check "tests getResolvedConfig schema config" "grep -q 'schema config' '$TEST'"
check "tests getResolvedConfig null config" "grep -q 'null config' '$TEST'"
check "tests buildAtRef output format" "grep -q '@artifact:' '$TEST'"
check "tests buildAtRef payload parsing" "grep -q 'JSON.parse' '$TEST'"
check "tests buildArtifactBlockData coverage" "grep -q 'buildArtifactBlockData' '$TEST'"

echo ""
echo "── Vitest Run ──"
if command -v corepack >/dev/null 2>&1 && [ -d node_modules ]; then
  if corepack pnpm vitest run tests/artifact-config.test.ts 2>&1; then
    pass "vitest unit tests pass"
  else
    fail "vitest unit tests failed"
  fi
else
  echo "  (skipping: corepack or node_modules not available)"
fi

echo ""
echo "═══════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  Results: $PASS/$TOTAL passed, $FAIL failed"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
