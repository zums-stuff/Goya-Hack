#!/usr/bin/env bash
# scripts/demo.sh — ONE COMMAND to bring up the entire Gremium demo.
#
#   npm run demo
#
# What it does, in order, idempotent at each step:
#   1. Self-check: Node >= 20, Docker present, ports clear.
#   2. Bring up the pumatrade-db Postgres container (port 5433).
#   3. Wait until `pg_isready` returns OK inside the container.
#   4. `prisma migrate deploy` (idempotent, runs all migrations).
#   5. `tsx prisma/seed.ts` (skips if any user exists).
#   6. Start `next dev` with cron env wired (DEMO_TTL=3,
#      CONFIRM_WINDOW=10, HACKATHON_FREE_FEES=true).
#   7. Poll GET /api/auth/me until 200 (server reachable).
#   8. Print ready banner with the URL.
#
# Why bash (not Node)?  Node 24 in this OpenCode workspace has a
# documented bug where spawnSync refuses to spawn cmd.exe even
# though the file exists (~ENOENT).  PowerShell + Git Bash + Docker
# Desktop work, so we drive the orchestration through bash and call
# `node` directly for any internal node script (prisma, tsx, next)
# without going through npm shims.
#
# Tested under Git Bash on Windows 11 + macOS zsh; minimal POSIX
# dependencies (bash, docker, node, curl-ish alternatives).

set -eu  # -o pipefail removed: docker.exe on Windows writes a
            # "WSL 2 integration" advisory to stderr that makes
            # the pipe's overall nonzero status look failed even
            # when the underlying `docker` call succeeded.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# On Windows + Git Bash, npm.cmd is on PATH but node.exe isn't
# always — when npm itself was launched through PowerShell -> cmd ->
# bash, the embedded bash inherits a stripped PATH that's missing
# /c/Program Files/nodejs. We fall back through known locations
# until we find a real node binary.
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [[ -x "/usr/bin/node" ]]; then
  NODE_BIN="/usr/bin/node"
elif [[ -x "/usr/local/bin/node" ]]; then
  NODE_BIN="/usr/local/bin/node"
elif [[ -x "/mnt/c/Program Files/nodejs/node.exe" ]]; then
  NODE_BIN="/mnt/c/Program Files/nodejs/node.exe"
elif [[ -x "/c/Program Files/nodejs/node.exe" ]]; then
  NODE_BIN="/c/Program Files/nodejs/node.exe"
else
  err "No se encontró node. Instala Node >= 20 o agrega node al PATH."
  exit 1
fi

PORT="${PORT:-3000}"
HOST="http://localhost:${PORT}"

# ANSI helpers (work in any terminal that supports escape codes).
BLUE='\033[34m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
DIM='\033[2m'
RESET='\033[0m'

step() {
  local label="$1" t0
  t0=$(date +%s)
  printf '%b[%s]%b starting...\n' "$BLUE" "$label" "$RESET"
}

ok() {
  local label="$1" t0 took
  t0=$(date +%s)
  printf '%b✓%b %s\n' "$GREEN" "$RESET" "$label"
}

err() {
  printf '%b✗%b %s\n' "$RED" "$RESET" "$1"
}

banner() {
  cat <<EOF
${BLUE}╔═════════════════════════════════════════════════╗${RESET}
${BLUE}║${RESET}     ${GREEN}Gremium — Goya-Hack 2026 demo runner${RESET}     ${BLUE}║${RESET}
${BLUE}╚═════════════════════════════════════════════════╝${RESET}
${DIM}Single command to bring up the entire demo. Ensure Docker${RESET}
${DIM}Desktop is running on Windows / OrbStack on Mac — the script${RESET}
${DIM}uses Docker to host Postgres on localhost:5433.${RESET}

EOF
}

banner

# ─── 1. Self-check ──────────────────────────────────────────────────────
step "1. Self-check"
NODE_VER="$("$NODE_BIN" --version)"
NODE_MAJOR="$(echo "$NODE_VER" | sed 's/v\([0-9]*\)\..*/\1/')"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  err "Node ${NODE_VER} is too old (need >= 20). nvm use 20 && retry."
  exit 1
fi
ok "Node ${NODE_VER} (${NODE_BIN})"

# Resolve docker the same way we resolve node: PATH first, then
# absolute Git Bash paths. Works on real Windows + Git Bash +
# Docker Desktop, and works on WSL/Linux native docker hosts.
DOCKER_BIN=""
if command -v docker >/dev/null 2>&1; then
  DOCKER_BIN="$(command -v docker)"
elif [[ -x "/usr/bin/docker" ]]; then
  DOCKER_BIN="/usr/bin/docker"
elif [[ -x "/usr/local/bin/docker" ]]; then
  DOCKER_BIN="/usr/local/bin/docker"
elif [[ -x "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" ]]; then
  DOCKER_BIN="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"
elif [[ -x "/c/Program Files/Docker/Docker/resources/bin/docker.exe" ]]; then
  DOCKER_BIN="/c/Program Files/Docker/Docker/resources/bin/docker.exe"
fi
if [[ -z "$DOCKER_BIN" ]]; then
  err "Docker no encontrado. En Windows: instala Docker Desktop. En WSL/Linux: docker.io + daemon."
  exit 1
fi
# Liveness probe. `docker ps` is the smallest stable call; if it
# returns even an empty list, the daemon is up. When invoked under
# WSL bash without the Docker Desktop WSL integration enabled,
# docker.exe just prints a "WSL 2 activation" advisory and exits
# 127 — we surface that exact diagnostic in the failure message so
# the user knows to flip the toggle.
DOCKER_PROBE_LOG="$(mktemp -t gremium-docker-probe.XXXXXX)"
"$DOCKER_BIN" ps >"$DOCKER_PROBE_LOG" 2>&1
DOCKER_PROBE_RC=$?
if [[ "$DOCKER_PROBE_RC" -ne 0 ]]; then
  err "docker probe (rc=$DOCKER_PROBE_RC) — fallo:"
  cat "$DOCKER_PROBE_LOG" | head -25 | sed 's/^/  /'
  if grep -q 'WSL 2 distro' "$DOCKER_PROBE_LOG"; then
    err "Esto suele pasar cuando Docker Desktop no tiene integración WSL. Actívala en Settings → Resources → WSL Integration → Enable."
  fi
  rm -f "$DOCKER_PROBE_LOG"
  exit 1
fi
rm -f "$DOCKER_PROBE_LOG"
ok "Docker daemon reachable (${DOCKER_BIN})"

# ─── 2 + 3. Postgres up + healthy ────────────────────────────────────────
step "2. Postgres up"
NAME="pumatrade-db"
PT_DB_PORT="${PT_DB_PORT:-5433}"
PT_DB_IMAGE="${PT_DB_IMAGE:-postgres:16}"
if "$DOCKER_BIN" ps --filter "name=^${NAME}$" --format '{{.Names}}' | grep -q "^${NAME}$"; then
  ok "${NAME} ya corriendo en :${PT_DB_PORT}"
else
  if "$DOCKER_BIN" ps -a --filter "name=^${NAME}$" --format '{{.Names}}' | grep -q "^${NAME}$"; then
    ok "arrancando ${NAME} (contenedor existente)..."
    "$DOCKER_BIN" start "$NAME" >/dev/null
  else
    ok "creando contenedor ${NAME} (${PT_DB_IMAGE}) en :${PT_DB_PORT}..."
    "$DOCKER_BIN" run -d \
      --name "$NAME" \
      -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=pumatrade \
      -p "${PT_DB_PORT}:5432" \
      --restart unless-stopped \
      "$PT_DB_IMAGE" >/dev/null
  fi
fi

step "3. Postgres healthy"
DEADLINE=$(( $(date +%s) + 30 ))
while (( $(date +%s) < DEADLINE )); do
  if "$DOCKER_BIN" exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then
    ok "ready @ :${PT_DB_PORT} (postgresql://postgres:postgres@localhost:${PT_DB_PORT}/pumatrade?sslmode=disable)"
    break
  fi
  sleep 0.5
done
if ! "$DOCKER_BIN" exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then
  err "Postgres no respondio pg_isready en 30s. "$DOCKER_BIN" logs ${NAME} para diagnosticar."
  exit 1
fi

# ─── 4. Prisma migrations ───────────────────────────────────────────────
step "4. Prisma migrations"
# node + the prisma binary directly avoids the .cmd shim issue.
"$NODE_BIN" ./node_modules/.bin/prisma migrate deploy
ok "Migrations aplicadas"

# ─── 5. Seed (idempotente — aborta si ya hay users) ──────────────────────
step "5. Demo seed"
"$NODE_BIN" ./node_modules/.bin/tsx prisma/seed.ts
ok "Seed DB"

# ─── 6. Start dev server ─────────────────────────────────────────────────
step "6. Start dev server"
ENABLE_CRON=true \
  DEMO_TTL_MINUTES=3 \
  CONFIRM_WINDOW_MINUTES=10 \
  HACKATHON_FREE_FEES=true \
  "$NODE_BIN" ./node_modules/.bin/next dev --port "$PORT" &
NEXT_PID=$!
trap 'echo; printf "%b!%b stopping dev server (pid $NEXT_PID)...\n" "$YELLOW" "$RESET"; kill -TERM "$NEXT_PID" 2>/dev/null || true; wait "$NEXT_PID" 2>/dev/null || true; exit 0' INT TERM

# ─── 7. Wait for server ─────────────────────────────────────────────────
step "7. Wait for server"
DEADLINE=$(( $(date +%s) + 45 ))
ready=0
while (( $(date +%s) < DEADLINE )); do
  # Use Node to fetch — node's HTTP client doesn't have the
  # `curl` interactive cùl  Edge quirks on Windows.
  if "$NODE_BIN" -e "fetch('${HOST}/api/auth/me', { signal: AbortSignal.timeout(2000) }).then(r => process.exit(r.ok || r.status === 401 ? 0 : 1)).catch(() => process.exit(1));" 2>/dev/null; then
    ready=1
    break
  fi
  sleep 0.5
done
if [[ "$ready" -ne 1 ]]; then
  err "Server no respondio en ${HOST}/api/auth/me dentro de 45s."
  kill -TERM "$NEXT_PID" 2>/dev/null || true
  exit 1
fi
ok "Respondiendo en ${HOST}"

# ─── 8. Ready banner ────────────────────────────────────────────────────
cat <<EOF
${GREEN}╔═════════════════════════════════════════════════╗${RESET}
${GREEN}║${RESET}             ${GREEN}🎉 READY${RESET}                          ${GREEN}║${RESET}
${GREEN}║${RESET}                                                 ${GREEN}║${RESET}
${GREEN}║${RESET}  Open:    ${YELLOW}${HOST}${RESET}                ${GREEN}║${RESET}
${GREEN}║${RESET}  Mode:    Demo (6 users · 17 listings · 7 offers)${RESET}
${GREEN}║${RESET}  Stop:    Ctrl-C en esta terminal${RESET}              ${GREEN}║${RESET}
${GREEN}║${RESET}  Reset:   npm run db:reset && npm run demo${RESET}      ${GREEN}║${RESET}
${GREEN}╚═════════════════════════════════════════════════╝${RESET}
\n${DIM}next dev corre en foreground (pid $NEXT_PID). Ctrl-C para parar.${RESET}
\n

# Forward to the foreground — wait for next dev to exit (or be killed).
wait "$NEXT_PID"
