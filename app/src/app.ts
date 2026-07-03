import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { httpLogger } from './middlewares/httpLogger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { router } from './routes/index.js';

/**
 * Monta o app Express com a camada de controles do "lado certo":
 * Helmet (headers) · body cap · rate-limit · validação (Zod nas rotas) ·
 * log estruturado · errorHandler que não vaza stack.
 *
 * A ordem importa: segurança e limites ANTES das rotas; notFound e
 * errorHandler por último.
 */
export function createApp() {
  const app = express();

  // não anunciar o framework
  app.disable('x-powered-by');
  // confiar no proxy da rede docker para obter o IP real de origem
  app.set('trust proxy', 1);

  // headers de segurança
  app.use(helmet());

  // body cap: rejeita payloads acima do limite (protege memória)
  app.use(express.json({ limit: config.BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: config.BODY_LIMIT }));

  // rate limit global
  app.use(
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(httpLogger);

  app.use(router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
