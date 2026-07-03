import { z } from 'zod';
import { CanonicalEvent } from '@siked/shared';
import { sanitize } from './sanitize.js';
import { payloadSignature } from './custody.js';

/**
 * Evento BRUTO que os emissores do edge (app/deception) mandam para o ingest.
 * O ingest é a autoridade do `timestamp` e da sanitização — o emissor não
 * decide como o payload é guardado.
 */
export const RawEventInput = z.object({
  src_ip: z.string().min(1).max(64),
  method: z.string().min(1).max(16),
  path: z.string().min(1).max(2048),
  user_agent: z.string().max(1024).optional().default(''),
  honeypot_id: z.string().max(128).nullable().optional().default(null),
  token_id: z.string().max(128).nullable().optional().default(null),
  payload: z.string().max(64 * 1024).optional().default(''), // cru; será sanitizado
});

export type RawEventInput = z.infer<typeof RawEventInput>;

/** Bruto -> evento canônico: carimba timestamp, sanitiza e assina para dedup. */
export function normalize(input: RawEventInput, opts: { nowIso: string; maxLen: number }): CanonicalEvent {
  return CanonicalEvent.parse({
    timestamp: opts.nowIso,
    src_ip: input.src_ip,
    method: input.method,
    path: input.path,
    user_agent: input.user_agent,
    honeypot_id: input.honeypot_id,
    token_id: input.token_id,
    payload_snippet: sanitize(input.payload, opts.maxLen),
    raw_signature: payloadSignature(input.method, input.path, input.payload),
  });
}
