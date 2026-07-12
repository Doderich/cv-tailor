#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
local_config="$repo_root/scripts/windows-build.local/config.sh"

if [[ ! -f "$local_config" ]]; then
	echo "Missing $local_config"
	echo "Run: pnpm run desktop:windows:setup"
	exit 1
fi

# shellcheck source=/dev/null
source "$local_config"

identity_file="${WINDOWS_SSH_IDENTITY_FILE:-$HOME/.ssh/id_ed25519}"
public_key_file="${identity_file}.pub"
ssh_target="${WINDOWS_SSH_USER}@${WINDOWS_SSH_HOST}"

if [[ ! -f "$public_key_file" ]]; then
	echo "Missing public key: $public_key_file"
	exit 1
fi

echo "CV Tailor Windows SSH key setup"
echo "  Host: ${WINDOWS_SSH_HOST}:${WINDOWS_SSH_PORT}"
echo "  User: ${WINDOWS_SSH_USER}"
echo "  Key:  ${identity_file}"
echo ""

if ssh -p "$WINDOWS_SSH_PORT" -i "$identity_file" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 "$ssh_target" "whoami" >/dev/null 2>&1; then
	echo "SSH key auth already works. No setup needed."
	exit 0
fi

echo "Key auth is not working yet. Installing public key (one password prompt)..."
echo ""

if command -v ssh-copy-id >/dev/null 2>&1; then
	ssh-copy-id -i "$public_key_file" -p "$WINDOWS_SSH_PORT" "$ssh_target"
else
	echo "ssh-copy-id not found. Run this on your Windows PC in PowerShell instead:"
	echo ""
	cat <<EOF
\$key = @'
$(cat "$public_key_file")
'@
New-Item -ItemType Directory -Force -Path \$env:USERPROFILE\.ssh | Out-Null
Set-Content -Path \$env:USERPROFILE\.ssh\authorized_keys -Value \$key -Encoding utf8
icacls \$env:USERPROFILE\.ssh /inheritance:r /grant "\${env:USERNAME}:(F)"
icacls \$env:USERPROFILE\.ssh\authorized_keys /inheritance:r /grant "\${env:USERNAME}:(F)"
EOF
	echo ""
	echo "If your account is an Administrator, also run this in Admin PowerShell:"
	echo ""
	cat <<EOF
\$key = @'
$(cat "$public_key_file")
'@
Add-Content -Path C:\ProgramData\ssh\administrators_authorized_keys -Value \$key
icacls C:\ProgramData\ssh\administrators_authorized_keys /inheritance:r /grant "Administrators:F" /grant "SYSTEM:F"
Restart-Service sshd
EOF
	exit 1
fi

echo ""
echo "Verifying..."
ssh -p "$WINDOWS_SSH_PORT" -i "$identity_file" -o IdentitiesOnly=yes "$ssh_target" "whoami"
echo ""
echo "Done. SSH key auth works."
