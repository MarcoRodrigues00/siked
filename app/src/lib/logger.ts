import winston from 'winston';
import { config } from '../config/index.js';

/**
 * Log estruturado em JSON. O ingest (camada 3) consome logs estruturados;
 * texto livre não é parseável de forma confiável. Nunca logar segredo/PII cru.
 */
export const logger = winston.createLogger({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'app' },
  transports: [new winston.transports.Console()],
  silent: config.NODE_ENV === 'test',
});
