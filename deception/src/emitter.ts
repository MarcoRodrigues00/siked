import { config } from './config.js';
import { logger } from './logger.js';

/** Evento bruto que o emissor manda ao ingest (contrato do POST /events). */
export interface RawEvent {
  src_ip: string;
  method: string;
  path: string;
  user_agent: string;
  honeypot_id: string | null;
  token_id: string | null;
  payload: string;
}

export type Emit = (ev: RawEvent) => void;

/**
 * Guardrail de contenção (ref: guard.py do ai-pentest-lab, PLANO §4.2): o emissor
 * só pode apontar para o ingest local/isolado — nunca para um host arbitrário.
 * Impede que a isca seja usada para exfiltrar/atacar terceiros.
 */
const ALLOWED_INGEST_HOSTS = new Set(['ingest', 'localhost', '127.0.0.1']);

export function assertAllowedTarget(url: string): void {
  const host = new URL(url).hostname;
  if (!ALLOWED_INGEST_HOSTS.has(host)) {
    throw new Error(`emitter guard: destino de ingest não permitido: ${host}`);
  }
}

/**
 * Cria o emissor real (POST autenticado ao ingest). Fire-and-forget: uma falha
 * no ingest NUNCA derruba o honeypot nem afeta a resposta ao atacante.
 */
export function makeEmitter(): Emit {
  assertAllowedTarget(config.INGEST_URL);

  return (ev: RawEvent) => {
    void fetch(config.INGEST_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ingest-token': config.INGEST_TOKEN },
      body: JSON.stringify(ev),
      signal: AbortSignal.timeout(2000),
    })
      .then((res) => {
        if (!res.ok) logger.warn('emit_non_ok', { status: res.status, path: ev.path });
      })
      .catch((err: unknown) => {
        logger.warn('emit_failed', { message: (err as Error).message, path: ev.path });
      });
  };
}
