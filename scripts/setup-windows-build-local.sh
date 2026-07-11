#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
local_dir="$repo_root/scripts/windows-build.local"
example_dir="$repo_root/scripts/windows-build.local.example"

if [[ -d "$local_dir" ]]; then
	echo "Already exists: $local_dir"
	echo "Edit config.sh there, or remove the folder and run setup again."
	exit 0
fi

cp -R "$example_dir" "$local_dir"
chmod +x "$local_dir"/*.sh

echo "Created $local_dir"
echo "Edit scripts/windows-build.local/config.sh with your Windows SSH details."
echo ""
echo "Then run:"
echo "  pnpm run desktop:windows:connect   # open SSH session in repo folder"
echo "  pnpm run desktop:windows:build       # remote build only (no GitHub publish)"
echo "  pnpm run desktop:windows:release     # build + publish to GitHub"
