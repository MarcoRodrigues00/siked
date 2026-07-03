import { z } from 'zod';

/**
 * Contrato do ALERTA (ADR-0004). Muralha estrutural: `decision` é AUTORITATIVO
 * (só a engine determinística escreve); `advisory` é NÃO-AUTORITATIVO (só a IA,
 * opcional). Remover `advisory` inteiro não muda nenhuma detecção.
 */
export const Severity = z.enum(['low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof Severity>;

export const AttackRef = z.object({
  tactic: z.string(), // ex.: TA0006
  technique: z.string(), // ex.: T1110
  tactic_name: z.string().default(''),
  technique_name: z.string().default(''),
});

export const Decision = z.object({
  rule_id: z.string(),
  engine: z.enum(['signature', 'correlation']),
  attack: AttackRef,
  severity: Severity,
  d3fend: z.string(),
  evidence: z.string(),
  confidence: z.literal('deterministic'),
});
export type Decision = z.infer<typeof Decision>;

export const Advisory = z.object({
  source: z.literal('ai'),
  summary: z.string(),
  suggested_response: z.string(),
  disclaimer: z.string(),
});
export type Advisory = z.infer<typeof Advisory>;

export const Alert = z.object({
  id: z.string(),
  src_ip: z.string(),
  decision: Decision,
  first_event_ts: z.string(), // ISO — 1º evento do incidente
  detected_ts: z.string(), // ISO — quando o alerta disparou
  mttd_ms: z.number().int().nonnegative(), // detected - first_event
  count: z.number().int().positive().default(1),
  advisory: Advisory.optional(),
});
export type Alert = z.infer<typeof Alert>;
