#!/bin/bash
# Reveal: Build → Verify → Commit → Push
# Usage: bash scripts/ship.sh "commit message"
set -e

MSG="${1:?Usage: ship.sh \"commit message\"}"
cd "$(dirname "$0")/../app"

echo "🔨 Building..."
npm run build

echo "✅ Build green"
cd ..
git add -A
git commit -m "$MSG"
git push

echo "🚀 Shipped: $MSG"
