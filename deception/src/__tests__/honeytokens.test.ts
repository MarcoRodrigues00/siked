import { describe, it, expect } from 'vitest';
import { HONEYTOKENS, findHoneytokenUse, tokenValue } from '../honeytokens.js';

describe('honeytokens', () => {
  it('detecta uso de um honeytoken plantado', () => {
    const aws = tokenValue('ht_aws_key');
    expect(findHoneytokenUse(`Authorization: ${aws}`)).toBe('ht_aws_key');
  });

  it('retorna null quando não há honeytoken', () => {
    expect(findHoneytokenUse('GET /admin nada suspeito aqui')).toBeNull();
  });

  it('todos os honeytokens têm valor não-vazio e id único', () => {
    const ids = new Set(HONEYTOKENS.map((t) => t.id));
    expect(ids.size).toBe(HONEYTOKENS.length);
    for (const t of HONEYTOKENS) expect(t.value.length).toBeGreaterThan(8);
  });
});
