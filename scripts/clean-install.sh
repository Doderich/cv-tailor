#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "Cleaning CV Tailor dependencies in $repo_root"

pkill -f "node.*cv-tailor" 2>/dev/null || true

find "$repo_root" -name node_modules -type d -prune -exec rm -rf {} +

pnpm store prune
pnpm install

echo "Done."
