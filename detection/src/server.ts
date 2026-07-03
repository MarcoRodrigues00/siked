import express from 'express';
import { config } from './config.js';
import { logger } from './logger.js';
import { buildEngine } from './engine.js';
import { createBus } from './bus.js';

const engine = buildEngine(config);
const bus = createBus();
let alertCount = 0;

// stream: cada evento normalizado -> regras -> alertas publicados no barramento
bus.onEvent((event) => {
  for (const alert of engine.process(event)) {
    bus.publishAlert(alert);
    alertCount += 1;
    logger.info('alert', {
      rule_id: alert.decision.rule_id,
      technique: alert.decision.attack.technique,
      severity: alert.decision.severity,
      src_ip: alert.src_ip,
      mttd_ms: alert.mttd_ms,
    });
  }
});

const app = express();
app.disable('x-powered-by');
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', alerts: alertCount }));

const server = app.listen(config.DETECTION_PORT, () => {
  logger.info('detection_listening', { port: config.DETECTION_PORT, redis: config.REDIS_URL });
});

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    logger.info('shutdown', { signal: sig });
    server.close(() => {
      void bus.close().finally(() => process.exit(0));
    });
  });
}
