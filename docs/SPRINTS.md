# 🗺️ SPRINTS — siked

Refinamento executável do roadmap do `PLANO_siked.md` §7. Cada sprint tem **entregáveis**, uma
**Definition of Done verificável** (um comando/teste que prova a entrega) e o **momento de
aprendizado** que amarra ao posicionamento AppSec/DevSecOps/SOC + Security+ (SY0-701).

Decisões de fundação travadas nos ADRs: multi-serviço Docker ([0001](adr/0001-runtime-e-estrutura-do-repo.md)),
JSONL+SQLite ([0002](adr/0002-armazenamento-e-integridade.md)), transporte edge→core + Redis
([0003](adr/0003-integracao-da-deceptao.md)), React+Vite ([0005](adr/0005-dashboard-transporte-e-ui.md)),
Ollama local ([0006](adr/0006-enriquecimento-ia.md)), contenção de rede ([0008](adr/0008-contencao-de-rede.md)).

---

## Sprint 0 — Fundação & contenção (dias 1–2)

**Entregáveis**
- `docker-compose.yml` com redes `siked_edge`, `siked_core` (`internal: true`), `siked_mgmt`.
- Esqueleto do `app/` seguro (do zero): Express + Helmet + Zod + rate-limit + body cap + logger
  JSON estruturado + errorHandler que não vaza stack.
- `README.md` com os frameworks citados; `docs/CONTAINMENT.md`.
- `shared/` com o schema do evento canônico (usado por edge e core).

**Definition of Done (verificável)** — ✅ **Sprint 0 concluído (2026-07-03)**
- [x] `docker compose up app` sobe o serviço; `GET /health` → 200 (uid=1000 não-root, `read_only` ativo).
- [x] `app` responde com headers Helmet (`X-Content-Type-Options: nosniff`, CSP, HSTS, sem `X-Powered-By`).
- [x] Body acima do cap → 413; input inválido → 400 (Zod). *(9 testes vitest+supertest verdes.)*
- [x] Teste de contenção (`scripts/containment-test.sh`, 4/4): core sem egress à internet; edge
      não alcança serviço do core (redis); contrastes edge-egress e core→redis confirmam a topologia.

**Momento de aprendizado:** segmentação de rede e contenção — por que honeypot mal isolado vira
pivô. Domínio *Architecture & Design*.

---

## Sprint 1 — Decepção & ingest (dias 3–5)

**Entregáveis**
- `deception/`: 5–7 honeypots low-interaction (`/admin`, `/wp-login.php`, `/.env`,
  `/api/v1/keys`, `/backup.zip`, `/phpmyadmin`) + responder verossímil (Engage: expose→elicit).
- 2–3 honeytokens (credencial "vazada", API key falsa, usuário-armadilha) + registro.
- `ingest/`: schema canônico, `sanitize` (trunca/mascara payload), `store` JSONL append-only com
  hash encadeado SHA-256 + índice SQLite. Endpoint `POST /events` autenticado por `INGEST_TOKEN`.

**Definition of Done (verificável)** — ✅ **Sprint 1 concluído (2026-07-03)**
- [x] `curl` numa isca → **1** evento canônico persistido no JSONL + indexado no SQLite (E2E em
      Docker: 4 iscas → 4 registros encadeados; honeytoken usado → `token_id` marcado).
- [x] Só a `deception` emite; ela recebe apenas tráfego adversário por construção. O `app` real é
      serviço separado e não emite em rotas legítimas → **0** eventos de usuário legítimo.
- [x] Payload com segredo/PII → gravado **mascarado** (`password=[MASKED:SECRET]`), nunca cru.
- [x] Verificador de custódia relê o JSONL e a cadeia fecha (`{ok:true}`); adulterar 1 linha
      quebra a cadeia (teste `store.test.ts` + `/custody/verify`). 33 testes ingest+deception verdes.

**Momento de aprendizado:** honeypot vs honeytoken; expose→elicit→collect (MITRE Engage); por que
alta fidelidade zera falso-positivo. Domínio *Threats/Attacks & Detection*.

---

## Sprint 2 — Detecção & ATT&CK & dashboard (dias 6–9)

**Entregáveis**
- `detection/` (motor em duas camadas, ADR-0004):
  - **Assinaturas declarativas** (`rules/signatures/*.yml`, estilo Suricata/Sigma): variações
    de T1595 (scanning), T1190 (SQLi/traversal/LFI/cmdi), T1078 (uso de honeytoken) — cada
    variação é um arquivo + teste; validador de schema das regras.
  - **Correlação com estado** (`rules/correlation/*.ts`): T1110 brute force (N falhas em X s),
    T1595 scanning (M caminhos sensíveis em janela).
  - `attack-map` + `mappings/`; alerta com muralha `decision`/`advisory`; barramento Redis pub/sub.
- `dashboard/`: servidor WebSocket + UI React/Vite (feed ao vivo, heatmap ATT&CK, contadores,
  MTTD, botão de resposta simulada).
- `traffic-generator/`: cenários sintéticos (brute, scan, sqli, honeytoken-use) com `guard`
  (só alvo local isolado).

**Definition of Done (verificável)** — ✅ **Sprint 2 concluído (2026-07-03)**
- [x] Gerador → alertas ao vivo no dashboard (E2E: cliente WS capturou 12 alertas empurrados,
      cada um com técnica ATT&CK).
- [x] MTTD calculado e exibido; brute force medido em 1987 ms (< 2s).
- [x] Assinaturas + correlação testadas (14 testes detection); mesma sequência → mesmo alerta.
- [~] **Muralha IA:** invariante estrutural provado — a engine só escreve `decision`, nunca
      `advisory` (teste `engine.test.ts`). A comparação completa com/sem `ENRICH_AI` fecha no
      Sprint 4, quando o enriquecimento Ollama é plugado (sem tocar em `decision`).
- [x] 4 técnicas distintas acesas: T1078, T1110, T1190, T1595.

**Momento de aprendizado:** telemetria bruta → threat intelligence mapeada (log vs detecção).
Domínio *Security Operations*.

---

## Sprint 3 — Pipeline DevSecOps & gates (dias 10–12)

**Entregáveis**
- `.github/workflows/security-gates.yml` com os 6 gates do ADR-0007 (Semgrep, Trivy fs+image,
  Gitleaks, Hadolint+Checkov, suíte própria) + `ci.yml`.
- As 10 vulnerabilidades plantadas (PLANO §5), isoladas por flag/branch.
- `security/PLANTED_VULNS.md` (tabela vuln × gate + como reproduzir).

**Definition of Done (verificável)**
- [ ] PR com as vulns → pipeline **falha nos gates certos** e bloqueia merge.
- [ ] Remover as vulns → pipeline **passa** (100% verde no branch limpo).
- [ ] Cada uma das 10 vulns tem um teste "vuln presente → gate esperado falha".

**Momento de aprendizado:** shift-left; cada classe de gate (SAST/SCA/secret/container/IaC) pega
uma classe distinta de falha. Domínio *Governance/DevSecOps*.

---

## Sprint 4 — Resposta, IA & polimento (dias 13–14, buffer/stretch)

**Entregáveis**
- Gancho D3FEND/SOAR: resposta simulada (bloquear IP / isolar sessão) + dwell time.
- Enriquecimento IA via Ollama local (opt-in, fallback determinístico) — ADR-0006.
- `docs/ATTACK_COVERAGE.md`, `docs/METRICS.md`, `mappings/nist-800-53.md`.
- Checklist de pré-publicação (adaptado do `ai-pentest-lab`), vídeo/GIF de demo.

**Definition of Done (verificável)**
- [ ] Matriz de cobertura ATT&CK preenchida; métricas (MTTD, detecções únicas) exibidas.
- [ ] Com `ENRICH_AI=true`, alerta ganha resumo/sugestão; com Ollama ausente, fallback funciona
      e a detecção não trava.
- [ ] Repo pronto para portfólio (README, demo, checklist ético ok).

**Momento de aprendizado:** amarrar detecção → resposta (D3FEND) e comunicar impacto com métricas
(MTTD, dwell time) — a linguagem de um SOC/entrevistador.

---

## Métricas de sucesso (do PLANO §8, aferidas ao longo dos sprints)

| Métrica | Alvo |
|---|---|
| MTTD | < 2 s |
| Detecções únicas | ≥ 8 cenários |
| Cobertura ATT&CK | ≥ 4 técnicas (T1595, T1190, T1110, T1078) |
| Falso-positivo | ≈ 0 |
| Gates passando | 100% sem vulns; falha determinística com vulns |
| Vulns plantadas pegas | 10/10 |
| Cobertura de teste do detection engine | 100% |
