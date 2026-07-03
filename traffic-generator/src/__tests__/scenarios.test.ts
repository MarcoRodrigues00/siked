import { describe, it, expect } from 'vitest';
import { scan, sqli, bruteforce, honeytoken, selectScenarios, type HitReq } from '../scenarios.js';
import { assertAllowedTarget } from '../guard.js';

async function collect(run: (hit: (r: HitReq) => void) => Promise<void>): Promise<HitReq[]> {
  const reqs: HitReq[] = [];
  await run((r) => reqs.push(r));
  return reqs;
}

describe('cenários', () => {
  it('scan varre >= 6 caminhos distintos (dispara scan-sweep)', async () => {
    const reqs = await collect(scan.run);
    const distinct = new Set(reqs.map((r) => r.path));
    expect(distinct.size).toBeGreaterThanOrEqual(6);
  });

  it('bruteforce faz 6 POST /admin (dispara brute force)', async () => {
    const reqs = await collect(bruteforce.run);
    expect(reqs.every((r) => r.method === 'POST' && r.path === '/admin')).toBe(true);
    expect(reqs).toHaveLength(6);
  });

  it('sqli inclui payload UNION SELECT', async () => {
    const reqs = await collect(sqli.run);
    expect(reqs.some((r) => /UNION%20SELECT/i.test(r.path))).toBe(true);
  });

  it('honeytoken usa o valor do AWS key plantado', async () => {
    const reqs = await collect(honeytoken.run);
    expect(reqs[0]!.path).toContain('AKIAZ3XMPLE7SIKED42Q');
  });

  it('selectScenarios("all") retorna todos; nome inválido lança', () => {
    expect(selectScenarios('all')).toHaveLength(4);
    expect(() => selectScenarios('nope')).toThrow(/desconhecido/);
  });
});

describe('guard de contenção', () => {
  it('aceita alvo local, recusa externo', () => {
    expect(() => assertAllowedTarget('http://deception:3001')).not.toThrow();
    expect(() => assertAllowedTarget('http://evil.example.com')).toThrow(/não permitido/);
  });
});
