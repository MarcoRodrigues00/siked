import { useEffect, useRef, useState } from 'react';
import type { Alert, MetricsSnapshot, WsMessage } from './types';

const TECHNIQUES = [
  { id: 'T1595', name: 'Active Scanning', tactic: 'Reconnaissance' },
  { id: 'T1190', name: 'Exploit Public-Facing App', tactic: 'Initial Access' },
  { id: 'T1110', name: 'Brute Force', tactic: 'Credential Access' },
  { id: 'T1078', name: 'Valid Accounts', tactic: 'Initial Access' },
];

const EMPTY: MetricsSnapshot = { alerts: 0, distinct_ips: 0, techniques: {}, coverage: 0, avg_mttd_ms: 0 };

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

export function App() {
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<MetricsSnapshot>(EMPTY);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let stop = false;
    let ws: WebSocket;
    const connect = () => {
      ws = new WebSocket(wsUrl());
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!stop) setTimeout(connect, 1500); // reconecta
      };
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as WsMessage;
        if (msg.type === 'hello') setMetrics(msg.metrics);
        else if (msg.type === 'alert') {
          setMetrics(msg.metrics);
          setAlerts((prev) => [msg.alert, ...prev].slice(0, 100));
        } else if (msg.type === 'response') {
          setBlocked((prev) => new Set(prev).add(msg.ip));
        }
      };
    };
    connect();
    return () => {
      stop = true;
      ws?.close();
    };
  }, []);

  const respond = (ip: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'respond', ip, action: 'block_ip' }));
  };

  return (
    <div className="app">
      <header>
        <h1>🕸️ siked · SOC Console</h1>
        <span className={`status ${connected ? 'on' : 'off'}`}>{connected ? 'ao vivo' : 'reconectando…'}</span>
      </header>

      <section className="counters">
        <Counter label="Alertas" value={metrics.alerts} />
        <Counter label="IPs distintos" value={metrics.distinct_ips} />
        <Counter label="Cobertura ATT&CK" value={`${Math.round(metrics.coverage * 100)}%`} />
        <Counter label="MTTD médio" value={`${metrics.avg_mttd_ms} ms`} />
      </section>

      <section className="heatmap">
        <h2>Cobertura MITRE ATT&CK</h2>
        <div className="grid">
          {TECHNIQUES.map((t) => {
            const count = metrics.techniques[t.id] ?? 0;
            return (
              <div key={t.id} className={`cell ${count > 0 ? 'hot' : ''}`}>
                <div className="tid">{t.id}</div>
                <div className="tname">{t.name}</div>
                <div className="ttactic">{t.tactic}</div>
                <div className="tcount">{count}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="feed">
        <h2>Feed ao vivo ({alerts.length})</h2>
        {alerts.length === 0 && <p className="empty">Aguardando atividade adversária…</p>}
        {alerts.map((a) => (
          <div key={a.id} className={`alert sev-${a.decision.severity}`}>
            <div className="alert-main">
              <span className="tech">
                {a.decision.attack.technique} · {a.decision.attack.technique_name}
              </span>
              <span className="evidence">{a.decision.evidence}</span>
              <span className="meta">
                {a.src_ip} · {a.decision.engine} · MTTD {a.mttd_ms} ms · D3FEND: {a.decision.d3fend}
              </span>
            </div>
            <button disabled={blocked.has(a.src_ip)} onClick={() => respond(a.src_ip)}>
              {blocked.has(a.src_ip) ? 'IP bloqueado' : 'Responder (bloquear IP)'}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="counter">
      <div className="cvalue">{value}</div>
      <div className="clabel">{label}</div>
    </div>
  );
}
