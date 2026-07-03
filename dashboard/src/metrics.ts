import type { Alert } from './types.js';

/** Técnicas visadas (para a cobertura ATT&CK do heatmap). */
export const TARGET_TECHNIQUES = ['T1595', 'T1190', 'T1110', 'T1078'];

export interface MetricsSnapshot {
  alerts: number;
  distinct_ips: number;
  techniques: Record<string, number>; // técnica -> contagem
  coverage: number; // técnicas visadas detectadas / total
  avg_mttd_ms: number;
}

/** Acumula métricas do stream de alertas (exibidas no dashboard). */
export class Metrics {
  private alerts = 0;
  private mttdSum = 0;
  private readonly ips = new Set<string>();
  private readonly techniques = new Map<string, number>();

  add(alert: Alert): void {
    this.alerts += 1;
    this.mttdSum += alert.mttd_ms;
    this.ips.add(alert.src_ip);
    const t = alert.decision.attack.technique;
    this.techniques.set(t, (this.techniques.get(t) ?? 0) + 1);
  }

  snapshot(): MetricsSnapshot {
    const covered = TARGET_TECHNIQUES.filter((t) => this.techniques.has(t)).length;
    return {
      alerts: this.alerts,
      distinct_ips: this.ips.size,
      techniques: Object.fromEntries(this.techniques),
      coverage: covered / TARGET_TECHNIQUES.length,
      avg_mttd_ms: this.alerts ? Math.round(this.mttdSum / this.alerts) : 0,
    };
  }
}
