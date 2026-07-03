import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../lib/logger.js';

/**
 * Correlaciona cada request com um id e emite uma linha estruturada ao finalizar.
 * Base do que a camada de ingest vai consumir no futuro.
 */
export const httpLogger: RequestHandler = (req, res, next) => {
  const id = randomUUID();
  const start = process.hrtime.bigint();
  res.setHeader('x-request-id', id);

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info('http_request', {
      id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Math.round(ms * 100) / 100,
      ip: req.ip,
    });
  });

  next();
};
