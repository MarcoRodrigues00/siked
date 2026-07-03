#!/usr/bin/env bash
# Verifica os invariantes de contenção do siked (ADR-0008) contra as redes REAIS
# criadas pelo docker compose. Sobe o mínimo que já existe (app no edge, redis no
# core), roda as provas com containers alpine efêmeros e derruba tudo.
#
# Uso:  ./scripts/containment-test.sh
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

pass=0; fail=0
ok()   { echo "  ✅ PASS — $1"; pass=$((pass+1)); }
bad()  { echo "  ❌ FAIL — $1"; fail=$((fail+1)); }

[ -f .env ] || cp .env.example .env

echo "== subindo mínimo (app@edge, redis@core) para materializar as redes =="
docker compose up -d --build app redis >/dev/null 2>&1 || { echo "compose up falhou"; exit 2; }

CORE=$(docker network ls --filter "label=com.docker.compose.network=siked_core" --format '{{.Name}}' | head -1)
EDGE=$(docker network ls --filter "label=com.docker.compose.network=siked_edge" --format '{{.Name}}' | head -1)
echo "   core=$CORE  edge=$EDGE"

REDIS_ID=$(docker compose ps -q redis)
CORE_IP=$(docker inspect -f '{{(index .NetworkSettings.Networks "'"$CORE"'").IPAddress}}' "$REDIS_ID")
echo "   redis (alvo no core) = $CORE_IP:6379"
echo

echo "== 1) core NÃO tem egress para a internet (internal: true) =="
docker run --rm --network "$CORE" alpine sh -c 'wget -T4 -qO- http://1.1.1.1 >/dev/null 2>&1' \
  && bad "core alcançou a internet (não deveria)" \
  || ok "core sem egress (internet inalcançável)"

echo "== 2) edge alcança a internet normalmente (contraste) =="
docker run --rm --network "$EDGE" alpine sh -c 'wget -T5 -qO- http://1.1.1.1 >/dev/null 2>&1' \
  && ok "edge com egress (esperado)" \
  || bad "edge sem egress (deveria ter)"

echo "== 3) edge NÃO alcança o redis do core =="
docker run --rm --network "$EDGE" alpine sh -c "timeout 4 nc -w3 $CORE_IP 6379 </dev/null >/dev/null 2>&1" \
  && bad "edge conectou no redis do core (não deveria)" \
  || ok "edge não alcança redis do core (isolado)"

echo "== 4) core alcança o próprio redis (contraste) =="
docker run --rm --network "$CORE" alpine sh -c "timeout 4 nc -w3 $CORE_IP 6379 </dev/null >/dev/null 2>&1" \
  && ok "core alcança redis (esperado)" \
  || bad "core não alcança redis (deveria)"

echo
echo "== derrubando =="
docker compose down >/dev/null 2>&1

echo
echo "resultado: $pass passaram, $fail falharam"
[ "$fail" -eq 0 ] && exit 0 || exit 1
