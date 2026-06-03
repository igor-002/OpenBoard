#!/bin/sh
# Backup do banco OpenBoard (rodar na VPS, ex.: via cron diário).
# Uso: ./scripts/backup.sh [diretorio_destino]   (padrão: ./backups)
set -e

OUT="${1:-./backups}"
USER="${POSTGRES_USER:-openboard}"
DB="${POSTGRES_DB:-openboard}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUT/openboard-$STAMP.sql.gz"

mkdir -p "$OUT"
docker exec openboard-db pg_dump -U "$USER" "$DB" | gzip > "$FILE"
echo "backup criado: $FILE"

# Mantém só os 14 backups mais recentes.
ls -1t "$OUT"/openboard-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
