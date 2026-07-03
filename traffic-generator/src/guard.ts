/**
 * Guardrail de contenção (PLANO §9, ref: guard.py). O gerador SÓ pode atacar o
 * próprio siked local/isolado — nunca um host externo. Isto impede que o
 * dual-use vire ferramenta de ataque a terceiros.
 */
const ALLOWED_TARGET_HOSTS = new Set(['deception', 'app', 'localhost', '127.0.0.1']);

export function assertAllowedTarget(url: string): void {
  const host = new URL(url).hostname;
  if (!ALLOWED_TARGET_HOSTS.has(host)) {
    throw new Error(`guard: alvo não permitido (${host}). Só o siked local/isolado.`);
  }
}
