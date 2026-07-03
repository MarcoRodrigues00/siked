import express from 'express';
import { resolveBait } from './honeypots.js';
import { findHoneytokenUse } from './honeytokens.js';
import type { Emit } from './emitter.js';

/**
 * App da decepção. TODO toque numa isca é atividade adversária por construção
 * (usuário legítimo nunca chega aqui). Cada requisição:
 *   1. resolve a isca (bait) e emite um evento bruto ao ingest;
 *   2. responde de forma verossímil (expose -> elicit).
 * `/health` é infra e NÃO emite evento.
 */
export function createApp(emit: Emit) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // finge ser um nginx comum (verossimilhança)
  app.use((_req, res, next) => {
    res.setHeader('Server', 'nginx/1.24.0');
    next();
  });

  // corpo cru como texto (p/ payload e varredura de honeytoken), com cap
  app.use(express.text({ type: () => true, limit: '64kb' }));

  // healthcheck de infra — não é isca, não emite
  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  // catch-all: toda requisição vira evento + resposta de isca
  app.use((req, res) => {
    const bait = resolveBait(req.path);
    const rawBody = typeof req.body === 'string' ? req.body : '';
    const ua = req.get('user-agent') ?? '';
    const haystack = `${req.originalUrl}\n${rawBody}\n${ua}\n${req.get('authorization') ?? ''}`;
    const token_id = findHoneytokenUse(haystack);

    emit({
      src_ip: req.ip ?? 'unknown',
      method: req.method,
      path: req.path,
      user_agent: ua,
      honeypot_id: bait.id,
      token_id,
      payload: `${req.method} ${req.originalUrl}\n${rawBody}`.slice(0, 8000),
    });

    bait.handler(req, res);
  });

  return app;
}
