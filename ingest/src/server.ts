import { join } from 'node:path';
import { config } from './config.js';
import { logger } from './logger.js';
import { Store } from './store.js';
import { createApp } from './app.js';
import { createPublisher } from './bus.js';

const jsonlPath = config.EVENTS_JSONL ?? join(config.DATA_DIR, 'events.jsonl');
const sqlitePath = config.INDEX_SQLITE ?? join(config.DATA_DIR, 'index.sqlite');

const store = new Store(jsonlPath, sqlitePath);
const publisher = createPublisher();
const app = createApp(store, publisher.publish);

const server = app.listen(config.INGEST_PORT, () => {
  const chain = store.verifyChain();
  logger.info('ingest_listening', {
    port: config.INGEST_PORT,
    events: store.count(),
    custody_ok: chain.ok,
  });
});

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    logger.info('shutdown', { signal: sig });
    server.close(() => {
      store.close();
      void publisher.close().finally(() => process.exit(0));
    });
  });
}
