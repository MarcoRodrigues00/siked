# 🕸️ siked

> *"Achou que era um alvo fácil? Sike. Você caiu na armadilha."*

`siked` é um **app web real e seguro** que expõe, de propósito, **iscas invisíveis** (honeypots
de baixa interação + honeytokens). Todo toque numa isca é atividade adversária por construção —
usuário legítimo nunca chega lá. Cada evento é **capturado → normalizado → correlacionado por
regras determinísticas → mapeado para MITRE ATT&CK → exibido num dashboard ao vivo (WebSocket)**.
O mesmo repositório entrega um **pipeline DevSecOps** com *security gates* que bloqueiam merge,
cada um calibrado para pegar uma vulnerabilidade plantada de propósito.

**Em uma frase:** construo um app seguro, automatizo a segurança no pipeline, e detecto/engano
quem tenta atacar — em tempo real. (Blue Team + DevSecOps, 50/50.)

O `d` do nome é de *daemon* (`sshd`/`httpd`): `siked` é o processo que escuta quem bate na porta errada.

---

## Arquitetura (multi-serviço, contido por rede)

```
┌──────── siked_edge (exposta na demo) ────────┐        ┌──── siked_mgmt ────┐
│  app (real seguro)   deception (iscas)        │        │  dashboard (UI SOC) │
└───────────────┬──────────────────────────────┘        └──────────▲──────────┘
                │ POST /events (único canal, autenticado)           │ WS push
┌───────────────▼───────── siked_core (internal: sem egress) ───────┴──────────┐
│  ingest → [Redis bus] → detection → dashboard    +  redis   +  ollama(opt-in)  │
│  store: JSONL append-only (SHA-256 encadeado)  +  índice SQLite                │
└───────────────────────────────────────────────────────────────────────────────┘
```

Decisões e trade-offs em [`docs/adr/`](docs/adr/README.md). Contenção detalhada em
[`docs/CONTAINMENT.md`](docs/CONTAINMENT.md). Roadmap executável em [`docs/SPRINTS.md`](docs/SPRINTS.md).

## Stack

Node.js 20 · TypeScript · Express · Helmet · Zod · express-rate-limit · Winston · WebSocket ·
Redis (barramento) · SQLite + JSONL (custódia) · React + Vite (dashboard) · Ollama (IA opt-in) ·
Docker Compose · GitHub Actions.

## Como subir (demo)

```bash
cp .env.example .env
docker compose up --build      # sobe tudo em um comando
# dashboard do SOC:  http://localhost:8080
```

## Frameworks citados

- **MITRE ATT&CK** — cada detecção mapeada a tática/técnica (T1595, T1190, T1110, T1078).
- **MITRE Engage** — *adversary engagement*/deception (expose → elicit → collect).
- **MITRE D3FEND** — contramedidas defensivas; amarra detecção → resposta.
- **OWASP** — Honeypot Project + Top 10 (vulnerabilidades plantadas).
- **NIST SP 800-53 Rev. 5** — controles (SI-4, RA-5, CM-6, AU-*).
- **The Honeynet Project** — referência clássica de honeypots.

## Postura ética

Low-interaction apenas; nunca exposto à internet pública; sem segredos reais nas iscas; gerador
de tráfego aponta **só** para o `siked` local isolado. O dual-use fica contido e documentado.
Ver checklist de pré-publicação (Sprint 4).

## Status

🚧 Em construção — Sprint 0 (fundação & contenção). Ver [`docs/SPRINTS.md`](docs/SPRINTS.md).
