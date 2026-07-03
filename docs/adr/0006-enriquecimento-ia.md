# ADR-0006 — Enriquecimento por IA: Ollama local, opt-in, nunca decisório

- **Status:** Accepted
- **Data:** 2026-07-03
- **Decisores:** Marco
- **Sprint:** Sprint 4 (stretch)

## Contexto

A camada de IA (PLANO §1.7, §4.2) resume o incidente em linguagem natural e sugere resposta —
mas **nunca** decide a detecção. Ela é enriquecimento sobre um alerta já produzido pela regra
determinística. Requisitos-chave: não pode virar dependência dura; deve respeitar a contenção
(o core não tem rota para fora — chamar uma API externa violaria isso); precisa de fallback.

## Decisão

- **Provedor:** **Ollama local**, rodando como serviço Docker dentro de `siked_core`. Modelo
  pequeno (ex.: `llama3.2` ou similar). Sem chave, sem custo, sem chamada de saída da rede —
  coerente com o core sem egress (ADR-0008).
- **Opt-in:** desligado por padrão; ativado por flag (`ENRICH_AI=true`). A demo funciona 100%
  sem ele.
- **Não-decisório (muralha estrutural):** a IA só escreve no bloco `advisory` do alerta,
  **nunca** no bloco `decision` — a separação é o invariante definido em
  [ADR-0004](0004-motor-de-deteccao.md). O `detection` emite o alerta completo (técnica,
  severidade, D3FEND) antes de qualquer IA; o enriquecimento só **anexa** `summary` e
  `suggested_response` em `advisory`, e removê-lo não muda nenhuma detecção.
- **Fallback determinístico:** se o Ollama estiver ausente/lento/timeout, um template
  determinístico gera o resumo a partir dos campos do alerta. O alerta nunca fica bloqueado
  esperando IA.

## Alternativas consideradas

- **Claude API (opt-in)** — mais capaz, mas exige rota de saída do core e chave; contradiz a
  contenção sem egress. Rejeitado para manter o core hermético; citável como opção "cloud".
- **Só desenhar a interface agora** — adiar o provedor real; rejeitado porque um Ollama local é
  barato de plugar e demonstra a camada agentic real do Marco.

## Consequências

- **Positivas:** IA real sem furar a contenção; sem custo/telemetria externa; fallback garante
  que a detecção nunca depende do modelo.
- **Negativas / trade-offs:** Ollama pesa em RAM/imagem; latência do modelo local pode passar do
  MTTD-alvo — por isso o enriquecimento é **assíncrono** e fora do caminho de detecção.
- **Mitigação:** enriquecer fora de banda (após o push do alerta), com timeout curto e fallback;
  documentar o custo de recurso e deixar o serviço `ollama` como profile opcional do compose.
