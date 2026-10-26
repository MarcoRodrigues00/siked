# 🕸️ PLANO — Plano de Arquitetura do siked

> **Status:** plano (sem código ainda). Próximo passo = esqueleto de código no Vibez.
> **Autor do briefing:** Marco · **Escopo:** 1–2 semanas · **Posicionamento:** AppSec / DevSecOps (SOC como porta de entrada)
> **Tagline:** *"Achou que era um alvo fácil? Sike. Você caiu na armadilha."*

---

## 0. Resumo executivo

`siked` é um **app web real e seguro** que expõe, de propósito, **iscas invisíveis** (honeypots de baixa interação + honeytokens). Todo toque numa isca é atividade adversária por construção — usuário legítimo nunca chega lá. Cada evento é **capturado de forma estruturada → normalizado → correlacionado por regras → mapeado para MITRE ATT&CK → exibido num dashboard ao vivo (WebSocket)**. O mesmo repositório entrega um **pipeline DevSecOps** com *security gates* que bloqueiam merge, e cada gate foi calibrado para pegar **uma vulnerabilidade plantada de propósito** no app real.

A história em uma frase: **"Eu construo um app seguro, automatizo a segurança no pipeline, e detecto/engano quem tenta atacar — em tempo real."** Isso cobre Blue Team e DevSecOps em 50/50 e conversa diretamente com os três projetos que o Marco já tem publicados.

O `d` do nome é de *daemon* (estilo `sshd`/`httpd`): `siked` é o processo que fica escutando quem bate na porta errada.

---

## 1. Princípios de design (âncora nas referências da indústria)

Estes princípios vêm direto das referências da Seção 4 do briefing e governam todas as decisões abaixo:

1. **Alta fidelidade / falso-positivo ≈ 0.** A isca é invisível ao usuário legítimo, então cada evento ≈ atividade adversária real. Isto é a razão de o honeypot existir: alerta de altíssima confiança. Fonte: MITRE Engage (*expose → elicit → collect*), The Honeynet Project.
2. **O valor está no mapeamento ATT&CK.** Alertas isolados viram *threat intelligence* que "fala a mesma língua" do resto do stack de segurança. Sem o mapeamento, é só log.
3. **Baixa interação = seguro e escalável.** Simular a *aparência* de serviços (login/admin/API falsos) sem rodar sistema real por trás. Menor superfície de ataque, contenção trivial. Não emular sistemas completos.
4. **Honeypot ≠ honeytoken — usar os dois em camadas.** Honeypot = endpoint/serviço falso. Honeytoken = dado falso (credencial/chave/arquivo) que dispara alerta quando **usado**. `siked` usa ambos, em camadas diferentes.
5. **Detecção amarrada a resposta (D3FEND).** Cada detecção mapeia para uma contramedida defensiva concreta (ex.: isolar IP, bloquear sessão), mesmo que a resposta seja simulada/*SOAR-like* na demo.
6. **Segurança do próprio honeypot é ponto de maturidade.** Rede Docker dedicada, sem rota para rede interna, contenção documentada. Um honeypot mal isolado vira pivô para o atacante — por isso o isolamento é documentado e testado.
7. **Enriquecimento por IA (tendência 2026).** Camada opcional *SOAR-like* que resume/classifica eventos com LLM — mas **nunca** é o que decide a detecção (a regra determinística decide; a IA só enriquece/explica).

---

## 2. Arquitetura em camadas

Seis camadas, do tráfego de entrada ao pipeline que protege o próprio repo. Cada uma tem uma responsabilidade única e uma fronteira de confiança clara.

### Camada 1 — App real seguro (`app/`)
O produto "de verdade": um app web pequeno, funcional e **deliberadamente bem-feito** em segurança, para contrastar com as iscas. É o mesmo padrão do `portal-academico-seguro`: Node.js + Express + TypeScript, Helmet (headers), Zod (validação de entrada), `express-rate-limit`, body cap, JWT/JWKS, Winston (log estruturado JSON). Serve para (a) dar contexto realista ao atacante e (b) hospedar as vulnerabilidades plantadas que o pipeline vai pegar.

### Camada 2 — Decepção / honeypot (`deception/`)
As iscas. **Baixa interação**: endpoints que *parecem* reais mas não têm sistema por trás — só coletam e respondem de forma verossímil.
- **Honeypots (endpoints falsos):** `/admin`, `/wp-login.php`, `/.env`, `/api/v1/keys`, `/backup.zip`, `/phpmyadmin` — rotas clássicas de scanning que nenhum usuário legítimo do app pediria.
- **Honeytokens (dados falsos):** uma credencial "vazada" plantada num comentário HTML/JS ou num `/.env` falso; uma API key falsa; um registro de usuário-armadilha no "banco". Se qualquer um for **usado** contra o app real, dispara alerta (mapeia para `T1078` Valid Accounts).
- **Responder verossímil:** o honeypot devolve status/latência/headers plausíveis (ex.: um `401` num login falso, um formulário fake) para *elicit* (provocar) mais interação, conforme MITRE Engage — sem nunca executar nada real.

### Camada 3 — Ingest / normalização de eventos (`ingest/`)
Recebe eventos brutos das camadas 1 e 2 (via middleware Express que emite eventos) e os transforma num **schema canônico único**. Um evento normalizado tem sempre: `timestamp`, `src_ip`, `method`, `path`, `user_agent`, `honeypot_id`, `token_id?`, `payload_snippet` (sanitizado/truncado), `raw_signature`. Aqui também acontece a **sanitização** (nunca logar payload completo sem truncar/mascarar) e o *enrichment* leve (geo/ASN opcional, hash do payload para deduplicação). Herda o padrão de log estruturado do Winston e o de *chain-of-custody* (SHA-256) do `ai-pentest-lab`.

### Camada 4 — Motor de detecção (`detection/`)
Consome o stream normalizado e aplica **regras determinísticas** que classificam a atividade e a mapeiam para **MITRE ATT&CK**. Cada regra emite um *alerta* com: técnica ATT&CK, severidade, contramedida D3FEND sugerida, e a evidência normalizada. Exemplos de regras:
- N tentativas de login no honeypot em X segundos → `T1110` Brute Force.
- Assinatura de SQLi/path traversal em endpoint-isca → `T1190` Exploit Public-Facing Application.
- Sequência de GETs a caminhos sensíveis conhecidos → `T1595` Active Scanning.
- Uso de honeytoken plantado → `T1078` Valid Accounts.
- **Camada IA opcional (enriquecimento, não decisão):** um resumo em linguagem natural do incidente e uma sugestão de resposta, gerados por LLM local, anexados ao alerta. A detecção em si continua determinística.

### Camada 5 — Dashboard ao vivo (`dashboard/`)
Servidor **WebSocket** que faz push dos alertas para uma UI em tempo real. Mostra: feed de eventos ao vivo, mapa de calor de técnicas ATT&CK, contadores (detecções únicas, IPs distintos, cobertura ATT&CK), e o **MTTD** por incidente. Um botão "resposta" (simulada) demonstra o gancho D3FEND/SOAR: "bloquear IP", "isolar sessão".

### Camada 6 — Pipeline DevSecOps (`.github/workflows/` + `security/`)
GitHub Actions com *security gates* que **bloqueiam merge**. Cada gate é calibrado para pegar pelo menos uma vulnerabilidade plantada (Seção 5). Ordem: lint/build → SAST → SCA/deps → secret scan → container scan → IaC/Dockerfile lint → testes de segurança. Herda o padrão de CI + suíte de testes de segurança do ClinicBridge (64 testes) e do `ai-pentest-lab` (suíte automatizada, 232 checks).

### Fronteiras de confiança (containment)
```
┌─────────────────────────── rede docker: siked_edge (exposta só na demo) ───────────────────────────┐
│   app (real seguro)      deception (iscas)                                                           │
│        └──────────────────────┴────────── emitem eventos ─────────┐                                 │
└────────────────────────────────────────────────────────────────── │ ──────────────────────────────┘
                                                                     ▼
┌─────────────────────── rede docker: siked_core (INTERNA, sem rota p/ fora) ─────────────────────────┐
│   ingest → detection → dashboard(WS) → (storage: SQLite/JSONL append-only)                          │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```
Regra de ouro de contenção: a rede das iscas **nunca** alcança a rede interna nem a rede do host. As iscas não têm segredos reais, não montam volumes sensíveis, rodam como usuário não-root, com `read_only` filesystem onde possível.

---

## 3. Diagrama textual do fluxo (ataque → dashboard)

```
                 (1) ATAQUE
   atacante / scanner / gerador sintético
   GET /admin · POST /wp-login · SQLi ?id=1' OR '1'='1 · usa cred "vazada"
                     │
                     ▼
                 (2) CAPTURA                          [Camada 1/2: app + deception]
   middleware Express intercepta a requisição na isca
   → monta evento bruto {ip, método, path, headers, body, ua, ts}
                     │
                     ▼
                 (3) NORMALIZAÇÃO                      [Camada 3: ingest]
   valida + sanitiza (trunca/mascara payload) + deduplica (hash)
   → EVENTO CANÔNICO {timestamp, src_ip, honeypot_id, token_id?, signature, ...}
   → grava append-only (chain-of-custody SHA-256) em JSONL/SQLite
                     │
                     ▼
                 (4) REGRA DE DETECÇÃO                 [Camada 4: detection]
   engine avalia regras determinísticas contra o evento/janela
   ex.: 5 logins falhos em 10s no honeypot  →  regra "brute_force" dispara
                     │
                     ▼
                 (5) MAPEAMENTO ATT&CK                 [Camada 4: detection]
   regra anexa: tática+técnica (ex. TA0006 / T1110 Brute Force),
   severidade, contramedida D3FEND, (opcional) resumo IA
   → ALERTA estruturado
                     │
                     ▼
                 (6) ALERTA / PUSH                     [Camada 5: dashboard]
   alerta publicado no barramento → WebSocket push
   → calcula MTTD (t_deteccao − t_primeiro_evento)
                     │
                     ▼
                 (7) DASHBOARD AO VIVO                 [Camada 5: UI]
   feed em tempo real · heatmap ATT&CK · contadores · MTTD
   · botão "resposta" (D3FEND/SOAR simulado: bloquear IP / isolar sessão)

   ════════════════════════════════════════════════════════════════════
   Trilha paralela (protege o próprio repo):

   git push / PR  →  GitHub Actions  →  [SAST · SCA · secret · container · IaC · testes]
                                              │
                                    qualquer gate falha  →  MERGE BLOQUEADO
```

---

## 4. Mapa de referência conceitual (aplicação construída do zero)

> **Decisão de projeto:** o `siked` é escrito **do zero**. **Não** se copia código do `portal-academico-seguro` nem de nenhum outro projeto. Os repositórios existentes servem só como **referência conceitual** — decisões de arquitetura e padrões que o Marco **re-implementa por conta própria** (aprende fazendo). Isto mantém o repo limpo, sem herança de licença/estilo alheios, e transforma cada padrão num exercício de domínio real — em vez de colar código pronto.

Inventário real feito na pasta `Ciber`. Os repositórios estão em `ExpCriativa 5 periodo/repos-publicos/`; ClinicBridge está como documentação-mestre. A coluna final descreve **o que aprender / re-derivar**, nunca "copiar".

### 4.1 — `portal-academico-seguro` → referência do App real seguro + vocabulário Blue Team
Stack observada no `backend/package.json` (Express + TS + Prisma + Helmet + Zod + jsonwebtoken/jwks-rsa + express-rate-limit + Winston). Serve para **decidir a stack** e ver *como* os controles foram ligados — o código do `siked` é novo.

| Padrão observado | Onde está (referência) | O que re-derivar do zero no `siked` |
|---|---|---|
| Auth JWT/JWKS (issuer, cache de chave) | `backend/src/middlewares/auth.ts` | Escrever a própria auth do app real, decidindo se usa JWT próprio simples ou IdP — sem herdar o middleware. |
| Log estruturado JSON | `backend/src/lib/logger.ts` (Winston) | Definir o schema de log/evento do zero; entender *por que* JSON estruturado ajuda o ingest. |
| Helmet + Zod + rate-limit + body cap | `backend/src/app.ts` | Reconstruir a camada de controles do app real (o "lado certo" que contrasta com as iscas). |
| errorHandler sem vazar stack | `backend/src/middlewares` | Implementar o próprio — e um endpoint que **de propósito** vaza (vuln V10). |
| Docker + `docker-compose` + segmentação | `infra/docker-compose.yml` | Escrever compose novo com as redes `siked_edge`/`siked_core`. |
| Wazuh/ModSecurity/Grafana/Prometheus (WAF 403/429) | README/CLAUDE.md (topologia) | Vocabulário de SIEM/dashboard/alerta que o `siked` reimplementa em miniatura própria. |

### 4.2 — `ai-pentest-lab` → referência de guardrails, assinaturas e enriquecimento
Observado em `LAB-0.3/aipentest/`: módulos `xss/sqli/csrf/ssrf/cmdi/lfi/bruteforce`, `guard`, `audit` (SHA-256), `llm` (planner + fallback), `report` (CWE/CVSS/OWASP). Usado como **mapa mental**, não como biblioteca.

| Padrão observado | Onde está (referência) | O que re-derivar do zero no `siked` |
|---|---|---|
| Assinaturas de ataque (SQLi/XSS/brute...) | `aipentest/modules/*` | Escrever um **gerador de tráfego sintético novo** e simples; as assinaturas informam *o que* o motor de detecção precisa reconhecer. |
| Guardrails (escopo, kill-switch, budget) | `aipentest/guard.py` | Reimplementar contenção do gerador: só aponta para o `siked` local isolado. |
| Chain-of-custody SHA-256 | `aipentest/audit.py` | Projetar o próprio store append-only com hash — entendendo a garantia de integridade. |
| Enriquecimento CWE/CVSS/OWASP | `aipentest/report.py`, `vulninfo.py` | Anexar CWE/CVSS aos alertas com tabela própria. |
| Planner LLM local + fallback | `aipentest/llm.py` | Desenhar a camada IA de enriquecimento nova, com fallback determinístico. |
| Suíte de testes | `LAB-0.3/tests/*` | Escrever testes próprios (cada regra de detecção tem teste). |
| Postura ética / pré-publicação | `checklist/PRE-PUBLICACAO.md` | Reescrever o checklist de pré-publicação adaptado ao `siked`. |

### 4.3 — `ClinicBridge` → referência de padrões de segurança de aplicação (docs-mestre)
De `ClinicBridge_Documentacao_Mestre.md`: audit append-only (RS12), PII masking (RS/RP), rate-limit login/upload (RS10), 64 testes de segurança + CI, requisitos OWASP/CIAA (RS01–RS12), LGPD. Referência de *o que um app maduro faz*.

| Padrão observado | Referência | O que re-derivar do zero no `siked` |
|---|---|---|
| Honeytoken = "credencial vazada" | conceito de PII/credencial sensível | Projetar dados falsos realistas (sem ser reais). |
| Auditoria append-only (RS12) | RS12 / RP08 | Modelo próprio de armazenamento imutável "quem/o quê/quando". |
| Suíte de testes de segurança + CI | RNF08 | Escrever o gate de testes de segurança do pipeline. |
| Rate-limit login/upload (RS10) | RS10 | Controle no app real (contraste) e gatilho de detecção nas iscas. |
| PII masking | RS/RP | Escrever a sanitização de payload na camada de ingest. |

### 4.4 — Outros ativos úteis na pasta
`ESP32_Mini_Firewall_Gateway` e a pasta `Respostas a Incidentes de Ciber` alimentam a **narrativa** de resposta a incidente (passo D3FEND/SOAR) e a documentação de contenção — como referência, não código.

---

## 5. Vulnerabilidades plantadas de propósito × gate que pega cada uma

Regra: **cada vulnerabilidade plantada existe para provar que um gate funciona.** Todas ficam no app real (`app/`), isoladas por flag/branch, documentadas em `security/PLANTED_VULNS.md`, e **cada uma tem um teste que confirma que o gate a barra**. As iscas (`deception/`) *não* contam como vulnerabilidade — são features.

| # | Vulnerabilidade plantada | Onde | Classe | Gate que pega | Ferramenta | MITRE ATT&CK relacionado |
|---|---|---|---|---|---|---|
| V1 | Query SQL concatenada (SQLi) num endpoint do app | `app/src/routes` | OWASP A03 / CWE-89 | **SAST** | Semgrep / CodeQL | T1190 |
| V2 | `child_process.exec` com input do usuário (cmd injection) | `app/src/routes` | OWASP A03 / CWE-78 | **SAST** | Semgrep / CodeQL | T1190 |
| V3 | Dependência npm com CVE conhecido (versão vulnerável fixada) | `app/package.json` | OWASP A06 / CWE-1035 | **SCA / deps** | Trivy / Grype / `npm audit` | — |
| V4 | Segredo hardcoded (API key / JWT secret no código) | `app/src/config` | OWASP A07 / CWE-798 | **Secret scan** | Gitleaks | T1552 (Unsecured Credentials) |
| V5 | Dockerfile roda como root + `latest` + sem `USER` | `app/Dockerfile` | CWE-250 / misconfig | **Dockerfile/IaC lint** | Hadolint | — |
| V6 | `docker-compose` com porta sensível exposta / capability extra | `docker-compose.yml` | misconfig | **IaC scan** | Checkov | — |
| V7 | Imagem base com CVEs de OS (ex.: base desatualizada) | imagem buildada | OWASP A06 | **Container scan** | Trivy (image) | — |
| V8 | Header de segurança removido num handler (regressão) | `app/src/app.ts` | OWASP A05 / CWE-693 | **Teste de segurança** | suíte própria (supertest) | — |
| V9 | Path traversal em rota de download (`../`) | `app/src/routes` | OWASP A01 / CWE-22 | **SAST + teste** | Semgrep + teste | T1190 |
| V10 | Endpoint que vaza stack trace / info sensível em erro | `app/src/middlewares` | OWASP A05 / CWE-209 | **Teste de segurança** | suíte própria | T1592 (recon) |

Cobertura dos gates mínimos exigidos no briefing: SAST (V1, V2, V9) · SCA/deps (V3) · secret scan (V4) · container scan (V7) · IaC/Dockerfile lint (V5, V6) · testes de segurança (V8, V9, V10). Todos os cinco gates + a suíte têm ao menos uma vuln correspondente. ✔

---

## 6. Estrutura de pastas proposta

```
siked/
├─ README.md                      # história + frameworks (ATT&CK/Engage/D3FEND/OWASP/NIST) citados
├─ docker-compose.yml             # sobe tudo: um "docker compose up"; redes siked_edge + siked_core
├─ .env.example
├─ .github/
│  └─ workflows/
│     ├─ ci.yml                   # build + lint + testes
│     └─ security-gates.yml       # SAST · SCA · secret · container · IaC (bloqueiam merge)
│
├─ app/                           # CAMADA 1 — app real seguro (Node/TS/Express, do zero)
│  ├─ src/
│  │  ├─ app.ts                   # Helmet, Zod, rate-limit, body cap  (ref: portal-academico)
│  │  ├─ routes/                  # rotas legítimas + vulns plantadas (V1,V2,V9,V10)
│  │  ├─ middlewares/             # auth JWT, errorHandler             (ref: portal-academico)
│  │  └─ lib/logger.ts            # log estruturado JSON               (ref: portal-academico)
│  ├─ Dockerfile                  # vuln plantada V5
│  └─ package.json                # vuln plantada V3
│
├─ deception/                     # CAMADA 2 — honeypots + honeytokens
│  ├─ honeypots/                  # /admin /wp-login /.env /api/v1/keys ... (low-interaction)
│  ├─ honeytokens/                # credenciais/keys/PII falsas plantadas + registro
│  └─ responder.ts                # respostas verossímeis (Engage: expose→elicit)
│
├─ ingest/                        # CAMADA 3 — normalização
│  ├─ schema.ts                   # evento canônico
│  ├─ sanitize.ts                 # trunca/mascara payload (ref: PII masking ClinicBridge)
│  └─ store.ts                    # append-only JSONL/SQLite + SHA-256 (ref: ai-pentest audit)
│
├─ detection/                     # CAMADA 4 — motor de regras + ATT&CK
│  ├─ rules/                      # brute_force.ts, sqli.ts, scanning.ts, honeytoken.ts ...
│  ├─ attack-map.ts               # técnica → tática, severidade, D3FEND
│  ├─ enrich-ai.ts                # camada IA opcional (ref: ai-pentest llm.py) + fallback
│  └─ engine.ts
│
├─ dashboard/                     # CAMADA 5 — WebSocket + UI
│  ├─ server.ts                   # WS push (compatível Vibez/AgentHub)
│  └─ ui/                         # feed, heatmap ATT&CK, MTTD, botão resposta (D3FEND/SOAR)
│
├─ traffic-generator/             # gerador de ataque sintético p/ demo (ref: ai-pentest modules)
│  ├─ scenarios/                  # brute, scan, sqli, honeytoken-use
│  └─ guard.ts                    # só alvo local/isolado (ref: ai-pentest guard.py)
│
├─ security/                      # artefatos DevSecOps
│  ├─ PLANTED_VULNS.md            # tabela vuln × gate (Seção 5) + como reproduzir
│  ├─ semgrep/  gitleaks/  checkov/  hadolint/   # configs dos gates
│  └─ tests/                      # testes de segurança (V8,V9,V10) (ref: ClinicBridge/ai-pentest)
│
├─ docs/
│  ├─ ARCHITECTURE.md             # este plano, refinado
│  ├─ ATTACK_COVERAGE.md          # matriz de cobertura ATT&CK
│  ├─ CONTAINMENT.md              # isolamento do honeypot (ponto de maturidade)
│  └─ METRICS.md                  # MTTD, detecções únicas, etc.
└─ mappings/
   ├─ mitre-attack.json           # técnicas usadas
   ├─ mitre-d3fend.json           # contramedidas
   └─ nist-800-53.md              # controles mapeados (peso enterprise)
```

---

## 7. Roadmap de sprints (1–2 semanas)

Divisão em 4 sprints curtos (~2–4 dias cada). Cada sprint tem entregável demonstrável e um **momento de aprendizado** que reforça o posicionamento AppSec/DevSecOps/SOC — e conversa com o Security+ (SY0-701) que o Marco faz semana que vem.

### Sprint 0 — Fundação & contenção (dias 1–2)
Entregáveis: `docker-compose.yml` com redes `siked_edge`/`siked_core`, esqueleto do `app/` seguro **escrito do zero** (stack decidida com base no `portal-academico-seguro`, sem copiar código), `README` com os frameworks citados, `docs/CONTAINMENT.md`.
Definição de pronto: `docker compose up` sobe o app real; app real passa nos controles básicos (Helmet/Zod/rate-limit).
**Momento de aprendizado:** segmentação de rede e princípio de contenção — por que um honeypot mal isolado é pior que não ter honeypot (vira pivô). Casa com o domínio *Architecture & Design* do Security+.

### Sprint 1 — Decepção & ingest (dias 3–5)
Entregáveis: camada `deception/` (5–7 honeypots low-interaction + 2–3 honeytokens), camada `ingest/` (schema canônico, sanitização, store append-only com SHA-256).
Definição de pronto: bater numa isca gera um evento normalizado e persistido; usuário legítimo do app real nunca gera evento.
**Momento de aprendizado:** honeypot vs honeytoken, e *expose→elicit→collect* (MITRE Engage). Por que alta fidelidade zera falso-positivo. Casa com *Threats/Attacks & Detection*.

### Sprint 2 — Detecção & ATT&CK & dashboard (dias 6–9)
Entregáveis: motor `detection/` com 4–5 regras (`T1595`, `T1190`, `T1110`, `T1078`), `attack-map.ts`, dashboard WebSocket ao vivo, `traffic-generator/` para popular a demo.
Definição de pronto: rodar o gerador sintético → alertas aparecem no dashboard em tempo real, cada um com técnica ATT&CK e MTTD calculado.
**Momento de aprendizado:** transformar telemetria bruta em *threat intelligence* mapeada — a diferença entre "log" e "detecção". Introduzir a camada IA de enriquecimento (opcional). Casa com *Security Operations*.

### Sprint 3 — Pipeline DevSecOps & gates (dias 10–12)
Entregáveis: `.github/workflows/security-gates.yml` com os 5 gates + testes; as 10 vulnerabilidades plantadas (Seção 5); `security/PLANTED_VULNS.md`; comprovação de que cada gate barra sua vuln.
Definição de pronto: abrir um PR com as vulns → pipeline falha nos gates certos e bloqueia merge; remover as vulns → pipeline passa.
**Momento de aprendizado:** *shift-left* — mover a segurança para o pipeline; cada tipo de gate (SAST vs SCA vs secret vs container vs IaC) pega uma classe distinta de falha. Casa com *Governance/DevSecOps*.

### Sprint 4 (buffer/stretch) — Polimento, resposta & documentação (dias 13–14)
Entregáveis: ganho D3FEND/SOAR (resposta simulada), `docs/ATTACK_COVERAGE.md` + `docs/METRICS.md`, mapeamento NIST 800-53, checklist de pré-publicação (reuso do `ai-pentest-lab`), vídeo/GIF de demo.
Definição de pronto: matriz de cobertura ATT&CK preenchida; métricas de sucesso exibidas; repo pronto para portfólio.
**Momento de aprendizado:** amarrar detecção → resposta (D3FEND) e comunicar impacto com métricas (MTTD, dwell time) — a linguagem que um SOC/entrevistador entende.

---

## 8. Métricas de sucesso

Métricas que impressionam em entrevista e provam que o projeto funciona. Exibidas no dashboard e resumidas em `docs/METRICS.md`.

| Métrica | Definição | Alvo na demo |
|---|---|---|
| **MTTD** (Mean Time To Detect) | tempo médio entre 1º evento de um incidente e o alerta disparado | < 2 s (regras determinísticas em stream) |
| **Detecções únicas** | nº de incidentes distintos correlacionados (não eventos brutos) | ≥ 8 cenários distintos gerados |
| **Cobertura ATT&CK** | nº de técnicas detectadas / técnicas visadas | ≥ 4 técnicas: T1595, T1190, T1110, T1078 |
| **Taxa de falso-positivo** | eventos de usuário legítimo classificados como ataque | ≈ 0 (por design da isca invisível) |
| **% de gates passando** | gates verdes / total, no branch limpo | 100% sem vulns; falha determinística com vulns |
| **Vulns plantadas pegas** | vulns barradas por gate / vulns plantadas | 10/10 |
| **Dwell time simulado** | tempo que o "atacante" fica ativo antes da resposta D3FEND | medido e reduzido pela resposta simulada |
| **Cobertura de teste do detection engine** | regras com teste / total de regras | 100% |

---

## 9. Escopo e não-objetivos (para não virar monstro)

Dentro do escopo: low-interaction honeypots, honeytokens, motor de regras determinístico, dashboard WS, pipeline com 5 gates, gerador sintético, tudo dockerizado e reproduzível com um comando.

**Fora do escopo (v1):** emular sistemas completos / high-interaction honeypots; expor o `siked` na internet pública; ML de detecção treinado (a IA é só enriquecimento, opcional); SOAR real com ações destrutivas (a resposta é simulada); multi-tenant. Isolamento sempre em rede Docker dedicada, sem rota para rede interna, containers não-root, sem segredos reais nas iscas.

**Postura ética / pré-publicação:** reaproveitar o checklist do `ai-pentest-lab` — sem hosts internos, sem payloads crus perigosos, gerador de tráfego aponta só para o próprio `siked` isolado. O que é dual-use fica contido e documentado.

---

## 10. Frameworks citados (para o README — "ouro em entrevista")

- **MITRE ATT&CK** — cada detecção mapeada a tática/técnica (T1595 Active Scanning, T1190 Exploit Public-Facing App, T1110 Brute Force, T1078 Valid Accounts).
- **MITRE Engage** — framework oficial de *adversary engagement*/deception; justifica cada isca (*expose → elicit → collect*).
- **MITRE D3FEND** — contramedidas defensivas; amarra detecção → resposta.
- **OWASP** — *Honeypot Project* (deception) + *Top 10* para escolher as vulnerabilidades plantadas.
- **NIST SP 800-53 Rev. 5** — controles mapeados (SI-4 monitoramento, RA-5, CM-6, AU-* auditoria) — peso "enterprise".
- **The Honeynet Project** — referência clássica de honeypots.

---

## 11. Próximo passo

Com este plano aprovado, o passo seguinte (no Vibez) é gerar o **esqueleto de código**: subir `docker-compose.yml` + `app/` seguro (Sprint 0), depois `deception/` + `ingest/` (Sprint 1). Sugiro começar pelo Sprint 0 exatamente porque a contenção de rede precisa estar certa **antes** de existir qualquer isca.
