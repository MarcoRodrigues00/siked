import express from 'express';
import helmet from 'helmet';
import { timingSafeEqual } from 'node:crypto';
import { ZodError } from 'zod';
import { config } from './config.js';
import { logger } from './logger.js';
import { RawEventInput, normalize } from './normalize.js';
import type { Store } from './store.js';
import type { Publish } from './bus.js';

function tokenMatches(provided: string | undefined): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(config.INGEST_TOKEN);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * App do ingest. Recebe eventos brutos do edge no ÚNICO canal permitido
 * (`POST /events`, autenticado por INGEST_TOKEN — ADR-0003), normaliza,
 * sanitiza e persiste no store append-only.
 */
export function createApp(store: Store, publish: Publish = () => {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '128kb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', events: store.count() });
  });

  // autenticação do canal edge->core
  const auth: express.RequestHandler = (req, res, next) => {
    const header = req.get('x-ingest-token') ?? undefined;
    if (!tokenMatches(header)) {
      logger.warn('ingest_unauthorized', { path: req.path, ip: req.ip });
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  };

  app.post('/events', auth, (req, res, next) => {
    try {
      const input = RawEventInput.parse(req.body);
      const event = normalize(input, {
        nowIso: new Date().toISOString(),
        maxLen: config.PAYLOAD_SNIPPET_MAX,
      });
      const record = store.append(event);
      publish(record); // barramento -> detecção (fire-and-forget)
      logger.info('event_ingested', {
        seq: record.seq,
        src_ip: record.src_ip,
        path: record.path,
        honeypot_id: record.honeypot_id,
      });
      res.status(201).json({ seq: record.seq, hash: record.hash });
    } catch (err) {
      next(err);
    }
  });

  // verificação de custódia (uso interno / demo / testes)
  app.get('/custody/verify', auth, (_req, res) => {
    res.status(200).json(store.verifyChain());
  });

  // 404
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

  // error handler — nunca vaza stack
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      logger.warn('ingest_validation_error', { path: req.path, issues: err.issues });
      return res.status(400).json({ error: 'invalid_event', details: err.flatten() });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'payload_too_large' });
    }
    logger.error('ingest_error', { message: err?.message, stack: err?.stack });
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
