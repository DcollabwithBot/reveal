#!/bin/bash
# Reveal: Tech debt audit scan
# Usage: bash scripts/audit.sh
cd "$(dirname "$0")/../app/src"

echo "=== DIRECT SUPABASE IMPORTS (should use helpers) ==="
grep -rl "import.*supabase.*from" screens/ components/ --include="*.jsx" 2>/dev/null | wc -l
echo "files"

echo ""
echo "=== EMPTY CATCH BLOCKS ==="
grep -rn "catch.*{}" screens/ components/ --include="*.jsx" --include="*.js" 2>/dev/null | grep -v "handleError\|handleSoftError\|console" | wc -l
echo "occurrences"

echo ""
echo "=== NPC_TEAM USAGE (should be fallback only) ==="
grep -rn "NPC_TEAM" screens/ --include="*.jsx" 2>/dev/null | grep -v "import\|fallback\|Fallback\|NPC_DEFS\|getDisplaySprites\|OnboardingWalkthrough" | wc -l
echo "non-fallback usages"

echo ""
echo "=== FILES OVER 500 LINES ==="
wc -l screens/*.jsx screens/*/*.jsx components/*.jsx 2>/dev/null | sort -rn | awk '$1 > 500 {print}'

echo ""
echo "=== INLINE STYLE COUNT (top 10 files) ==="
grep -c "style={{" screens/*.jsx screens/*/*.jsx components/*.jsx 2>/dev/null | sort -t: -k2 -rn | head -10

echo ""
echo "=== HARDCODED DATA PATTERNS ==="
grep -rn "\"Mia\"\|\"Jonas\"\|\"Sara\"\|\"Emil\"\|1240\|\"Platform Team\"\|\"Kunde X\"" screens/ components/ --include="*.jsx" 2>/dev/null | grep -v DemoScreen | wc -l
echo "hardcoded references"
