#!/usr/bin/env bash
# scripts/boot.sh — Arranque completo de Gremium tras un reboot / desde cero.
#
# Idempotente: se puede correr siempre y no rompe nada:
#   - Si Docker no está, intenta arrancar el daemon (systemctl en Linux,
#     Docker Desktop.app en macOS, Docker Desktop.exe en Windows/Git Bash).
#   - Levanta el Postgres local `pumatrade-db` (puerto 5433) si hace falta.
#   - Genera el client Prisma y aplica migraciones pendientes.
#   - Siembra el demo solo si la DB está vacía (nunca duplica).
#   - Levanta `next dev` en background (logs en logs/dev.log).
#   - (opcional) smoke test de endpoints.
#
# Uso:
#   npm run boot                 # arranque estándar
#   bash scripts/boot.sh -r      # recrea la DB con datos limpios y arranca
#   bash scripts/boot.sh -s      # arranca y corre el smoke test
#   bash scripts/boot.sh -t      # corre typecheck antes de arrancar
#   bash scripts/boot.sh -h      # ayuda

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
PORT="${PORT:-3000}"
BASE="http://localhost:${PORT}"

RESET_DB=0
RUN_SMOKE=0
RUN_TYPECHECK=0

for arg in "$@"; do
  case "$arg" in
    -r|--reset-db)  RESET_DB=1 ;;
    -s|--smoke)     RUN_SMOKE=1 ;;
    -t|--typecheck) RUN_TYPECHECK=1 ;;
    # Extrae la cabecera por contenido, no por numeros de linea: editar el
    # bloque de comentario ya no puede romper la ayuda.
    -h|--help) awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"; exit 0 ;;
    *) echo "❌ Flag desconocido: $arg (-h para ayuda)"; exit 1 ;;
  esac
done

say()  { printf '%s\n' "  $*"; }
ok()   { printf '\033[32m  ✔\033[0m %s\n' "$*"; }
warn() { printf '\033[33m  ⚠\033[0m %s\n' "$*"; }
die()  { printf '\033[31m  ✖ %s\033[0m\n' "$*" >&2; exit 1; }

# Espera maxima (segundos) a que el daemon responda. Docker Desktop en frio
# tarda bastante mas que systemd, asi que el default es holgado.
# Override con DOCKER_WAIT=<segundos>.
DOCKER_WAIT="${DOCKER_WAIT:-90}"

# Arranca el daemon de Docker segun la plataforma.
# La rama de Linux es exactamente la que existia antes (systemd); las demas
# son aditivas y no alteran el comportamiento en Linux ni en macOS.
start_docker() {
  case "$(uname -s 2>/dev/null || echo unknown)" in
    Linux)
      if command -v systemctl >/dev/null 2>&1; then
        sudo -n systemctl start docker >/dev/null 2>&1 \
          || systemctl start docker >/dev/null 2>&1 \
          || { sudo systemctl start docker >/dev/null 2>&1; }
      fi
      ;;
    Darwin)
      open -a Docker >/dev/null 2>&1 || true
      ;;
    MINGW*|MSYS*|CYGWIN*)
      # Git Bash en Windows: no hay systemd. El daemon lo provee Docker
      # Desktop, que es una app GUI y hay que lanzar como proceso suelto.
      local exe win
      for exe in \
        "/c/Program Files/Docker/Docker/Docker Desktop.exe" \
        "${LOCALAPPDATA:-/c/Users/${USER}/AppData/Local}/Docker/Docker Desktop.exe"
      do
        [[ -f "$exe" ]] || continue
        win="$(cygpath -w "$exe" 2>/dev/null || printf '%s' "$exe")"
        # //c y no /c: MSYS reinterpretaria "/c" como ruta.
        cmd //c start "" "$win" >/dev/null 2>&1 && return 0
        powershell -NoProfile -Command "Start-Process -FilePath '$win'" \
          >/dev/null 2>&1 && return 0
      done
      ;;
  esac
  return 0
}

echo
echo "🚀 Gremium · arranque (puerto ${PORT})"
echo "──────────────────────────────────────────────────────────"

# ───────────────────────── 1. Docker daemon ─────────────────────────
if ! docker info >/dev/null 2>&1; then
  warn "Docker no responde — intentando arrancar el daemon..."
  # `|| true`: si arrancar el daemon falla, queremos que el flujo siga hasta
  # el chequeo final (que da el mensaje de error), no que `set -e` aborte ya.
  start_docker || true
  for _ in $(seq 1 "${DOCKER_WAIT}"); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
  docker info >/dev/null 2>&1 || die "Docker no arrancó. Inícialo manualmente y vuelve a correr 'npm run boot'."
  ok "Docker daemon listo"
else
  ok "Docker daemon listo"
fi

# ───────────────────────── 2. Postgres local ────────────────────────
if [[ "$RESET_DB" == "1" ]]; then
  say "Recreando Postgres (datos limpios)..."
  bash scripts/db-up.sh reset >/dev/null
fi
bash scripts/db-up.sh up

# ───────────────────────── 3. Variables de entorno ──────────────────
if [[ ! -f .env.local ]]; then
  warn ".env.local no existe — generando keys Stellar de testnet (friendbot)..."
  npm run setup:env
else
  ok ".env.local presente"
fi
# Dev-login 1-click para los 5 seed users (solo next dev, nunca build/prod).
if [[ ! -f .env.development.local ]] || ! grep -q "DEV_LOGIN_ENABLED" .env.development.local 2>/dev/null; then
  echo "# Solo next dev. Habilita /api/auth/dev-login (1-click por seed user)." > .env.development.local
  echo "DEV_LOGIN_ENABLED=true" >> .env.development.local
  ok ".env.development.local con DEV_LOGIN_ENABLED=true"
fi
# Carga DATABASE_URL para los comandos Prisma siguientes.
set -a; source .env.local 2>/dev/null || true; set +a

# ───────────────────── 4. Prisma: client + migraciones ──────────────
say "Generando client Prisma..."
npx prisma generate >/dev/null 2>&1
ok "Prisma client generado"

if [[ -n "${DATABASE_URL:-}" ]]; then
  say "Aplicando migraciones..."
  npx prisma migrate deploy 2>&1 | tail -1
fi

# ───────────────────────── 5. Seed del demo ─────────────────────────
# El seed es idempotente: aborta si ya hay users (no duplica datos).
DATABASE_URL="${DATABASE_URL}" npm run db:seed
say "(el seed se salta solo si la DB ya tiene datos)"

# ───────────────────────── 6. Typecheck (opcional) ──────────────────
if [[ "$RUN_TYPECHECK" == "1" ]]; then
  say "Typecheck..."
  npx tsc --noEmit
  ok "tsc sin errores"
fi

# ───────────────────────── 7. Dev server ────────────────────────────
if curl -s -o /dev/null --max-time 2 "$BASE" 2>/dev/null; then
  ok "Ya hay un servidor respondiendo en ${BASE} — no levanto otro"
else
  mkdir -p logs
  say "Levantando next dev... (logs: logs/dev.log)"
  nohup npm run dev > logs/dev.log 2>&1 &
  echo $! > logs/dev.pid
  ok "PID $(cat logs/dev.pid) — esperando a que compile..."
  for _ in $(seq 1 120); do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$BASE" 2>/dev/null || true)
    if [[ "$CODE" =~ ^2[0-9][0-9]$|^4[0-9][0-9]$ ]]; then
      break
    fi
    sleep 1
  done
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$BASE" 2>/dev/null || true)
  if [[ "$CODE" =~ ^[0-9]{3}$ ]]; then
    ok "next dev respondiendo (HTTP ${CODE}) en ${BASE}"
  else
    warn "Aún no responde — revisa: tail -f logs/dev.log"
  fi
fi

# ───────────────────────── 8. Smoke test (opcional) ─────────────────
if [[ "$RUN_SMOKE" == "1" ]]; then
  say "Corriendo smoke test..."
  bash scripts/smoke-curl.sh || warn "Smoke test reportó fallos (revisa arriba)"
fi

# ───────────────────────── Resumen ──────────────────────────────────
echo
echo "══════════════════════════════════════════════════════════"
echo "  ✅ Gremium listo →  ${BASE}"
echo "──────────────────────────────────────────────────────────"
echo "  Login demo (dev):  /api/auth/dev-login  (5 seed users)"
echo "    maria | juan | andrea | pablo | sofia"
echo "    + '.pumatrade+seed1@mail.tm'  (ej. maria.pumatrade+seed1@mail.tm)"
echo "  Logs:               tail -f logs/dev.log"
echo "  Parar dev server:   kill \$(cat logs/dev.pid)"
echo "  DB reset de datos:  npm run db:reset"
echo "  ⚠️ Login real Pollar: pega tus keys pub_*/sec_* en .env.local"
echo "══════════════════════════════════════════════════════════"
echo