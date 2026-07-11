#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"

# shellcheck source=config.sh
source "$script_dir/config.sh"

export WINDOWS_SSH_HOST WINDOWS_SSH_USER WINDOWS_SSH_PORT WINDOWS_REPO_PATH

cd "$repo_root"
exec pnpm run desktop:release:windows -- "$@"
