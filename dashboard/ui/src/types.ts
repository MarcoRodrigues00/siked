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
  advisory?: { source: 'ai'; summary: string; suggested_response: string };
}

export interface MetricsSnapshot {
  alerts: number;
  distinct_ips: number;
  techniques: Record<string, number>;
  coverage: number;
  avg_mttd_ms: number;
}

export type WsMessage =
  | { type: 'hello'; metrics: MetricsSnapshot }
  | { type: 'alert'; alert: Alert; metrics: MetricsSnapshot }
  | { type: 'response'; ip: string; action: string; simulated: boolean };
