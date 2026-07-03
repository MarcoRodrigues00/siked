import { Redis } from 'ioredis';
import { CanonicalEvent, type Alert } from '@siked/shared';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * Barramento interno (ADR-0003): assina `siked:events` (publicado pelo ingest)
 * e publica alertas em `siked:alerts` (consumido pelo dashboard).
 */
export interface Bus {
  onEvent(handler: (e: CanonicalEvent) => void): void;
  publishAlert(alert: Alert): void;
  close(): Promise<void>;
}

export function createBus(): Bus {
  const sub = new Redis(config.REDIS_URL);
  const pub = new Redis(config.REDIS_URL);

  return {
    onEvent(handler) {
      void sub.subscribe(config.EVENTS_CHANNEL).then(() =>
        logger.info('subscribed', { channel: config.EVENTS_CHANNEL }),
      );
      sub.on('message', (channel, message) => {
        if (channel !== config.EVENTS_CHANNEL) return;
        try {
          handler(CanonicalEvent.parse(JSON.parse(message)));
        } catch (err) {
          logger.warn('bad_event', { message: (err as Error).message });
        }
      });
    },
    publishAlert(alert) {
      void pub.publish(config.ALERTS_CHANNEL, JSON.stringify(alert));
    },
    async close() {
      await sub.quit();
      await pub.quit();
    },
  };
}
