import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

/**
 * Valida `req.body` contra um schema Zod. Em falha, encaminha o ZodError ao
 * errorHandler central (que responde 400 sem vazar detalhe interno).
 */
export const validateBody =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    req.body = parsed.data;
    next();
  };
