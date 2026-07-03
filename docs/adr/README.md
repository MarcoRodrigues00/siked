# Architecture Decision Records — siked

Registros de decisão de arquitetura no formato [MADR](https://adr.github.io/madr/) (lite).
Cada ADR captura **uma** decisão, o contexto que a forçou, as alternativas descartadas e as
consequências (boas e ruins). ADR é imutável: para reverter, cria-se um novo ADR que
`Supersedes` o antigo.

| # | Título | Status |
|---|---|---|
| [0001](0001-runtime-e-estrutura-do-repo.md) | Runtime, linguagem e estrutura multi-serviço do repo | Accepted |
| [0002](0002-armazenamento-e-integridade.md) | Armazenamento de eventos: JSONL append-only + índice SQLite | Accepted |
| [0003](0003-integracao-da-deceptao.md) | Integração da decepção e transporte de eventos edge→core | Accepted |
| [0004](0004-motor-de-deteccao.md) | Motor de detecção: assinaturas (Suricata/Sigma) + correlação + muralha IA | Accepted |
| [0005](0005-dashboard-transporte-e-ui.md) | Transporte (WebSocket) e stack de UI do dashboard (React+Vite) | Accepted |
| [0006](0006-enriquecimento-ia.md) | Enriquecimento por IA: Ollama local, opt-in, nunca decisório | Accepted |
| [0007](0007-gates-de-seguranca-ci.md) | Seleção de ferramentas dos gates de segurança do CI | Accepted |
| [0008](0008-contencao-de-rede.md) | Topologia de contenção de rede (siked_edge / siked_core) | Accepted |

## Convenções

- Numeração sequencial de 4 dígitos, nunca reutilizada.
- Status: `Proposed` → `Accepted` → (`Deprecated` | `Superseded by NNNN`).
- Um ADR novo que muda uma decisão referencia o anterior no cabeçalho.
