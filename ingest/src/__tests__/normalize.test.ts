import { describe, it, expect } from 'vitest';
import { normalize, urlNormalize } from '../normalize.js';

describe('urlNormalize', () => {
  it('decodifica percent-encoding e +', () => {
    expect(urlNormalize('q=1%20UNION%20SELECT')).toBe('q=1 UNION SELECT');
    expect(urlNormalize('a+b')).toBe('a b');
  });

  it('input malformado cai de volta no original (não quebra)', () => {
    expect(urlNormalize('%zz')).toBe('%zz');
  });
});

describe('normalize', () => {
  it('SQLi percent-encoded fica legível para as assinaturas', () => {
    const ev = normalize(
      { src_ip: '1.2.3.4', method: 'GET', path: '/search', payload: 'GET /search?q=1%20UNION%20SELECT%20x', user_agent: '', honeypot_id: null, token_id: null },
      { nowIso: '2026-07-03T12:00:00.000Z', maxLen: 512 },
    );
    expect(ev.payload_snippet).toContain('UNION SELECT');
  });
});
