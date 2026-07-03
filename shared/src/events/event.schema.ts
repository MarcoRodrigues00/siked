import { z } from 'zod';

/**
 * Evento canônico do siked (PLANO §3, §46).
 *
 * Todo toque numa isca vira UM registro neste formato. `payload_snippet` já
 * chega truncado/mascarado pela camada de ingest (nunca payload cru).
 * `raw_signature` é o hash do payload original, usado para deduplicação.
 */
export const CanonicalEvent = z.object({
  timestamp: z.string().datetime(), // ISO 8601 UTC
  src_ip: z.string().min(1),
  method: z.string().min(1),
  path: z.string().min(1),
  user_agent: z.string().default(''),
  honeypot_id: z.string().nullable().default(null),
  token_id: z.string().nullable().default(null),
  payload_snippet: z.string().max(2048).default(''), // já sanitizado
  raw_signature: z.string().default(''), // hash p/ dedup
});

export type CanonicalEvent = z.infer<typeof CanonicalEvent>;

/**
 * Registro de custódia append-only (ADR-0002). Cada linha do JSONL é um destes:
 * `hash` = SHA-256(prev_hash + evento_canônico). Adulterar qualquer linha quebra
 * a cadeia a partir dela — integridade demonstrável (chain-of-custody).
 */
export const CustodyRecord = CanonicalEvent.extend({
  seq: z.number().int().nonnegative(),
  prev_hash: z.string(),
  hash: z.string(),
});

export type CustodyRecord = z.infer<typeof CustodyRecord>;
