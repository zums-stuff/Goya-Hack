#!/usr/bin/env bash
# scripts/db-up.sh — Levanta el Postgres local en Docker para desarrollo/demo.
#
# ⚠️ Usa el puerto 5433 para no chocar con un Postgres existente en 5432
# (Vercel/Next solo necesitan DATABASE_URL — el puerto es transparente).
#
# Uso:
#   npm run db:up        # arranca pumatrade-db (idempotente)
#   npm run db:down      # detiene el contenedor
#   npm run db:reset     # borra el contenedor y vuelve a crearlo (datos limpios)
#
# La URL resultante:
#   postgresql://postgres:postgres@localhost:5433/pumatrade?sslmode=disable

set -euo pipefail

NAME="pumatrade-db"
PORT="${PT_DB_PORT:-5433}"
IMAGE="${PT_DB_IMAGE:-postgres:16}"

case "${1:-up}" in
  up)
    if docker ps --filter "name=^/${NAME}$" --format "{{.Names}}" | grep -q "^${NAME}$"; then
      echo "✅ ${NAME} ya está corriendo en localhost:${PORT}"
      docker ps --filter name="^/${NAME}$" --format "  {{.Status}} → {{.Ports}}"
      exit 0
    fi
    if docker ps -a --filter "name=^/${NAME}$" --format "{{.Names}}" | grep -q "^${NAME}$"; then
      echo "▶️  Arrancando ${NAME} (creado previamente)..."
      docker start "${NAME}" >/dev/null
    else
      echo "🐘 Creando contenedor ${NAME} (${IMAGE}) en localhost:${PORT}..."
      docker run -d \
        --name "${NAME}" \
        -e POSTGRES_PASSWORD=postgres \
        -e POSTGRES_DB=pumatrade \
        -p "${PORT}:5432" \
        --restart unless-stopped \
        "${IMAGE}" >/dev/null
    fi
    # Espera a que acepte conexiones.
    for _ in $(seq 1 30); do
      if docker exec "${NAME}" pg_isready -U postgres >/dev/null 2>&1; then
        echo "✅ Postgres listo: postgresql://postgres:postgres@localhost:${PORT}/pumatrade?sslmode=disable"
        exit 0
      fi
      sleep 1
    done
    echo "❌ Postgres no arrancó a tiempo — revisa: docker logs ${NAME}" >&2
    exit 1
    ;;
  down)
    docker stop "${NAME}" >/dev/null 2>&1 && echo "⏹  ${NAME} detenido" || echo "(no estaba corriendo)"
    ;;
  reset)
    docker rm -f "${NAME}" >/dev/null 2>&1 || true
    echo "♻️  Contenedor eliminado — corre 'npm run db:up' para recrear con datos limpios."
    ;;
  *)
    echo "Uso: $0 {up|down|reset}" >&2
    exit 1
    ;;
esac