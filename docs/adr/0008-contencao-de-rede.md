# ADR-0008 — Topologia de contenção de rede (siked_edge / siked_core)

- **Status:** Accepted
- **Data:** 2026-07-03
- **Decisores:** Marco
- **Sprint:** Sprint 0

## Contexto

Um honeypot mal isolado é **pior** que não ter honeypot: vira pivô para o atacante (PLANO §1.6,
§7 Sprint 0). A contenção é o ponto de maturidade do projeto e precisa ser real, não documental.
Com serviços separados (ADR-0001), a topologia de rede Docker é o mecanismo que garante isso.

## Decisão

Três redes Docker, com uma regra de fluxo por fronteira:

```
siked_edge   (bridge, exposta na demo)     → app, deception, ingest*
siked_core   (internal: true, sem egress)  → ingest*, detection, dashboard**, redis, ollama
siked_mgmt   (bridge, só a porta da UI)     → dashboard** (console do SOC)
                                            (* ponte de ingestão   ** ponte de console)
```

Regras de fluxo:
1. `siked_edge` → `siked_core`: **um único caminho**. `app` e `deception` ficam **só** em
   `siked_edge` e não alcançam o core diretamente. O único serviço do core exposto ao edge é o
   `ingest`, que participa das duas redes (ponte de ingestão) e só aceita `POST /events`
   autenticado (ADR-0003). Nada mais do core — redis, detection, dashboard — é alcançável a
   partir do edge.
2. `siked_core` é `internal: true`: **sem rota de saída** para host ou internet. Ollama e Redis
   vivem aqui justamente porque não podem "telefonar para casa".
3. `dashboard` participa de `siked_core` (recebe alertas) **e** de `siked_mgmt` (única porta
   publicada para o browser do analista). É a ponte de saída, e só de leitura.
4. Iscas rodam como **usuário não-root**, `read_only: true` onde possível, sem volumes
   sensíveis, sem segredos reais.

## Alternativas consideradas

- **Duas redes (edge/core), dashboard exposto direto do core** — mais simples, mas publicar
  porta a partir da rede `internal` mistura os papéis "interno" e "exposto" no mesmo lugar. A
  rede `siked_mgmt` separada deixa a ponte explícita e auditável.
- **Rede única com regras de firewall no container** — frágil e difícil de demonstrar; a
  segmentação por rede Docker é declarativa e verificável.

## Consequências

- **Positivas:** contenção verificável (`docker compose` declara o isolamento); o core não
  consegue exfiltrar; a única ponte é read-only. Ótimo material de entrevista (segmentação,
  princípio de contenção — domínio *Architecture & Design* do Security+).
- **Negativas / trade-offs:** três redes e um serviço que participa de duas adicionam
  complexidade ao compose; qualquer serviço do core que precise de saída (ex.: baixar modelo do
  Ollama) exige um passo de build/pré-carga, não runtime.
- **Mitigação:** pré-baixar o modelo do Ollama em build/volume; teste de contenção no CI que
  tenta alcançar o core a partir do edge (deve falhar) e o egress do core (deve falhar);
  documentar tudo em `docs/CONTAINMENT.md`.
