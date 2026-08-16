#!/usr/bin/env bash
# Sauvegarde locale MULTICOM (copie hors ligne administrateur)
# Usage : NEON_DATABASE_URL='...' ./scripts/backup_database.sh
# Ne jamais committer les fichiers générés.

set -euo pipefail

if [ -z "${NEON_DATABASE_URL:-}" ]; then
  if [ -f ".env" ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
fi

if [ -z "${DATABASE_URL:-}" ] && [ -z "${NEON_DATABASE_URL:-}" ]; then
  echo "Erreur : définissez NEON_DATABASE_URL ou DATABASE_URL."
  exit 1
fi

DB_URL="${NEON_DATABASE_URL:-$DATABASE_URL}"
TIMESTAMP="$(date -u +%Y-%m-%d_%H%M%S)"
OUT_DIR="${BACKUP_OUTPUT_DIR:-./backups/local}"
SQL_FILE="${OUT_DIR}/backup_multicom_${TIMESTAMP}.sql"

mkdir -p "$OUT_DIR"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Erreur : pg_dump introuvable. Installez le client PostgreSQL."
  exit 1
fi

pg_dump "$DB_URL" --no-owner --no-acl --format=plain --file="$SQL_FILE"
gzip -9 "$SQL_FILE"

if ! zgrep -q "CREATE TABLE.*visitors" "${SQL_FILE}.gz"; then
  echo "Erreur : table visitors absente du backup."
  exit 1
fi

if ! zgrep -q "CREATE TABLE.*settings" "${SQL_FILE}.gz"; then
  echo "Erreur : table settings absente du backup."
  exit 1
fi

echo "Backup local créé : ${SQL_FILE}.gz"
echo "Conservez ce fichier hors ligne, hors dépôt Git, sur un support distinct de Neon."
