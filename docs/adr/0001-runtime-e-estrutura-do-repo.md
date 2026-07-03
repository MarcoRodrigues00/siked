# ADR-0001 — Runtime, linguagem e estrutura multi-serviço do repo

- **Status:** Accepted
- **Data:** 2026-07-03
- **Decisores:** Marco
- **Sprint:** Sprint 0

## Contexto

O `siked` tem 6 camadas com fronteiras de confiança distintas (app real, iscas, ingest,
detecção, dashboard, geração de tráfego). O diagrama de contenção (PLANO §2) coloca `app` e
`deception` numa rede exposta e o núcleo (`ingest`/`detection`/`dashboard`) numa rede interna
sem rota para fora. Para que essa fronteira seja **real** e não apenas documental, cada camada
precisa ser um artefato de deploy separado.

## Decisão

Node.js LTS 20 + TypeScript + Express, distribuído como **múltiplos serviços Docker**, um por
camada relevante: `app`, `deception`, `ingest`, `detection`, `dashboard`,
`traffic-generator` (mais `ollama` e `redis` como serviços de infra). Cada serviço tem seu
próprio `Dockerfile`, `package.json` e ciclo de vida. Código-fonte escrito **do zero** (PLANO §4).

## Alternativas consideradas

- **Mono-serviço, módulos internos** — mais simples de subir, um só container. Rejeitado:
  colapsa `edge` e `core` no mesmo processo, tornando a contenção de rede uma ficção. O
  isolamento é o ponto de maturidade do projeto (PLANO §1.6).
- **pnpm workspaces num único deploy** — boas fronteiras de código, mas ainda um processo só
  em runtime; não resolve a separação de rede.

## Consequências

- **Positivas:** contenção `siked_edge`/`siked_core` fica literal e verificável; um container
  de isca comprometido não alcança o núcleo; cada serviço escala e falha isoladamente.
- **Negativas / trade-offs:** mais Dockerfiles, mais overhead de build, comunicação
  inter-serviço passa a exigir transporte explícito (ver ADR-0003). Código compartilhado
  (schema do evento, logger) é duplicado ou publicado como pacote interno.
- **Mitigação:** um diretório `shared/` versionado e copiado em build, ou um pacote local;
  `docker compose up` único orquestra tudo para manter a demo em um comando (PLANO §9).
