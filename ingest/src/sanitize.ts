/**
 * Sanitização de payload (camada 3). Regra de ouro: nunca persistir payload cru.
 * Mascara segredos/PID prováveis e trunca. Determinística — mesmo input, mesmo
 * output (importante para a cadeia de hash e para os testes).
 *
 * Referência conceitual: PII masking do ClinicBridge (PLANO §4.3). Reimplementado.
 */

// ordem importa: padrões mais específicos primeiro
const MASKS: Array<{ re: RegExp; label: string }> = [
  // JWT (três blocos base64url separados por ponto)
  { re: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, label: 'JWT' },
  // Bearer <token>
  { re: /(?:Bearer\s+)[A-Za-z0-9._-]{8,}/gi, label: 'BEARER' },
  // pares chave=segredo (password/passwd/pwd/secret/token/apikey/api_key)
  {
    re: /((?:password|passwd|pwd|secret|token|api[_-]?key)\s*[=:]\s*)("?[^"&\s]{3,}"?)/gi,
    label: 'SECRET',
  },
  // e-mails (PII)
  { re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, label: 'EMAIL' },
  // cartões (13-19 dígitos, com ou sem separador)
  { re: /\b(?:\d[ -]?){13,19}\b/g, label: 'CARD' },
  // tokens longos genéricos (hex/base64, >= 24 chars)
  { re: /\b[A-Za-z0-9+/_-]{24,}\b/g, label: 'TOKEN' },
];

export function sanitize(raw: string, maxLen = 512): string {
  if (!raw) return '';
  let out = raw;

  for (const { re, label } of MASKS) {
    out = out.replace(re, (match, ...groups) => {
      // padrão SECRET tem grupo de prefixo (chave=) que preservamos
      if (label === 'SECRET' && typeof groups[0] === 'string') {
        return `${groups[0]}[MASKED:SECRET]`;
      }
      return `[MASKED:${label}]`;
    });
  }

  // normaliza whitespace e trunca (com marcador de truncamento)
  out = out.replace(/\s+/g, ' ').trim();
  if (out.length > maxLen) out = out.slice(0, maxLen - 1) + '…';
  return out;
}
