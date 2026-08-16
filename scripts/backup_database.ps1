# Sauvegarde locale MULTICOM (copie hors ligne administrateur)
# Usage : $env:NEON_DATABASE_URL = '...'; .\scripts\backup_database.ps1
# Ne jamais committer les fichiers générés.

$ErrorActionPreference = 'Stop'

$dbUrl = $env:NEON_DATABASE_URL
if (-not $dbUrl -and (Test-Path '.env')) {
  Get-Content '.env' | ForEach-Object {
    if ($_ -match '^(?:NEON_)?DATABASE_URL=(.*)$') {
      $dbUrl = $matches[1].Trim()
    }
  }
}

if (-not $dbUrl) {
  Write-Error 'Définissez NEON_DATABASE_URL ou DATABASE_URL.'
}

$timestamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd_HHmmss')
$outDir = if ($env:BACKUP_OUTPUT_DIR) { $env:BACKUP_OUTPUT_DIR } else { '.\backups\local' }
$sqlFile = Join-Path $outDir "backup_multicom_$timestamp.sql"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  Write-Error 'pg_dump introuvable. Installez le client PostgreSQL.'
}

& pg_dump $dbUrl --no-owner --no-acl --format=plain --file=$sqlFile
if ($LASTEXITCODE -ne 0) { throw 'pg_dump a échoué.' }

$gzFile = "$sqlFile.gz"
if (Get-Command gzip -ErrorAction SilentlyContinue) {
  & gzip -9 $sqlFile
} else {
  throw 'gzip introuvable. Installez gzip ou utilisez WSL.'
}

if ((Get-Item $gzFile).Length -lt 200) {
  throw 'Backup trop petit ou invalide.'
}

Write-Output "Backup local créé : $gzFile"
Write-Output 'Conservez ce fichier hors ligne, hors dépôt Git, sur un support distinct de Neon.'
