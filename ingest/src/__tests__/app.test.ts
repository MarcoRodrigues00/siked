import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app.js';
import { Store } from '../store.js';
import { config } from '../config.js';

let store: Store;
let dir: string;
let app: ReturnType<typeof createApp>;
const TOKEN = config.INGEST_TOKEN;

const validEvent = {
  src_ip: '203.0.113.7',
  method: 'GET',
  path: '/admin',
  user_agent: 'curl/8',
  honeypot_id: 'hp_admin',
  payload: 'user=root&password=hunter2secret',
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'siked-ingest-app-'));
  store = new Store(join(dir, 'events.jsonl'), join(dir, 'index.sqlite'));
  app = createApp(store);
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('ingest — POST /events (canal edge->core)', () => {
  it('GET /health -> 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('sem token -> 401 e nada é persistido', async () => {
    const res = await request(app).post('/events').send(validEvent);
    expect(res.status).toBe(401);
    expect(store.count()).toBe(0);
  });

  it('token errado -> 401', async () => {
    const res = await request(app).post('/events').set('x-ingest-token', 'errado').send(validEvent);
    expect(res.status).toBe(401);
  });

  it('token correto + evento válido -> 201 e exatamente 1 registro', async () => {
    const res = await request(app).post('/events').set('x-ingest-token', TOKEN).send(validEvent);
    expect(res.status).toBe(201);
    expect(res.body.seq).toBe(0);
    expect(res.body.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(store.count()).toBe(1);
  });

  it('persiste o payload MASCARADO, nunca cru', async () => {
    await request(app).post('/events').set('x-ingest-token', TOKEN).send(validEvent);
    const verify = await request(app).get('/custody/verify').set('x-ingest-token', TOKEN);
    expect(verify.body.ok).toBe(true);
    // o segredo não pode ter sido gravado
    const jsonl = readFileSync(join(dir, 'events.jsonl'), 'utf8');
    expect(jsonl).not.toContain('hunter2secret');
    expect(jsonl).toContain('[MASKED:SECRET]');
  });

  it('evento inválido -> 400', async () => {
    const res = await request(app).post('/events').set('x-ingest-token', TOKEN).send({ method: 'GET' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_event');
  });

  it('GET /custody/verify -> cadeia íntegra após ingestões', async () => {
    await request(app).post('/events').set('x-ingest-token', TOKEN).send(validEvent);
    await request(app).post('/events').set('x-ingest-token', TOKEN).send({ ...validEvent, path: '/wp-login.php' });
    const res = await request(app).get('/custody/verify').set('x-ingest-token', TOKEN);
    expect(res.body).toMatchObject({ ok: true, records: 2 });
  });
});
