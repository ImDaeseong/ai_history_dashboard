# Regenerates index.html from local logs and, if anything changed,
# commits and pushes to origin/main (GitHub Pages redeploys automatically).
#
# Run manually:   powershell -File scripts\regenerate.ps1
# Or from Task Scheduler (see README.md "자동 갱신" section for setup).

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

node scripts/regenerate.js
if ($LASTEXITCODE -ne 0) {
    Write-Error "regenerate.js failed, aborting (no commit)."
    exit 1
}

git add index.html
$diff = git diff --cached --stat
if ([string]::IsNullOrWhiteSpace($diff)) {
    Write-Host "No changes since last run — nothing to commit."
    exit 0
}

git commit -m "Auto-update dashboard data ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
git push origin main
Write-Host "Committed and pushed."
