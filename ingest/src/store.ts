import { existsSync, mkdirSync, openSync, writeSync, fsyncSync, closeSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { CanonicalEvent, CustodyRecord } from '@siked/shared';
import { GENESIS, computeHash } from './custody.js';

export interface VerifyResult {
  ok: boolean;
  records: number;
  brokenAt?: number; // seq da primeira linha inconsistente
  reason?: string;
}

/**
 * Store append-only (ADR-0002). Fonte-verdade = JSONL com hash encadeado; o
 * SQLite é um índice de leitura DERIVADO e reconstruível a partir do JSONL.
 * Ordem de escrita: JSONL (fsync) -> índice. Nunca update/delete no JSONL.
 */
export class Store {
  private readonly jsonlPath: string;
  private readonly db: Database.Database;
  private fd: number;
  private lastSeq = -1;
  private lastHash = GENESIS;

  constructor(jsonlPath: string, sqlitePath: string) {
    this.jsonlPath = jsonlPath;
    mkdirSync(dirname(jsonlPath), { recursive: true });
    mkdirSync(dirname(sqlitePath), { recursive: true });

    this.db = new Database(sqlitePath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        seq INTEGER PRIMARY KEY,
        timestamp TEXT NOT NULL,
        src_ip TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        user_agent TEXT NOT NULL,
        honeypot_id TEXT,
        token_id TEXT,
        payload_snippet TEXT NOT NULL,
        raw_signature TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        hash TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_src_ip ON events(src_ip);
      CREATE INDEX IF NOT EXISTS idx_events_sig ON events(raw_signature);
      CREATE INDEX IF NOT EXISTS idx_events_ts ON events(timestamp);
    `);

    this.reindexFromJsonl();
    this.fd = openSync(this.jsonlPath, 'a');
  }

  /**
   * Reconstrói o índice a partir do JSONL (fonte-verdade). Chamado na subida:
   * se o índice estiver atrás do log, recompõe; garante lastSeq/lastHash corretos.
   */
  private reindexFromJsonl(): void {
    if (!existsSync(this.jsonlPath)) return;
    const lines = readFileSync(this.jsonlPath, 'utf8').split('\n').filter((l) => l.trim());
    if (lines.length === 0) return;

    const insert = this.insertStmt();
    const load = this.db.transaction((rows: CustodyRecord[]) => {
      this.db.exec('DELETE FROM events');
      for (const r of rows) insert.run(r);
    });

    const rows: CustodyRecord[] = [];
    for (const line of lines) {
      const rec = CustodyRecord.parse(JSON.parse(line));
      rows.push(rec);
    }
    load(rows);

    const last = rows[rows.length - 1]!;
    this.lastSeq = last.seq;
    this.lastHash = last.hash;
  }

  private insertStmt() {
    return this.db.prepare(`
      INSERT OR REPLACE INTO events
        (seq, timestamp, src_ip, method, path, user_agent, honeypot_id, token_id, payload_snippet, raw_signature, prev_hash, hash)
      VALUES
        (@seq, @timestamp, @src_ip, @method, @path, @user_agent, @honeypot_id, @token_id, @payload_snippet, @raw_signature, @prev_hash, @hash)
    `);
  }

  /** Anexa um evento canônico. JSONL primeiro (fsync), depois índice. */
  append(event: CanonicalEvent): CustodyRecord {
    const parsed = CanonicalEvent.parse(event);
    const seq = this.lastSeq + 1;
    const prev_hash = this.lastHash;
    const hash = computeHash(prev_hash, parsed);
    const record: CustodyRecord = { ...parsed, seq, prev_hash, hash };

    // 1) fonte-verdade: JSONL append + fsync (durabilidade da custódia)
    writeSync(this.fd, JSON.stringify(record) + '\n');
    fsyncSync(this.fd);

    // 2) índice derivado
    this.insertStmt().run(record);

    this.lastSeq = seq;
    this.lastHash = hash;
    return record;
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS c FROM events').get() as { c: number }).c;
  }

  /**
   * Verifica a integridade relendo o JSONL do disco e recomputando a cadeia.
   * Detecta adulteração de qualquer linha (o hash deixa de bater a partir dela).
   */
  verifyChain(): VerifyResult {
    if (!existsSync(this.jsonlPath)) return { ok: true, records: 0 };
    const lines = readFileSync(this.jsonlPath, 'utf8').split('\n').filter((l) => l.trim());

    let prev = GENESIS;
    let expectedSeq = 0;
    for (const line of lines) {
      let rec: CustodyRecord;
      try {
        rec = CustodyRecord.parse(JSON.parse(line));
      } catch {
        return { ok: false, records: lines.length, brokenAt: expectedSeq, reason: 'linha inválida' };
      }
      const { seq, prev_hash, hash, ...event } = rec;
      if (seq !== expectedSeq) {
        return { ok: false, records: lines.length, brokenAt: seq, reason: 'seq fora de ordem' };
      }
      if (prev_hash !== prev) {
        return { ok: false, records: lines.length, brokenAt: seq, reason: 'prev_hash não encadeia' };
      }
      const recomputed = computeHash(prev_hash, event);
      if (recomputed !== hash) {
        return { ok: false, records: lines.length, brokenAt: seq, reason: 'hash não confere (adulteração)' };
      }
      prev = hash;
      expectedSeq += 1;
    }
    return { ok: true, records: lines.length };
  }

  close(): void {
    try { closeSync(this.fd); } catch { /* já fechado */ }
    this.db.close();
  }
}
