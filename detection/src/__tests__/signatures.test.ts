import { describe, it, expect } from 'vitest';
import { loadSignatures, matchSignature } from '../signatures.js';
import { config } from '../config.js';
import type { CanonicalEvent } from '@siked/shared';

const rules = loadSignatures(config.RULES_DIR);

function ev(o: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    timestamp: '2026-07-03T12:00:00.000Z',
    src_ip: '203.0.113.7',
    method: 'GET',
    path: '/',
    user_agent: '',
    honeypot_id: null,
    token_id: null,
    payload_snippet: '',
    raw_signature: 's',
    ...o,
  };
}

const find = (id: string) => rules.find((r) => r.id === id)!;

describe('carregamento de assinaturas', () => {
  it('carrega regras com ids únicos', () => {
    expect(rules.length).toBeGreaterThanOrEqual(9);
    const ids = new Set(rules.map((r) => r.id));
    expect(ids.size).toBe(rules.length);
  });

  it('toda assinatura tem técnica ATT&CK', () => {
    for (const r of rules) expect(r.attack.technique).toMatch(/^T\d+/);
  });
});

describe('matchSignature', () => {
  it('SQLi UNION casa sig-sqli-union', () => {
    expect(matchSignature(find('sig-sqli-union'), ev({ payload_snippet: "q=1 UNION SELECT pass FROM users" }))).toBe(true);
  });

  it('path traversal casa sig-path-traversal', () => {
    expect(matchSignature(find('sig-path-traversal'), ev({ path: '/download', payload_snippet: 'file=../../etc/passwd' }))).toBe(true);
  });

  it('honeytoken casa sig-honeytoken-use só quando token_id presente', () => {
    expect(matchSignature(find('sig-honeytoken-use'), ev({ token_id: 'ht_aws_key' }))).toBe(true);
    expect(matchSignature(find('sig-honeytoken-use'), ev({ token_id: null }))).toBe(false);
  });

  it('requisição benigna não casa nenhuma assinatura', () => {
    const benign = ev({ path: '/', payload_snippet: 'GET /' });
    expect(rules.some((r) => matchSignature(r, benign))).toBe(false);
  });
});
