#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config.sh
source "$script_dir/config.sh"

repo_path="${WINDOWS_REPO_PATH//\\//}"
ssh_target="${WINDOWS_SSH_USER}@${WINDOWS_SSH_HOST}"

echo "Connecting to ${ssh_target} (${repo_path})..."
exec ssh -p "$WINDOWS_SSH_PORT" -t "$ssh_target" \
	"powershell -NoProfile -NoExit -Command \"Set-Location '${repo_path}'\""
