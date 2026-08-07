#!/usr/bin/env bash
# =============================================================================
# slide-maker / tests / test_module_registry.sh
# Validates the shared module registry and its use in the editor picker.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0; FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }
check() { if eval "$2" >/dev/null 2>&1; then pass "$1"; else fail "$1"; fi; }

REG="packages/shared/src/module-registry.ts"
PICKER="apps/web/src/lib/components/outline/ModulePicker.svelte"
ARTIFACTS="apps/web/src/lib/components/resources/ArtifactsTab.svelte"

echo "═══════════════════════════════════════════════"
echo "  MODULE REGISTRY"
echo "═══════════════════════════════════════════════"
echo ""

echo "── Shared Registry ──"
check "module-registry.ts exists" "[ -f '$REG' ]"
check "exports MODULE_REGISTRY_LIST" "grep -q 'export const MODULE_REGISTRY_LIST' '$REG'"
check "exports MODULE_REGISTRY" "grep -q 'export const MODULE_REGISTRY' '$REG'"
check "exports createModuleData" "grep -q 'export function createModuleData' '$REG'"
check "exports getModuleRegistryEntry" "grep -q 'export function getModuleRegistryEntry' '$REG'"
check "has registry factory model" "grep -q 'interface ModuleRegistryFactory' '$REG'"
check "artifact module remains resource-backed" "! grep -Fq \"type: 'artifact'\" '$REG' && grep -Fq 'ensureArtifactsLoaded' '$ARTIFACTS'"
check "text module default uses markdown" "grep -q \"markdown: ''\" '$REG'"
check "comparison module default uses panels" "grep -q 'panels' '$REG'"
check "flow module default uses nodes" "grep -q 'nodes' '$REG'"

echo ""
echo "── Picker Integration ──"
check "picker imports MODULE_REGISTRY_LIST" "grep -q 'MODULE_REGISTRY_LIST' '$PICKER'"
check "picker imports createModuleData" "grep -q 'createModuleData' '$PICKER'"
check "picker uses shared registry list" "grep -q 'const moduleTypes = MODULE_REGISTRY_LIST' '$PICKER'"
check "picker uses shared factory defaults" "grep -q 'createModuleData(type)' '$PICKER'"

echo ""
echo "═══════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  Results: $PASS/$TOTAL passed, $FAIL failed"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
