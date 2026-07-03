import { Redis } from 'ioredis';
import type { CustodyRecord } from '@siked/shared';
import { config } from './config.js';
import { logger } from './logger.js';

/** Publica o evento normalizado no barramento (siked:events) para a detecção. */
export type Publish = (record: CustodyRecord) => void;

export interface Publisher {
  publish: Publish;
  close(): Promise<void>;
}

export function createPublisher(): Publisher {
  const pub = new Redis(config.REDIS_URL);
  return {
    publish(record) {
      void pub.publish(config.EVENTS_CHANNEL, JSON.stringify(record)).catch((err: unknown) => {
        logger.warn('publish_failed', { message: (err as Error).message });
      });
    },
    async close() {
      await pub.quit();
    },
  };
}
