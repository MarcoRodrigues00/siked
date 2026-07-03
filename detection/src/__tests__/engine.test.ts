import { describe, it, expect, beforeEach } from 'vitest';
import { buildEngine, Engine } from '../engine.js';
import { config } from '../config.js';
import type { CanonicalEvent } from '@siked/shared';

const BASE_MS = Date.parse('2026-07-03T12:00:00.000Z');
const at = (sec: number) => new Date(BASE_MS + sec * 1000).toISOString();

function ev(o: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    timestamp: at(0),
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

let engine: Engine;
beforeEach(() => {
  engine = buildEngine(config);
});

describe('Engine — assinaturas', () => {
  it('SQLi -> alerta T1190 (signature, determinístico, sem advisory)', () => {
    const [a] = engine.process(ev({ path: '/search', payload_snippet: 'q=1 UNION SELECT x' }));
    expect(a).toBeDefined();
    expect(a!.decision.attack.technique).toBe('T1190');
    expect(a!.decision.attack.technique_name).toBe('Exploit Public-Facing Application');
    expect(a!.decision.engine).toBe('signature');
    expect(a!.decision.confidence).toBe('deterministic');
    expect(a!.advisory).toBeUndefined(); // muralha: engine nunca preenche advisory
    expect(a!.decision.d3fend).toContain('D3-');
  });

  it('uso de honeytoken -> T1078 critical', () => {
    const alerts = engine.process(ev({ path: '/api/v1/data', token_id: 'ht_aws_key' }));
    const ht = alerts.find((x) => x.decision.attack.technique === 'T1078');
    expect(ht).toBeDefined();
    expect(ht!.decision.severity).toBe('critical');
  });

  it('acesso a /wp-login.php -> T1595', () => {
    const [a] = engine.process(ev({ path: '/wp-login.php' }));
    expect(a!.decision.attack.technique).toBe('T1595');
  });

  it('requisição benigna -> nenhum alerta', () => {
    expect(engine.process(ev({ path: '/', payload_snippet: 'GET /' }))).toHaveLength(0);
  });

  it('dedup: mesma regra+ip não redispara dentro da janela', () => {
    const first = engine.process(ev({ path: '/s', payload_snippet: 'UNION SELECT a', timestamp: at(0) }));
    const second = engine.process(ev({ path: '/s', payload_snippet: 'UNION SELECT b', timestamp: at(1) }));
    const third = engine.process(ev({ path: '/s', payload_snippet: 'UNION SELECT c', timestamp: at(6) }));
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0); // suprimido (dentro de 5s)
    expect(third).toHaveLength(1); // 6s depois -> dispara de novo
  });
});

describe('Engine — correlação', () => {
  it('brute force: 5 logins em <=10s -> T1110 com MTTD medido', () => {
    let alerts: ReturnType<Engine['process']> = [];
    for (let i = 0; i < 5; i++) {
      alerts = engine.process(ev({ method: 'POST', path: '/admin', timestamp: at(i) }));
    }
    const bf = alerts.find((x) => x.decision.attack.technique === 'T1110');
    expect(bf).toBeDefined();
    expect(bf!.decision.engine).toBe('correlation');
    expect(bf!.mttd_ms).toBe(4000); // 1º evento em t=0, detecção em t=4s
    expect(bf!.first_event_ts).toBe(at(0));
  });

  it('4 logins não disparam brute force (abaixo do limiar)', () => {
    let alerts: ReturnType<Engine['process']> = [];
    for (let i = 0; i < 4; i++) {
      alerts = engine.process(ev({ method: 'POST', path: '/admin', timestamp: at(i) }));
    }
    expect(alerts.find((x) => x.decision.attack.technique === 'T1110')).toBeUndefined();
  });

  it('scan sweep: 6 caminhos distintos em <=15s -> T1595 (correlation)', () => {
    const paths = ['/a', '/b', '/c', '/d', '/e', '/f'];
    let alerts: ReturnType<Engine['process']> = [];
    paths.forEach((p, i) => {
      alerts = engine.process(ev({ path: p, timestamp: at(i) }));
    });
    const sweep = alerts.find((x) => x.decision.rule_id === 'corr-scan-sweep');
    expect(sweep).toBeDefined();
    expect(sweep!.decision.attack.technique).toBe('T1595');
  });
});
