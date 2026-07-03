import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';

const app = createApp();

const server = app.listen(config.APP_PORT, () => {
  logger.info('app_listening', { port: config.APP_PORT, env: config.NODE_ENV });
});

// desligamento gracioso (o container envia SIGTERM)
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    logger.info('shutdown', { signal: sig });
    server.close(() => process.exit(0));
  });
}
