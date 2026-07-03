import { describe, it, expect } from 'vitest';
import { sanitize } from '../sanitize.js';

describe('sanitize', () => {
  it('vazio -> vazio', () => {
    expect(sanitize('')).toBe('');
  });

  it('mascara e-mail (PII)', () => {
    expect(sanitize('login para admin@empresa.com falhou')).toContain('[MASKED:EMAIL]');
    expect(sanitize('admin@empresa.com')).not.toContain('empresa.com');
  });

  it('mascara par chave=segredo preservando a chave', () => {
    const out = sanitize('user=admin&password=hunter2foobar');
    expect(out).toContain('password=[MASKED:SECRET]');
    expect(out).not.toContain('hunter2foobar');
  });

  it('mascara JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc123DEF456ghi789';
    expect(sanitize(`token=${jwt}`)).toContain('[MASKED:');
    expect(sanitize(jwt)).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('mascara número de cartão', () => {
    expect(sanitize('card 4111 1111 1111 1111')).toContain('[MASKED:CARD]');
  });

  it('trunca payloads longos com marcador', () => {
    // palavras curtas separadas por espaço: não casam nenhuma máscara, só truncam
    const out = sanitize('lorem ipsum dolor '.repeat(500), 100);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.endsWith('…')).toBe(true);
  });

  it('é determinística (mesmo input, mesmo output)', () => {
    const s = 'password=abc12345 email=x@y.com';
    expect(sanitize(s)).toBe(sanitize(s));
  });
});
