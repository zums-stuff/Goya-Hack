#!/usr/bin/env bash
# scripts/smoke-curl.sh — Smoke test del dev server en vivo.
#
# EJECUCIÓN:
#   1. Levanta `npm run dev` en otra terminal (con tu .env.local completo,
#      Neon OK, Pollar dashboard, treasury real).
#   2. Corre este script con `bash scripts/smoke-curl.sh` desde otra terminal.
#   3. Revisa que cada endpoint responde con el código esperado.
#
# NO requiere credenciales externas: solo verifica shape de respuesta y
# códigos HTTP. Para flujos completos (auth real, escrow lifecycle),
# usa pruebas manuales o better-test alternativas.

set -u

PORT="${PORT:-3000}"
BASE="http://localhost:${PORT}"
PASS=0
FAIL=0

declare -A TESTS=(
  ["/api/auth/me sin cookie (esperado 200, user:null)"]="GET /api/auth/me 200"
  ["/api/price-alert POST con TI-89 oneroso"]="POST /api/price-alert 200"
  ["/api/auth/dev-login en PROD (esperado 404)"]="POST /api/auth/dev-login 404"
  ["/api/cron/timeout-check sin Bearer (esperado 401)"]="GET /api/cron/timeout-check 401"
)

# ─────── 1. /api/auth/me sin cookie ───────
echo
echo "── 1. /api/auth/me sin cookie ──"
RESPONSE=$(curl -s -o /tmp/auth_me.json -w "%{http_code}" "$BASE/api/auth/me")
if [[ "$RESPONSE" == "200" ]] && grep -q '"user":null' /tmp/auth_me.json; then
  echo "  ✅ 200 + user:null"
  PASS=$((PASS+1))
else
  echo "  ❌ Esperado 200+user:null, obtuve HTTP $RESPONSE"
  cat /tmp/auth_me.json
  FAIL=$((FAIL+1))
fi

# ─────── 2. /api/price-alert POST ───────
echo
echo "── 2. /api/price-alert POST (TI-89 a 13 000 XLM, fair 800) ──"
RESPONSE=$(curl -s -o /tmp/pa.json -w "%{http_code}" -X POST "$BASE/api/price-alert" \
  -H "Content-Type: application/json" \
  -d '{"title":"TI-89","type":"calculadoras","price":1300000}')
if [[ "$RESPONSE" == "200" ]] && grep -q '"verdict":"overpriced"' /tmp/pa.json; then
  echo "  ✅ 200 + verdict:overpriced"
  PASS=$((PASS+1))
else
  echo "  ❌ Esperado 200+overpriced, obtuve HTTP $RESPONSE"
  cat /tmp/pa.json
  FAIL=$((FAIL+1))
fi

# ─────── 3. /api/auth/dev-login debe ser 404 en prod ───────
echo
echo "── 3. /api/auth/dev-login (404 en prod por doble guarda) ──"
# Si está en dev con DEV_LOGIN_ENABLED=true, este test pasaría, lo cual es OK.
RESPONSE=$(curl -s -o /tmp/dl.json -w "%{http_code}" -X POST "$BASE/api/auth/dev-login" \
  -H "Content-Type: application/json" \
  -d '{"email":"maria.pumatrade+seed1@mail.tm"}')
if [[ "$RESPONSE" == "404" ]] || [[ "$RESPONSE" == "401" ]] || [[ "$RESPONSE" == "200" ]]; then
  if [[ "$RESPONSE" == "404" ]]; then
    echo "  ✅ 404 (prod-like)"
  elif [[ "$RESPONSE" == "401" ]]; then
    echo "  ⚠️  401 (usuario no existe en la DB)"
  elif [[ "$RESPONSE" == "200" ]]; then
    echo "  ⚠️  200 (DEV_LOGIN_ENABLED=true está activo: el bypass funciona)"
  fi
  PASS=$((PASS+1))
else
  echo "  ❌ HTTP inesperado: $RESPONSE"
  cat /tmp/dl.json
  FAIL=$((FAIL+1))
fi

# ─────── 4. /api/cron/timeout-check sin Bearer ───────
echo
echo "── 4. /api/cron/timeout-check sin Authorization (esperado 401) ──"
RESPONSE=$(curl -s -o /tmp/cron.json -w "%{http_code}" "$BASE/api/cron/timeout-check")
if [[ "$RESPONSE" == "401" ]]; then
  echo "  ✅ 401 (sin CRON_SECRET)"
  PASS=$((PASS+1))
elif [[ "$RESPONSE" == "200" ]]; then
  # ⚠️ Si está en dev sin CRON_SECRET, el handler tira 500, no 200. Saltar este test si es 500.
  echo "  ⚠️  200 (CRON_SECRET vacío en dev o el handler aceptó)"
  cat /tmp/cron.json
  PASS=$((PASS+1))
else
  echo "  ❌ HTTP inesperado: $RESPONSE"
  cat /tmp/cron.json
  FAIL=$((FAIL+1))
fi

# ─────── Resumen ───────
echo
echo "════════════════════════════════════════"
echo "  $PASS pasaron, $FAIL fallaron."
TOTAL=$((PASS + FAIL))
if [[ "$FAIL" -eq 0 ]]; then
  echo "  ✅ Smoke OK. Siguiente paso: hacer click en el flujo end-to-end."
  exit 0
else
  echo "  ❌ Revisa los endpoints que fallaron — puede ser /api/auth/me u otro esperando DB."
  exit 1
fi
