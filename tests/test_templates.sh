#!/usr/bin/env bash
# =============================================================================
# slide-maker / tests / test_templates.sh
# Validates seed template JSON files for schema compliance.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0; FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

VALID_LAYOUTS="title-slide layout-split layout-content layout-grid layout-full-dark layout-divider closing-slide"
VALID_MODULES="heading text card label tip-box prompt-block image carousel comparison card-grid flow stream-list"
VALID_ZONES="content stage main hero"

echo "═══════════════════════════════════════════════"
echo "  SEED TEMPLATES"
echo "═══════════════════════════════════════════════"
echo ""

TEMPLATES=$(find templates -name '*.json' | sort)
COUNT=0

for tmpl in $TEMPLATES; do
  COUNT=$((COUNT + 1))
  name=$(basename "$tmpl" .json)
  dir=$(basename "$(dirname "$tmpl")")
  label="$dir/$name"
  
  # Valid JSON
  if ! python3 -c "import json; json.load(open('$tmpl'))" 2>/dev/null; then
    fail "$label: invalid JSON"
    continue
  fi
  pass "$label: valid JSON"
  
  # Has required fields
  has_name=$(python3 -c "import json; d=json.load(open('$tmpl')); print('name' in d)")
  has_layout=$(python3 -c "import json; d=json.load(open('$tmpl')); print('layout' in d)")
  has_modules=$(python3 -c "import json; d=json.load(open('$tmpl')); print('modules' in d)")
  
  [ "$has_name" = "True" ] && pass "$label: has name" || fail "$label: missing name"
  [ "$has_layout" = "True" ] && pass "$label: has layout" || fail "$label: missing layout"
  [ "$has_modules" = "True" ] && pass "$label: has modules" || fail "$label: missing modules"
  
  # Layout is valid
  layout=$(python3 -c "import json; print(json.load(open('$tmpl')).get('layout',''))")
  if echo "$VALID_LAYOUTS" | grep -qw "$layout"; then
    pass "$label: layout '$layout' is valid"
  else
    fail "$label: layout '$layout' not in valid set"
  fi
  
  # Modules have valid types and zones
  python3 -c "
import json, sys
d = json.load(open('$tmpl'))
mods = d.get('modules', [])
valid_types = set('$VALID_MODULES'.split())
valid_zones = set('$VALID_ZONES'.split())
errors = []
for i, m in enumerate(mods):
    if m.get('type') not in valid_types:
        errors.append(f'module {i}: invalid type \"{m.get(\"type\")}\"')
    if m.get('zone') not in valid_zones:
        errors.append(f'module {i}: invalid zone \"{m.get(\"zone\")}\"')
    if 'data' not in m:
        errors.append(f'module {i}: missing data')
for e in errors:
    print(e)
sys.exit(1 if errors else 0)
" 2>/dev/null
  if [ $? -eq 0 ]; then
    pass "$label: all modules valid (types, zones, data)"
  else
    fail "$label: module validation errors"
    python3 -c "
import json, sys
d = json.load(open('$tmpl'))
mods = d.get('modules', [])
valid_types = set('$VALID_MODULES'.split())
valid_zones = set('$VALID_ZONES'.split())
for i, m in enumerate(mods):
    if m.get('type') not in valid_types:
        print(f'    module {i}: invalid type \"{m.get(\"type\")}\"')
    if m.get('zone') not in valid_zones:
        print(f'    module {i}: invalid zone \"{m.get(\"zone\")}\"')
" 2>/dev/null
  fi
done

echo ""
echo "── Coverage ──"
echo "  $COUNT templates checked"

# Check layout coverage
for layout in $VALID_LAYOUTS; do
  if find templates -name '*.json' -exec grep -l "\"layout\": \"$layout\"" {} + >/dev/null 2>&1; then
    pass "template exists for layout: $layout"
  else
    fail "no template for layout: $layout"
  fi
done

echo ""
echo "═══════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  Results: $PASS/$TOTAL passed, $FAIL failed"
echo "═══════════════════════════════════════════════"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
