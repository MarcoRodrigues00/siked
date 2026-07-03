import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

/**
 * Tratador de erro central. Regra de ouro: detalhe completo vai para o log
 * (server-side); o cliente nunca recebe stack trace nem mensagem interna.
 * O endpoint que VAZA stack (vuln V10) é plantado de propósito em outro lugar,
 * no Sprint 3 — este handler é o "lado certo".
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Validação Zod -> 400
  if (err instanceof ZodError) {
    logger.warn('validation_error', { path: req.path, issues: err.issues });
    return res.status(400).json({ error: 'invalid_request', details: err.flatten() });
  }

  // Body acima do cap (body-parser) -> 413
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    logger.warn('payload_too_large', { path: req.path });
    return res.status(413).json({ error: 'payload_too_large' });
  }

  // JSON malformado -> 400
  if (err?.type === 'entity.parse.failed' || (err?.status === 400 && 'body' in (err ?? {}))) {
    logger.warn('invalid_json', { path: req.path });
    return res.status(400).json({ error: 'invalid_json' });
  }

  const status = Number.isInteger(err?.status) ? err.status : 500;

  // Log completo server-side; resposta ao cliente sem stack/mensagem interna.
  logger.error('unhandled_error', { message: err?.message, stack: err?.stack, status, path: req.path });
  res.status(status).json({ error: status === 500 ? 'internal_error' : 'error' });
};
