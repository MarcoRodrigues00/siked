import winston from 'winston';
import { config } from './config.js';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { service: 'dashboard' },
  transports: [new winston.transports.Console()],
  silent: config.NODE_ENV === 'test',
});
