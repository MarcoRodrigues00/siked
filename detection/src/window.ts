import type { CanonicalEvent } from '@siked/shared';

/**
 * Janela deslizante por src_ip, alimentada pelo stream. O "relógio" é o
 * timestamp dos próprios eventos (data-driven) — a correlação é 100%
 * determinística: mesma sequência de eventos -> mesmos disparos.
 */
const MAX_AGE_MS = 5 * 60 * 1000; // 5 min de retenção por IP

export class WindowStore {
  private readonly byIp = new Map<string, CanonicalEvent[]>();

  add(event: CanonicalEvent): void {
    const arr = this.byIp.get(event.src_ip) ?? [];
    arr.push(event);
    const nowMs = Date.parse(event.timestamp);
    while (arr.length > 0 && nowMs - Date.parse(arr[0]!.timestamp) > MAX_AGE_MS) arr.shift();
    this.byIp.set(event.src_ip, arr);
  }

  /** Eventos do IP dentro dos últimos `windowMs` (relativo ao evento atual). */
  recent(
    ip: string,
    windowMs: number,
    nowMs: number,
    filter?: (e: CanonicalEvent) => boolean,
  ): CanonicalEvent[] {
    const arr = this.byIp.get(ip) ?? [];
    return arr.filter(
      (e) => nowMs - Date.parse(e.timestamp) <= windowMs && (!filter || filter(e)),
    );
  }
}
