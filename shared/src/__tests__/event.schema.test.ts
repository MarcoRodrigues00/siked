import { describe, it, expect } from 'vitest';
import { CanonicalEvent, CustodyRecord } from '../index.js';

describe('CanonicalEvent', () => {
  it('valida um evento mínimo e aplica defaults', () => {
    const ev = CanonicalEvent.parse({
      timestamp: '2026-07-03T12:00:00.000Z',
      src_ip: '203.0.113.7',
      method: 'GET',
      path: '/admin',
    });
    expect(ev.honeypot_id).toBeNull();
    expect(ev.payload_snippet).toBe('');
  });

  it('rejeita timestamp não-ISO', () => {
    const r = CanonicalEvent.safeParse({
      timestamp: 'ontem',
      src_ip: '1.2.3.4',
      method: 'GET',
      path: '/',
    });
    expect(r.success).toBe(false);
  });

  it('trunca via limite: payload acima de 2048 é rejeitado', () => {
    const r = CanonicalEvent.safeParse({
      timestamp: '2026-07-03T12:00:00.000Z',
      src_ip: '1.2.3.4',
      method: 'POST',
      path: '/x',
      payload_snippet: 'a'.repeat(2049),
    });
    expect(r.success).toBe(false);
  });
});

describe('CustodyRecord', () => {
  it('exige seq/prev_hash/hash além do evento', () => {
    const r = CustodyRecord.safeParse({
      timestamp: '2026-07-03T12:00:00.000Z',
      src_ip: '1.2.3.4',
      method: 'GET',
      path: '/admin',
      seq: 0,
      prev_hash: 'GENESIS',
      hash: 'abc123',
    });
    expect(r.success).toBe(true);
  });
});
