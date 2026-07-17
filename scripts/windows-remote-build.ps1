param(
	[string]$RepoPath = "",

	[string]$SigningKeyPath = "$env:USERPROFILE\.tauri\cv-tailor.key"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $RepoPath) {
	$RepoPath = Resolve-Path (Join-Path $PSScriptRoot "..")
}

function Require-Path([string]$Path, [string]$Message) {
	if (-not (Test-Path -LiteralPath $Path)) {
		throw $Message
	}
}

Require-Path $RepoPath "Repository path not found: $RepoPath"
Require-Path $SigningKeyPath "Missing signing key at $SigningKeyPath. Run desktop:setup-signing on this machine."

$webRoot = Join-Path $RepoPath "apps\web"
Require-Path $webRoot "Web app directory not found: $webRoot"

$env:CI = "true"
$env:TAURI_SIGNING_PRIVATE_KEY = $SigningKeyPath

Write-Host "Installing dependencies..."
Push-Location $RepoPath
try {
	pnpm install --frozen-lockfile
}
finally {
	Pop-Location
}

Write-Host "Building Windows desktop bundle..."
Push-Location $webRoot
try {
	pnpm run desktop:build
}
finally {
	Pop-Location
}

$bundleRoot = Join-Path $RepoPath "target\release\bundle"
Require-Path $bundleRoot "Build finished but bundle directory is missing: $bundleRoot"

Write-Host "Build complete. Artifacts are in $bundleRoot"
