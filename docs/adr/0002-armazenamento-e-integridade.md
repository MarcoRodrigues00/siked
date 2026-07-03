# ADR-0002 — Armazenamento de eventos: JSONL append-only + índice SQLite

- **Status:** Accepted
- **Data:** 2026-07-03
- **Decisores:** Marco
- **Sprint:** Sprint 1

## Contexto

Todo evento normalizado precisa de **chain-of-custody** (integridade demonstrável, herdada do
padrão SHA-256 do `ai-pentest-lab`, PLANO §4.2) e, ao mesmo tempo, de leitura rápida para o
dashboard (contadores, correlação, MTTD). Um único mecanismo não serve bem aos dois objetivos:
integridade quer imutabilidade append-only; dashboard quer query indexada.

## Decisão

Adotar **dois mecanismos com papéis separados**:

1. **JSONL append-only** como fonte-verdade imutável. Cada linha é um evento canônico com um
   campo `hash` = `SHA-256(hash_anterior + payload_canônico)` — hash encadeado, então adulterar
   qualquer linha quebra a cadeia a partir dela. Só append; nunca update/delete.
2. **SQLite** como índice de leitura derivado, reconstruível a partir do JSONL a qualquer
   momento. Serve as queries do dashboard e a correlação por janela do motor de detecção.

O SQLite é **cache descartável**; a verdade é o JSONL.

## Alternativas consideradas

- **Só JSONL** — integridade trivial, mas correlação/janela e o dashboard viram varredura
  linear cara. Rejeitado por performance de leitura.
- **Só SQLite** — ótimo para query, mas append-only imutável exige triggers/WAL e cuidado; a
  garantia de custódia fica menos óbvia de demonstrar em entrevista. Rejeitado como fonte única.

## Consequências

- **Positivas:** custódia inspecionável a olho nu (uma ferramenta de verificação relê o JSONL e
  recomputa a cadeia); dashboard e detecção usam SQL indexado; o índice pode ser apagado e
  reconstruído sem perda.
- **Negativas / trade-offs:** dupla escrita (JSONL primeiro, depois índice) e código de
  reconstrução do índice. Consistência eventual entre os dois em caso de crash no meio.
- **Mitigação:** ordem de escrita fixa (JSONL fsync → SQLite); na subida, se o índice estiver
  atrás do JSONL, reindexa a partir do último offset conhecido.
