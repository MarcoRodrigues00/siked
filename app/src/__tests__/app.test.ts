import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../app.js';
import { errorHandler } from '../middlewares/errorHandler.js';

const app = createApp();

// App mínimo com uma rota que estoura, para exercitar o caminho de erro 500
// e provar que o errorHandler não vaza stack/mensagem interna ao cliente.
function appThatThrows() {
  const a = express();
  a.get('/boom', () => {
    throw new Error('segredo interno: conexão com o banco em 10.0.0.5 falhou');
  });
  a.use(errorHandler);
  return a;
}

describe('app real seguro — DoD Sprint 0', () => {
  it('GET /health responde 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('aplica headers do Helmet (X-Content-Type-Options: nosniff)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('não anuncia o framework (sem X-Powered-By)', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('correlaciona a request com x-request-id', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('entrada inválida (Zod) -> 400', async () => {
    const res = await request(app).post('/echo').send({ message: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('entrada válida -> 200', async () => {
    const res = await request(app).post('/echo').send({ message: 'ola' });
    expect(res.status).toBe(200);
    expect(res.body.echo).toBe('ola');
  });

  it('body acima do cap -> 413', async () => {
    const big = 'x'.repeat(100 * 1024); // 100kb > 64kb
    const res = await request(app).post('/echo').send({ message: big });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('payload_too_large');
  });

  it('erro interno (500) nunca vaza stack nem mensagem interna ao cliente', async () => {
    const res = await request(appThatThrows()).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal_error' });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('segredo interno'); // mensagem do Error
    expect(raw).not.toContain('10.0.0.5'); // detalhe interno
    expect(raw).not.toMatch(/\n\s+at /); // frame de stack trace
    expect(res.body).not.toHaveProperty('stack');
  });

  it('rota inexistente -> 404', async () => {
    const res = await request(app).get('/rota-que-nao-existe');
    expect(res.status).toBe(404);
  });
});
