# ADR-0007 — Seleção de ferramentas dos gates de segurança do CI

- **Status:** Accepted
- **Data:** 2026-07-03
- **Decisores:** Marco
- **Sprint:** Sprint 3

## Contexto

O pipeline precisa de 5 classes de gate que **bloqueiam merge**, e cada gate deve barrar ao
menos uma das 10 vulnerabilidades plantadas (PLANO §5). A escolha de ferramenta precisa ser:
gratuita/open-source, rodável em GitHub Actions sem infra paga, e determinística (mesma vuln →
mesma falha, para a demo "com vuln falha / sem vuln passa").

## Decisão

| Gate | Ferramenta | Vulns que barra |
|---|---|---|
| SAST | **Semgrep** (regras OWASP + custom) | V1 SQLi, V2 cmd-injection, V9 path-traversal |
| SCA / deps | **Trivy (fs)** + `npm audit` | V3 dependência com CVE |
| Secret scan | **Gitleaks** | V4 segredo hardcoded |
| Container scan | **Trivy (image)** | V7 CVEs de OS na base |
| IaC / Dockerfile | **Hadolint** + **Checkov** | V5 Dockerfile root, V6 compose misconfig |
| Testes de segurança | **suíte própria (Vitest + supertest)** | V8 header removido, V9, V10 stack leak |

Dois workflows: `ci.yml` (build/lint/testes funcionais) e `security-gates.yml` (os 6 acima).
Todos com `continue-on-error: false` — falha bloqueia.

## Alternativas consideradas

- **CodeQL** no lugar de Semgrep — excelente, mas setup mais pesado e mais lento no free tier;
  Semgrep é mais direto para regras custom didáticas. CodeQL fica citável como upgrade.
- **Grype** no lugar de Trivy — equivalente; Trivy cobre fs + image + IaC numa ferramenta só,
  reduzindo o número de tools.
- **Snyk** — bom, mas exige conta/limite; preferimos 100% OSS sem cadastro.

## Consequências

- **Positivas:** cobertura das 5 classes + suíte com ferramentas OSS gratuitas; cada gate tem
  vuln correspondente comprovável (`security/PLANTED_VULNS.md`); Trivy reduz sprawl de tools.
- **Negativas / trade-offs:** múltiplas ferramentas = tempo de CI maior; regras Semgrep custom
  exigem manutenção.
- **Mitigação:** rodar gates em paralelo por job; fixar versões das ferramentas para
  determinismo; cada gate tem um teste "vuln presente → falha esperada".
