import { describe, it, expect } from 'vitest';
import { assertAllowedTarget } from '../emitter.js';

describe('emitter guardrail (contenção)', () => {
  it('aceita o ingest local isolado', () => {
    expect(() => assertAllowedTarget('http://ingest:8081/events')).not.toThrow();
    expect(() => assertAllowedTarget('http://127.0.0.1:8081/events')).not.toThrow();
  });

  it('recusa destino externo (não vira ferramenta de exfiltração)', () => {
    expect(() => assertAllowedTarget('http://evil.example.com/collect')).toThrow(/não permitido/);
    expect(() => assertAllowedTarget('https://attacker.tld/x')).toThrow();
  });
});
