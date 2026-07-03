# ADR-0003 — Integração da decepção e transporte de eventos edge→core

- **Status:** Accepted
- **Data:** 2026-07-03
- **Decisores:** Marco
- **Sprint:** Sprint 1

## Contexto

Com serviços separados (ADR-0001), `app` e `deception` vivem em `siked_edge` e precisam entregar
eventos ao `ingest`, que vive em `siked_core` (interna). A regra de ouro de contenção (PLANO §2)
diz que a rede das iscas **nunca** alcança rede interna nem host — mas o núcleo precisa receber
os eventos. É preciso um único canal, estreito e unidirecional, que seja a exceção controlada.

## Decisão

- **Deception como serviço próprio** (não embutido no `app`): honeypots low-interaction e o
  registro de honeytokens ficam num container separado do app real, reforçando que a isca não
  compartilha processo nem segredos com o "lado certo".
- **Transporte edge→core:** o único caminho permitido de `siked_edge` para `siked_core` é
  `POST /events` no serviço `ingest`, autenticado por um segredo de ingest (`INGEST_TOKEN`)
  injetado por env. Nenhuma outra porta do core é alcançável a partir do edge.
- **Barramento interno:** dentro de `siked_core`, o fluxo `ingest → detection → dashboard` usa
  **Redis pub/sub** como barramento de eventos/alertas ("barramento" do PLANO §3, passo 6).

## Alternativas consideradas

- **App e deception no mesmo container** — menos containers, mas a isca passaria a dividir
  espaço de processo com o app seguro; enfraquece a narrativa de isolamento. Rejeitado.
- **Fila (RabbitMQ/Kafka) edge→core** — mais robusto, porém peso de infra desproporcional ao
  escopo de 1–2 semanas. Rejeitado; Redis pub/sub cobre a demo.
- **Escrita direta no store pelo edge** — daria ao edge acesso ao volume de custódia do core:
  viola a contenção. Rejeitado.

## Consequências

- **Positivas:** um único ponto de entrada auditável no core; a superfície edge→core é uma rota
  HTTP autenticada e nada mais; o barramento interno desacopla detecção do dashboard.
- **Negativas / trade-offs:** o `INGEST_TOKEN` vira um segredo operacional a gerir; Redis é mais
  um serviço. Se o ingest cair, eventos do edge se perdem (sem fila persistente).
- **Mitigação:** retry com backoff no cliente de emissão do edge e buffer em memória curto;
  documentar o canal único em `docs/CONTAINMENT.md` e testar que nenhuma outra porta do core
  responde a partir do edge.
