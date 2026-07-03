/**
 * Honeytokens (PLANO §2 camada 2): dados FALSOS plantados nas iscas. Nenhum é
 * real. Se qualquer um destes valores aparecer numa requisição, é sinal de que
 * o atacante coletou a isca e está tentando USÁ-LA (mapeia para T1078 na detecção).
 */
export interface Honeytoken {
  id: string;
  value: string;
  hint: string; // onde está plantado
}

export const HONEYTOKENS: Honeytoken[] = [
  { id: 'ht_aws_key', value: 'AKIAZ3XMPLE7SIKED42Q', hint: 'AWS key falsa plantada no /.env' },
  { id: 'ht_admin_cred', value: 'S1ked-adm!n-Pr0d-2026', hint: 'senha falsa em comentário HTML do /admin' },
  { id: 'ht_api_key', value: 'sk_live_siked_FAKE_9f2b7c1d4e6a8b0c', hint: 'API key falsa no /.env' },
];

/** Retorna o token_id se algum honeytoken plantado aparecer no texto, senão null. */
export function findHoneytokenUse(haystack: string): string | null {
  for (const t of HONEYTOKENS) {
    if (haystack.includes(t.value)) return t.id;
  }
  return null;
}

export function tokenValue(id: string): string {
  const t = HONEYTOKENS.find((x) => x.id === id);
  if (!t) throw new Error(`honeytoken desconhecido: ${id}`);
  return t.value;
}
