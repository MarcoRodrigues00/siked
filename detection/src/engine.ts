import { createHash } from 'node:crypto';
import { Alert } from '@siked/shared';
import type { CanonicalEvent } from '@siked/shared';
import { AttackMap } from './attack-map.js';
import { loadSignatures, matchSignature, type SignatureRule } from './signatures.js';
import { correlationRules, type CorrelationRule } from './correlation.js';
import { WindowStore } from './window.js';
import type { Config } from './config.js';

interface EngineOpts {
  signatures: SignatureRule[];
  correlations: CorrelationRule[];
  attackMap: AttackMap;
  dedupWindowMs: number;
}

/**
 * Motor determinístico (ADR-0004). Cada evento passa por:
 *   assinaturas (stateless) -> correlação (com janela) -> Alerta.
 * A engine SÓ escreve o bloco `decision`. `advisory` (IA) é anexado depois, por
 * outro processo, e nunca influencia nada aqui.
 */
export class Engine {
  private readonly window = new WindowStore();
  private readonly lastFired = new Map<string, number>();

  constructor(private readonly opts: EngineOpts) {}

  process(event: CanonicalEvent): Alert[] {
    this.window.add(event);
    const detectedMs = Date.parse(event.timestamp);
    const out: Alert[] = [];

    for (const rule of this.opts.signatures) {
      if (!matchSignature(rule, event)) continue;
      const a = this.build({
        engine: 'signature',
        ruleId: rule.id,
        technique: rule.attack.technique,
        severity: rule.severity,
        evidence: `${rule.msg} :: ${event.method} ${event.path}`,
        firstTs: event.timestamp,
        detectedTs: event.timestamp,
        srcIp: event.src_ip,
        d3fendOverride: rule.d3fend,
        detectedMs,
      });
      if (a) out.push(a);
    }

    for (const rule of this.opts.correlations) {
      const r = rule.evaluate(event, this.window);
      if (!r) continue;
      const a = this.build({
        engine: 'correlation',
        ruleId: rule.id,
        technique: rule.attack.technique,
        severity: rule.severity,
        evidence: r.evidence,
        firstTs: r.first_event_ts,
        detectedTs: event.timestamp,
        srcIp: event.src_ip,
        d3fendOverride: rule.d3fend,
        detectedMs,
      });
      if (a) out.push(a);
    }

    return out;
  }

  private build(p: {
    engine: 'signature' | 'correlation';
    ruleId: string;
    technique: string;
    severity: Alert['decision']['severity'];
    evidence: string;
    firstTs: string;
    detectedTs: string;
    srcIp: string;
    d3fendOverride?: string;
    detectedMs: number;
  }): Alert | null {
    // dedup: mesma regra+ip não redispara dentro da janela
    const key = `${p.ruleId}|${p.srcIp}`;
    const last = this.lastFired.get(key);
    if (last !== undefined && p.detectedMs - last < this.opts.dedupWindowMs) return null;
    this.lastFired.set(key, p.detectedMs);

    const info = this.opts.attackMap.resolve(p.technique);
    const mttd = Math.max(0, p.detectedMs - Date.parse(p.firstTs));

    return Alert.parse({
      id: createHash('sha256').update(`${p.ruleId}|${p.srcIp}|${p.detectedTs}`).digest('hex').slice(0, 16),
      src_ip: p.srcIp,
      decision: {
        rule_id: p.ruleId,
        engine: p.engine,
        attack: {
          tactic: info.tactic,
          technique: info.technique,
          tactic_name: info.tactic_name,
          technique_name: info.technique_name,
        },
        severity: p.severity,
        d3fend: p.d3fendOverride ?? info.d3fend,
        evidence: p.evidence,
        confidence: 'deterministic',
      },
      first_event_ts: p.firstTs,
      detected_ts: p.detectedTs,
      mttd_ms: mttd,
      count: 1,
    });
  }
}

/** Constrói a engine a partir da config (carrega regras e mapeamentos do disco). */
export function buildEngine(cfg: Config): Engine {
  return new Engine({
    signatures: loadSignatures(cfg.RULES_DIR),
    correlations: correlationRules,
    attackMap: new AttackMap(cfg.MAPPINGS_DIR),
    dedupWindowMs: cfg.DEDUP_WINDOW_MS,
  });
}
