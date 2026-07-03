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

/**
 * Normaliza percent-encoding e `+` antes do matching (como um IDS faz): assim
 * `UNION%20SELECT` vira `UNION SELECT` e as assinaturas casam a intenção real.
 * Falha de decode (input malformado) cai de volta no original.
 */
export function urlNormalize(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

/** Bruto -> evento canônico: carimba timestamp, normaliza, sanitiza e assina para dedup. */
export function normalize(input: RawEventInput, opts: { nowIso: string; maxLen: number }): CanonicalEvent {
  return CanonicalEvent.parse({
    timestamp: opts.nowIso,
    src_ip: input.src_ip,
    method: input.method,
    path: input.path,
    user_agent: input.user_agent,
    honeypot_id: input.honeypot_id,
    token_id: input.token_id,
    payload_snippet: sanitize(urlNormalize(input.payload), opts.maxLen),
    // assinatura de dedup sobre o payload cru (antes da normalização)
    raw_signature: payloadSignature(input.method, input.path, input.payload),
  });
}
