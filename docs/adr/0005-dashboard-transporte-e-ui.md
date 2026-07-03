# ADR-0005 — Transporte (WebSocket) e stack de UI do dashboard

- **Status:** Accepted
- **Data:** 2026-07-03
- **Decisores:** Marco
- **Sprint:** Sprint 2

## Contexto

O dashboard precisa fazer **push ao vivo** de alertas (feed em tempo real, heatmap ATT&CK,
contadores, MTTD) — pull/polling não serve à narrativa "detecção em tempo real". A UI é peça de
portfólio: será gravada em vídeo/GIF (PLANO §7 Sprint 4), então o polimento visual importa. O
dashboard também é o único componente do core que um browser humano precisa alcançar.

## Decisão

- **Transporte:** WebSocket. O serviço `dashboard` assina o barramento Redis (ADR-0003),
  calcula MTTD e faz push dos alertas para os clientes conectados.
- **UI:** **React + Vite** (SPA), buildada e servida como estáticos pelo próprio serviço
  `dashboard`. Componentes: feed ao vivo, heatmap de técnicas ATT&CK, cartões de contadores,
  painel de MTTD e botão de resposta simulada (D3FEND/SOAR).
- **Exposição de rede:** o `dashboard` é o **único** serviço do core com porta publicada (o
  console do SOC). Ele fica em `siked_core` para receber alertas e expõe apenas a porta da UI
  para a rede de gerência — nunca abre rota de saída do core (ver ADR-0008).

## Alternativas consideradas

- **Vanilla HTML/JS** — zero build, mais rápido de subir; rejeitado porque heatmap + feed
  polido rendem mais em vídeo de portfólio e React é skill demonstrável.
- **Server-rendered (EJS/HTMX)** — meio-termo sem SPA; rejeitado por dar menos controle sobre a
  visualização do heatmap/animações do feed.
- **SSE em vez de WebSocket** — suficiente para push unidirecional, mas o botão de resposta quer
  canal bidirecional; WebSocket cobre os dois sentidos.

## Consequências

- **Positivas:** experiência ao vivo convincente; UI apresentável para demo; um único ponto de
  exposição do core, fácil de raciocinar em termos de contenção.
- **Negativas / trade-offs:** toolchain de frontend (Vite/build) adiciona complexidade de CI e
  um passo de build no Dockerfile do dashboard.
- **Mitigação:** build multi-stage no Dockerfile (compila a SPA, serve estáticos); a UI é
  read-only quanto a dados sensíveis (só consome alertas já sanitizados).
