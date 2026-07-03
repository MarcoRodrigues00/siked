# 🔒 CONTAINMENT — isolamento do honeypot

> Um honeypot mal isolado é **pior** que não ter honeypot: vira pivô para o atacante.
> A contenção é o ponto de maturidade do `siked`. Este documento descreve como o isolamento é
> garantido de forma **verificável**, não apenas documental. Decisão em [ADR-0008](adr/0008-contencao-de-rede.md).

## Topologia de rede

| Rede | Tipo | Serviços | Exposição |
|---|---|---|---|
| `siked_edge` | bridge | `app`, `deception`, `ingest`* | portas publicadas (recebe tráfego/ataque) |
| `siked_core` | **internal: true** | `ingest`*, `detection`, `dashboard`**, `redis`, `ollama` | **nenhuma rota para host/internet** |
| `siked_mgmt` | bridge | `dashboard`** | só a porta da UI (console do SOC) |

\* `ingest` é a **ponte de ingestão** (edge↔core). \*\* `dashboard` é a **ponte de console** (core↔mgmt).

## Regras de fluxo (invariantes)

1. **Edge → Core: um único canal.** `app` e `deception` ficam só em `siked_edge`. O único
   serviço do core alcançável a partir do edge é o `ingest`, via `POST /events` autenticado com
   `INGEST_TOKEN`. Redis, detection e dashboard **não** respondem ao edge.
2. **Core sem egress.** `siked_core` é `internal: true` — não há rota de saída para o host nem
   para a internet. Redis e Ollama vivem aqui porque não podem "telefonar para casa".
3. **Dashboard é a única ponte, read-only.** Participa de `siked_core` (recebe alertas) e de
   `siked_mgmt` (única porta publicada). Não abre saída do core.
4. **Iscas sem privilégio.** Containers rodam como usuário não-root (`user: 1000:1000`),
   `read_only: true` + `tmpfs` para escrita efêmera, sem volumes sensíveis, **sem segredos reais**.

## Como verificar (vira teste no Sprint 0)

Um runner automatizado está em [`../scripts/containment-test.sh`](../scripts/containment-test.sh)
(usa só as redes criadas pelo compose, então roda mesmo antes de todos os serviços existirem).
Verificações essenciais:

```bash
# Nomes das redes criadas pelo compose (projeto = nome da pasta):
CORE=siked_siked_core ; EDGE=siked_siked_edge

# 1) Core NÃO tem egress para a internet (deve FALHAR — internal: true):
docker run --rm --network "$CORE" alpine \
  sh -c 'wget -T4 -qO- http://1.1.1.1 >/dev/null 2>&1; echo exit=$?'   # espera != 0

# 2) Edge alcança a internet normalmente (contraste — deve SUCEDER):
docker run --rm --network "$EDGE" alpine \
  sh -c 'wget -T4 -qO- http://1.1.1.1 >/dev/null 2>&1; echo exit=$?'   # espera 0

# 3) Edge NÃO alcança um serviço do core (deve FALHAR/timeout):
#    (sobe um listener no core; um cliente no edge tenta conectar pelo IP do core)
CORE_IP=$(docker inspect -f '{{(index .NetworkSettings.Networks "'"$CORE"'").IPAddress}}' <container-do-core>)
docker run --rm --network "$EDGE" alpine \
  sh -c "timeout 4 nc -w3 $CORE_IP 6379; echo exit=\$?"                # espera != 0

# 4) (Sprint 1) O único canal edge→core funciona, autenticado (deve SUCEDER):
docker compose exec deception sh -c 'wget -T3 -qO- --header="x-ingest-token: $INGEST_TOKEN" \
  --post-data "{}" http://ingest:8081/events; echo exit=$?'            # espera resposta do ingest
```

## Postura ética

- Nunca exposto à internet pública (PLANO §9).
- Sem segredos reais nas iscas — honeytokens são dados falsos plantados de propósito.
- O gerador de tráfego (`traffic-generator/`) aponta **só** para o `siked` local isolado (guard).
- Dual-use contido e documentado; checklist de pré-publicação no Sprint 4.
