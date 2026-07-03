import type { CanonicalEvent, Severity } from '@siked/shared';
import type { WindowStore } from './window.js';

/**
 * Regras de correlação COM ESTADO — o que assinatura sozinha não pega:
 * comportamento numa janela temporal por IP.
 */
export interface CorrelationRule {
  id: string;
  description: string;
  attack: { tactic: string; technique: string };
  d3fend?: string;
  severity: Severity;
  evaluate(event: CanonicalEvent, window: WindowStore): { evidence: string; first_event_ts: string } | null;
}

const LOGIN_PATHS = new Set(['/admin', '/wp-login.php', '/phpmyadmin']);
const BRUTE_WINDOW_MS = 10_000;
const BRUTE_THRESHOLD = 5;
const SCAN_WINDOW_MS = 15_000;
const SCAN_DISTINCT_PATHS = 6;

/** T1110 — Brute Force: N tentativas em caminho de login no mesmo IP em X s. */
export const bruteForce: CorrelationRule = {
  id: 'corr-brute-force',
  description: `>= ${BRUTE_THRESHOLD} tentativas de login em <= ${BRUTE_WINDOW_MS / 1000}s`,
  attack: { tactic: 'TA0006', technique: 'T1110' },
  severity: 'high',
  evaluate(event, window) {
    if (!LOGIN_PATHS.has(event.path)) return null;
    const nowMs = Date.parse(event.timestamp);
    const hits = window.recent(event.src_ip, BRUTE_WINDOW_MS, nowMs, (e) => LOGIN_PATHS.has(e.path));
    if (hits.length < BRUTE_THRESHOLD) return null;
    return {
      evidence: `${hits.length} tentativas de login em ${event.path} em <= ${BRUTE_WINDOW_MS / 1000}s`,
      first_event_ts: hits[0]!.timestamp,
    };
  },
};

/** T1595 — Active Scanning: varredura de muitos caminhos distintos no mesmo IP. */
export const scanSweep: CorrelationRule = {
  id: 'corr-scan-sweep',
  description: `>= ${SCAN_DISTINCT_PATHS} caminhos distintos em <= ${SCAN_WINDOW_MS / 1000}s`,
  attack: { tactic: 'TA0043', technique: 'T1595' },
  severity: 'medium',
  evaluate(event, window) {
    const nowMs = Date.parse(event.timestamp);
    const hits = window.recent(event.src_ip, SCAN_WINDOW_MS, nowMs);
    const distinct = new Set(hits.map((e) => e.path));
    if (distinct.size < SCAN_DISTINCT_PATHS) return null;
    return {
      evidence: `${distinct.size} caminhos distintos varridos em <= ${SCAN_WINDOW_MS / 1000}s`,
      first_event_ts: hits[0]!.timestamp,
    };
  },
};

export const correlationRules: CorrelationRule[] = [bruteForce, scanSweep];
