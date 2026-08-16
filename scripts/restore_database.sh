#!/usr/bin/env bash
# Restauration MULTICOM vers une base PostgreSQL de TEST uniquement
# Usage :
#   TARGET_DATABASE_URL='postgresql://...' ./scripts/restore_database.sh backups/local/backup_multicom_YYYY-MM-DD.sql.gz
#
# NE JAMAIS restaurer directement sur la base de production sans procédure contrôlée.

set -euo pipefail

BACKUP_FILE="${1:-}"
TARGET_URL="${TARGET_DATABASE_URL:-}"

if [ -z "$BACKUP_FILE" ] || [ -z "$TARGET_URL" ]; then
  echo "Usage : TARGET_DATABASE_URL='postgresql://...' $0 <backup.sql.gz|backup.sql>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Fichier introuvable : $BACKUP_FILE"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Erreur : psql introuvable."
  exit 1
fi

echo "ATTENTION : restauration vers la base cible fournie."
echo "Vérifiez qu'il s'agit bien d'une base de TEST."

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | psql "$TARGET_URL" -v ON_ERROR_STOP=1
else
  psql "$TARGET_URL" -v ON_ERROR_STOP=1 -f "$BACKUP_FILE"
fi

psql "$TARGET_URL" -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) AS visitors_count FROM visitors;"
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) AS settings_count FROM settings;"

echo "Restauration terminée. Vérifiez les compteurs ci-dessus."
