import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { Redis } from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';
import { Metrics } from './metrics.js';
import type { Alert } from './types.js';

const app = express();
app.disable('x-powered-by');

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', clients: clients.size }));

// serve a SPA buildada (se existir) + fallback de SPA
if (existsSync(config.UI_DIR)) {
  app.use(express.static(config.UI_DIR));
  app.get('*', (_req, res) => res.sendFile(join(config.UI_DIR, 'index.html')));
}

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
const clients = new Set<WebSocket>();
const metrics = new Metrics();

function broadcast(obj: unknown): void {
  const msg = JSON.stringify(obj);
  for (const c of clients) if (c.readyState === WebSocket.OPEN) c.send(msg);
}

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'hello', metrics: metrics.snapshot() }));

  ws.on('message', (raw) => {
    // botão de resposta simulada (D3FEND/SOAR) — não executa nada real
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'respond' && typeof msg.ip === 'string') {
        logger.info('simulated_response', { ip: msg.ip, action: msg.action });
        broadcast({ type: 'response', ip: msg.ip, action: msg.action ?? 'block_ip', simulated: true });
      }
    } catch {
      /* ignora mensagem malformada */
    }
  });

  ws.on('close', () => clients.delete(ws));
});

// assina o barramento de alertas e faz push ao vivo
const sub = new Redis(config.REDIS_URL);
void sub.subscribe(config.ALERTS_CHANNEL).then(() => logger.info('subscribed', { channel: config.ALERTS_CHANNEL }));
sub.on('message', (channel, message) => {
  if (channel !== config.ALERTS_CHANNEL) return;
  try {
    const alert = JSON.parse(message) as Alert;
    metrics.add(alert);
    broadcast({ type: 'alert', alert, metrics: metrics.snapshot() });
  } catch (err) {
    logger.warn('bad_alert', { message: (err as Error).message });
  }
});

httpServer.listen(config.DASHBOARD_PORT, () => {
  logger.info('dashboard_listening', { port: config.DASHBOARD_PORT, ui: existsSync(config.UI_DIR) });
});

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    logger.info('shutdown', { signal: sig });
    httpServer.close(() => void sub.quit().finally(() => process.exit(0)));
  });
}
