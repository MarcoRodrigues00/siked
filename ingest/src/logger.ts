import winston from 'winston';
import { config } from './config.js';

export const logger = winston.createLogger({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'ingest' },
  transports: [new winston.transports.Console()],
  silent: config.NODE_ENV === 'test',
});
