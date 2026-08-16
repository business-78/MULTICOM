# Restauration MULTICOM vers une base PostgreSQL de TEST uniquement
# Usage :
#   $env:TARGET_DATABASE_URL = 'postgresql://...'
#   .\scripts\restore_database.ps1 -BackupFile .\backups\local\backup_multicom_YYYY-MM-DD.sql.gz
#
# NE JAMAIS restaurer directement sur la base de production sans procédure contrôlée.

param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = 'Stop'

if (-not $env:TARGET_DATABASE_URL) {
  throw 'Définissez TARGET_DATABASE_URL (base de test uniquement).'
}

if (-not (Test-Path $BackupFile)) {
  throw "Fichier introuvable : $BackupFile"
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw 'psql introuvable. Installez le client PostgreSQL.'
}

Write-Output 'ATTENTION : restauration vers la base cible fournie.'
Write-Output "Vérifiez qu'il s'agit bien d'une base de TEST."

if ($BackupFile.EndsWith('.gz')) {
  if (-not (Get-Command gunzip -ErrorAction SilentlyContinue)) {
    throw 'gunzip introuvable.'
  }
  gunzip -c $BackupFile | psql $env:TARGET_DATABASE_URL -v ON_ERROR_STOP=1
} else {
  psql $env:TARGET_DATABASE_URL -v ON_ERROR_STOP=1 -f $BackupFile
}

psql $env:TARGET_DATABASE_URL -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) AS visitors_count FROM visitors;"
psql $env:TARGET_DATABASE_URL -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) AS settings_count FROM settings;"

Write-Output 'Restauration terminée. Vérifiez les compteurs ci-dessus.'
