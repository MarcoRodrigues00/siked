import { createHash } from 'node:crypto';
import type { CanonicalEvent } from '@siked/shared';

/**
 * Chain-of-custody (ADR-0002). Cada registro do JSONL carrega
 *   hash = SHA-256(prev_hash + "\n" + canonicalize(evento))
 * Adulterar qualquer linha muda seu hash e quebra a cadeia a partir dela.
 * Referência conceitual: audit.py do ai-pentest-lab (PLANO §4.2). Reimplementado.
 */

export const GENESIS = 'GENESIS';

// serialização estável: chaves em ordem fixa, para o hash ser determinístico
const FIELD_ORDER: Array<keyof CanonicalEvent> = [
  'timestamp',
  'src_ip',
  'method',
  'path',
  'user_agent',
  'honeypot_id',
  'token_id',
  'payload_snippet',
  'raw_signature',
];

export function canonicalize(event: CanonicalEvent): string {
  return JSON.stringify(event, FIELD_ORDER as string[]);
}

export function computeHash(prevHash: string, event: CanonicalEvent): string {
  return createHash('sha256')
    .update(prevHash + '\n' + canonicalize(event))
    .digest('hex');
}

/** Assinatura do payload bruto, usada para deduplicação (não é custódia). */
export function payloadSignature(method: string, path: string, rawPayload: string): string {
  return createHash('sha256').update(`${method}\n${path}\n${rawPayload}`).digest('hex');
}
