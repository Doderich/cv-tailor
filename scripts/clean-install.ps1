$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

Write-Host "Cleaning CV Tailor dependencies in $repoRoot"

Write-Host "Stopping node processes that may lock files..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

function Remove-Tree([string]$Path) {
	if (-not (Test-Path -LiteralPath $Path)) {
		return
	}

	Write-Host "Removing $Path"
	Remove-Item -LiteralPath $Path -Recurse -Force
}

Remove-Tree (Join-Path $repoRoot "node_modules")

Get-ChildItem -Path $repoRoot -Directory -Recurse -Filter node_modules -Force |
	Where-Object { $_.FullName -ne (Join-Path $repoRoot "node_modules") } |
	ForEach-Object {
		Remove-Tree $_.FullName
	}

Write-Host "Pruning pnpm store..."
pnpm store prune

Write-Host "Reinstalling dependencies..."
pnpm install

Write-Host "Done."
