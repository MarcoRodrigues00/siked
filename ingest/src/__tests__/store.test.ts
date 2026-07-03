import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../store.js';
import { GENESIS } from '../custody.js';
import type { CanonicalEvent } from '@siked/shared';

const stores: Store[] = [];
const dirs: string[] = [];

function newStore(): { store: Store; jsonl: string; sqlite: string } {
  const dir = mkdtempSync(join(tmpdir(), 'siked-ingest-'));
  dirs.push(dir);
  const jsonl = join(dir, 'events.jsonl');
  const sqlite = join(dir, 'index.sqlite');
  const store = new Store(jsonl, sqlite);
  stores.push(store);
  return { store, jsonl, sqlite };
}

function ev(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    timestamp: '2026-07-03T12:00:00.000Z',
    src_ip: '203.0.113.7',
    method: 'GET',
    path: '/admin',
    user_agent: 'curl/8',
    honeypot_id: 'hp_admin',
    token_id: null,
    payload_snippet: '',
    raw_signature: 'sig-1',
    ...overrides,
  };
}

afterEach(() => {
  while (stores.length) stores.pop()!.close();
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('Store — custódia append-only', () => {
  it('primeiro registro: seq 0, prev_hash GENESIS', () => {
    const { store } = newStore();
    const r = store.append(ev());
    expect(r.seq).toBe(0);
    expect(r.prev_hash).toBe(GENESIS);
    expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('encadeia: prev_hash do 2º = hash do 1º', () => {
    const { store } = newStore();
    const a = store.append(ev({ raw_signature: 'a' }));
    const b = store.append(ev({ raw_signature: 'b' }));
    expect(b.seq).toBe(1);
    expect(b.prev_hash).toBe(a.hash);
    expect(store.count()).toBe(2);
  });

  it('grava exatamente 1 linha por evento no JSONL', () => {
    const { store, jsonl } = newStore();
    store.append(ev());
    const lines = readFileSync(jsonl, 'utf8').split('\n').filter((l) => l.trim());
    expect(lines).toHaveLength(1);
  });

  it('verifyChain ok numa cadeia íntegra', () => {
    const { store } = newStore();
    store.append(ev({ raw_signature: 'a' }));
    store.append(ev({ raw_signature: 'b' }));
    store.append(ev({ raw_signature: 'c' }));
    expect(store.verifyChain()).toMatchObject({ ok: true, records: 3 });
  });

  it('ADULTERAR uma linha quebra a cadeia', () => {
    const { store, jsonl } = newStore();
    store.append(ev({ raw_signature: 'a' }));
    store.append(ev({ raw_signature: 'b' }));

    // adultera o payload da 1ª linha, mantendo o hash antigo
    const lines = readFileSync(jsonl, 'utf8').split('\n').filter((l) => l.trim());
    const tampered = JSON.parse(lines[0]!);
    tampered.payload_snippet = 'INJETADO PELO ATACANTE';
    lines[0] = JSON.stringify(tampered);
    writeFileSync(jsonl, lines.join('\n') + '\n');

    const result = store.verifyChain();
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(0);
  });

  it('reindexa a partir do JSONL na subida (índice reconstruível)', () => {
    const { store, jsonl, sqlite } = newStore();
    store.append(ev({ raw_signature: 'a' }));
    store.append(ev({ raw_signature: 'b' }));
    store.close();
    stores.pop(); // já fechado

    // apaga só o índice; JSONL (fonte-verdade) permanece
    rmSync(sqlite, { force: true });
    const reopened = new Store(jsonl, sqlite);
    stores.push(reopened);

    expect(reopened.count()).toBe(2);
    // continua a numeração a partir do log
    const c = reopened.append(ev({ raw_signature: 'c' }));
    expect(c.seq).toBe(2);
    expect(reopened.verifyChain().ok).toBe(true);
  });
});
