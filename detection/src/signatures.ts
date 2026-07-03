import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import type { CanonicalEvent, Severity } from '@siked/shared';

/** Schema declarativo da regra de assinatura (estilo Suricata/Sigma). */
const RawRule = z.object({
  id: z.string(),
  msg: z.string(),
  match: z
    .object({
      method: z.array(z.string()).optional(),
      path_re: z.string().optional(),
      payload_re: z.string().optional(),
      ua_re: z.string().optional(),
      honeytoken: z.boolean().optional(),
      honeypot_id: z.array(z.string()).optional(),
    })
    .refine((m) => Object.keys(m).length > 0, { message: 'match não pode ser vazio (casaria tudo)' }),
  attack: z.object({ tactic: z.string(), technique: z.string() }),
  d3fend: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  references: z.array(z.string()).optional(),
});

export interface SignatureRule {
  id: string;
  msg: string;
  attack: { tactic: string; technique: string };
  d3fend?: string;
  severity: Severity;
  references: string[];
  match: {
    method?: Set<string>;
    path_re?: RegExp;
    payload_re?: RegExp;
    ua_re?: RegExp;
    honeytoken?: boolean;
    honeypot_id?: Set<string>;
  };
}

/**
 * Compila um padrão estilo Suricata/PCRE para RegExp do JS. O JS não suporta
 * flags inline `(?i)`, então um grupo de flags no início vira flags do RegExp.
 */
function toRegExp(pattern: string): RegExp {
  const m = pattern.match(/^\(\?([a-z]+)\)/);
  if (m) return new RegExp(pattern.slice(m[0].length), m[1]);
  return new RegExp(pattern);
}

function compile(r: z.infer<typeof RawRule>): SignatureRule {
  const m = r.match;
  return {
    id: r.id,
    msg: r.msg,
    attack: r.attack,
    d3fend: r.d3fend,
    severity: r.severity,
    references: r.references ?? [],
    match: {
      method: m.method ? new Set(m.method.map((x) => x.toUpperCase())) : undefined,
      path_re: m.path_re ? toRegExp(m.path_re) : undefined,
      payload_re: m.payload_re ? toRegExp(m.payload_re) : undefined,
      ua_re: m.ua_re ? toRegExp(m.ua_re) : undefined,
      honeytoken: m.honeytoken,
      honeypot_id: m.honeypot_id ? new Set(m.honeypot_id) : undefined,
    },
  };
}

/** Carrega e compila todas as assinaturas de um diretório (*.yml). */
export function loadSignatures(dir: string): SignatureRule[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  const rules: SignatureRule[] = [];
  for (const file of files) {
    const docs = yaml.load(readFileSync(join(dir, file), 'utf8'));
    const parsed = z.array(RawRule).parse(docs);
    for (const raw of parsed) rules.push(compile(raw));
  }
  const ids = new Set<string>();
  for (const r of rules) {
    if (ids.has(r.id)) throw new Error(`assinatura com id duplicado: ${r.id}`);
    ids.add(r.id);
  }
  return rules;
}

/** Casa uma assinatura contra um evento (todas as condições em AND). */
export function matchSignature(rule: SignatureRule, event: CanonicalEvent): boolean {
  const m = rule.match;
  if (m.method && !m.method.has(event.method.toUpperCase())) return false;
  if (m.path_re && !m.path_re.test(event.path)) return false;
  // payload_re olha caminho + snippet (a query com o payload vive no snippet)
  if (m.payload_re && !m.payload_re.test(`${event.path} ${event.payload_snippet}`)) return false;
  if (m.ua_re && !m.ua_re.test(event.user_agent)) return false;
  if (m.honeytoken && !event.token_id) return false;
  if (m.honeypot_id && !(event.honeypot_id && m.honeypot_id.has(event.honeypot_id))) return false;
  return true;
}
