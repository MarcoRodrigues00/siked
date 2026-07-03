# ADR-0004 — Design do motor de detecção (assinaturas + correlação + ATT&CK)

- **Status:** Accepted
- **Data:** 2026-07-03
- **Decisores:** Marco
- **Sprint:** Sprint 2
- **Revisões:** 2026-07-03 — separado em duas camadas (assinatura declarativa estilo
  Snort/Suricata/Sigma + correlação com estado) e formalizada a muralha decisão × IA.

## Contexto

A detecção precisa ser **determinística** — a regra decide, a IA nunca (PLANO §1.7). Precisa
mapear cada alerta para MITRE ATT&CK, sugerir uma contramedida D3FEND, e correlacionar eventos
numa janela temporal (ex.: "5 logins falhos em 10s"), não só casar evento a evento. Cada regra
tem que ser testável isoladamente (cobertura = 100%, PLANO §8).

Dois pontos que a versão inicial deste ADR tratava de forma rasa:

1. **Cobertura por assinatura.** Um punhado de regras escritas em código não é como a indústria
   faz detecção de assinatura. Snort/Suricata (rede) e Sigma (log) usam **regras declarativas**:
   o pattern vive num arquivo, não no código, e cada **variação** de uma técnica MITRE é mais uma
   regra — não mais um `if`. `siked` deve falar essa língua para render em SOC.
2. **Fronteira dura entre a decisão da engine e o que a IA aponta.** "A IA não decide" precisa
   ser um **invariante estrutural verificável**, não uma promessa no texto: o alerta tem que
   separar fisicamente o veredito determinístico do palpite da IA.

## Decisão

### Motor em duas camadas

**Camada A — Regras de assinatura (declarativas, estilo Suricata/Sigma).** Casamento
**stateless** por requisição. Cada regra é um arquivo em `detection/rules/signatures/*.yml` — o
pattern é dado, não código. Adicionar uma variação MITRE = adicionar um arquivo + seu teste.
Formato inspirado em Suricata (`msg`, condições de match, `metadata`), adaptado à camada HTTP/app
(não é pacote de rede):

```yaml
- id: sig-sqli-union-001
  msg: "SQLi UNION-based em parâmetro de query"
  match:                          # todas as condições em AND
    method: [GET, POST]
    path_re: ".*"
    payload_re: "(?i)union\\s+select|'\\s+or\\s+'1'\\s*=\\s*'1"
  attack: { tactic: TA0001, technique: T1190 }
  d3fend: "D3-IAA (isolar/analisar requisição); bloquear IP de origem"
  severity: high
  references: [ "OWASP-A03", "CWE-89" ]
```

Muitas assinaturas, agrupadas por técnica, cobrem as **variações**: T1595 (scanning: `/admin`,
`/wp-login.php`, `/.env`, `/phpmyadmin`, sequência de 404s), T1190 (SQLi union/boolean/error,
path traversal `../`, LFI, cmd injection `;|&&`), T1078 (uso de honeytoken). O engine mantém as
regras num set indexado por técnica; um validador de schema roda no CI.

**Camada B — Regras de correlação (com estado, em código).** O que assinatura sozinha não pega:
comportamento em **janela**. Ficam em `detection/rules/correlation/*.ts` com o contrato:

```
CorrelationRule = {
  id, description,
  attack: { tactic, technique },
  d3fend, severity,
  evaluate(event, window) -> Decision | null
}
```

Ex.: T1110 brute force (N falhas em X s por `src_ip`), T1595 scanning (M caminhos sensíveis
distintos numa janela). Janelas deslizantes por `src_ip` (+ `honeypot_id`) em memória,
reidratadas do índice SQLite no boot.

**Pipeline:** `evento → matcher de assinatura (A) → correlação (B) → Alerta`. Determinismo total:
mesma sequência de eventos → mesmos alertas, sem aleatoriedade. ATT&CK/D3FEND resolvidos por
tabelas em `mappings/` (dados desacoplados de código).

### Muralha decisão × IA (invariante estrutural)

O alerta separa fisicamente o que a engine determinística decidiu do que a IA anexou:

```
Alert = {
  decision: {                     // AUTORITATIVO — só a engine (camada A/B) escreve
    rule_id, engine: 'signature' | 'correlation',
    attack: { tactic, technique },
    severity, d3fend, evidence,
    confidence: 'deterministic'
  },
  advisory?: {                    // NÃO-AUTORITATIVO — só a IA (ADR-0006), opcional, rotulado
    source: 'ai',
    summary, suggested_response,
    disclaimer: 'não influencia decisão nem severidade'
  }
}
```

Invariantes (viram teste): (1) `severity`, `technique` e a existência do alerta dependem **só**
de `decision`; (2) a engine **nunca lê** `advisory` de volta — remover `advisory` inteiro não
muda nenhum alerta nem métrica; (3) `advisory` só é preenchido depois do alerta já existir, fora
de banda (ADR-0006). Isso torna "a IA não decide" **demonstrável**: roda-se a demo com e sem
`ENRICH_AI` e o conjunto de detecções é byte-a-byte idêntico.

## Alternativas consideradas

- **Só regras hardcoded em TS (versão inicial deste ADR)** — pouca cobertura; cada variação
  MITRE exigia código novo. Rejeitado: não escala e não fala a língua de assinatura da indústria.
- **Rodar Snort/Suricata de verdade** — engines de **pacote de rede**; `siked` detecta na camada
  HTTP via evento normalizado, não em pacotes. Rodar o binário completo é peso e fora de escopo.
  Reaproveitamos o **formato/mentalidade de assinatura**, não o daemon.
- **Sigma puro (SIEM)** — ótimo para log/SIEM; usado como **inspiração** do formato declarativo,
  mas o casamento é feito pelo nosso matcher sobre o evento canônico.
- **Deixar a IA participar da decisão/severidade** — rejeitado explicitamente; é a razão de ser
  da muralha `decision`/`advisory`. IA é enriquecimento (ADR-0006), nunca detecção.

## Consequências

- **Positivas:** cobertura ampla via muitas assinaturas declarativas (nova variação MITRE = novo
  YAML + teste, sem tocar no engine); vocabulário Snort/Suricata/Sigma rende em entrevista;
  correlação com estado pega o que assinatura não pega; a muralha decisão × IA é **auditável e
  demonstrável** (mesma detecção com/sem IA); MTTD baixo (avaliação em stream, não polling).
- **Negativas / trade-offs:** dois motores para manter (assinatura + correlação); regex de
  assinatura mal escrito pode gerar falso-positivo; estado de janela se perde no restart.
- **Mitigação:** cada assinatura tem teste (input que casa / que não casa) + validador de schema
  no CI; o design de isca invisível já mantém FP≈0 (todo tráfego na isca é adversário);
  reidratar janelas do SQLite no boot e manter janelas curtas (segundos a minutos).
