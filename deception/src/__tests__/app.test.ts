import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import type { RawEvent } from '../emitter.js';
import { tokenValue } from '../honeytokens.js';

let events: RawEvent[];
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  events = [];
  app = createApp((ev) => events.push(ev));
});

describe('deception — iscas + emissão', () => {
  it('GET /admin responde 200 e emite evento hp_admin', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(200);
    expect(events).toHaveLength(1);
    expect(events[0]!.honeypot_id).toBe('hp_admin');
    expect(events[0]!.path).toBe('/admin');
  });

  it('/.env expõe honeytokens plantados (expose->elicit)', async () => {
    const res = await request(app).get('/.env');
    expect(res.status).toBe(200);
    expect(res.text).toContain(tokenValue('ht_aws_key'));
    expect(res.text).toContain(tokenValue('ht_api_key'));
  });

  it('/api/v1/keys responde 401 verossímil', async () => {
    const res = await request(app).get('/api/v1/keys');
    expect(res.status).toBe(401);
    expect(events[0]!.honeypot_id).toBe('hp_api_keys');
  });

  it('caminho desconhecido -> hp_scan (404 nginx) + evento', async () => {
    const res = await request(app).get('/vendor/phpunit/eval-stdin.php');
    expect(res.status).toBe(404);
    expect(events[0]!.honeypot_id).toBe('hp_scan');
  });

  it('usar um honeytoken numa requisição marca token_id (sinal T1078)', async () => {
    const aws = tokenValue('ht_aws_key');
    await request(app).get(`/api/v1/data?key=${aws}`);
    expect(events[0]!.token_id).toBe('ht_aws_key');
  });

  it('requisição normal (sem honeytoken) tem token_id null', async () => {
    await request(app).get('/wp-login.php');
    expect(events[0]!.token_id).toBeNull();
  });

  it('finge ser nginx (header Server)', async () => {
    const res = await request(app).get('/admin');
    expect(res.headers['server']).toBe('nginx/1.24.0');
  });

  it('/health NÃO emite evento (é infra)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(events).toHaveLength(0);
  });
});
