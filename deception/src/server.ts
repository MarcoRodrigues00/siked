import { config } from './config.js';
import { logger } from './logger.js';
import { makeEmitter } from './emitter.js';
import { createApp } from './app.js';

const emit = makeEmitter();
const app = createApp(emit);

const server = app.listen(config.DECEPTION_PORT, () => {
  logger.info('deception_listening', {
    port: config.DECEPTION_PORT,
    ingest: config.INGEST_URL,
  });
});

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    logger.info('shutdown', { signal: sig });
    server.close(() => process.exit(0));
  });
}
