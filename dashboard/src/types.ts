/**
 * Formato do alerta como o dashboard o consome (subconjunto do contrato do
 * @siked/shared). Type-only — o dashboard fica autossuficiente para build.
 */
export interface Alert {
  id: string;
  src_ip: string;
  decision: {
    rule_id: string;
    engine: 'signature' | 'correlation';
    attack: { tactic: string; technique: string; tactic_name: string; technique_name: string };
    severity: 'low' | 'medium' | 'high' | 'critical';
    d3fend: string;
    evidence: string;
    confidence: 'deterministic';
  };
  first_event_ts: string;
  detected_ts: string;
  mttd_ms: number;
  count: number;
  advisory?: { source: 'ai'; summary: string; suggested_response: string; disclaimer: string };
}
