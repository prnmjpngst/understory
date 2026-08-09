// Adapter Node untuk pengujian Jest: better-sqlite3 + sqlite-vec dengan
// permukaan yang sama seperti yang dipakai repository (SqlExecutor).
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

import type {
  QueryResult,
  Scalar,
  SqlExecutor,
  SqlTx,
} from '../../src/db/database';

function toBuffer(view: ArrayBufferView): Buffer {
  return Buffer.from(view.buffer as ArrayBuffer, view.byteOffset, view.byteLength);
}

// Konversi blob ke Buffer. Gunakan brand check (Object.prototype.toString) bukan
// `instanceof` karena lingkungan test RN (Jest VM) membuat realm berbeda sehingga
// instanceof terhadap ArrayBuffer bisa gagal meski nilainya benar.
function toSqlValue(value: Scalar): unknown {
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  const brand = Object.prototype.toString.call(value);
  if (brand === '[object ArrayBuffer]') {
    return Buffer.from(new Uint8Array(value as ArrayBuffer));
  }
  if (brand === '[object Uint8Array]' || brand === '[object Uint8ClampedArray]') {
    return Buffer.from(value as Uint8Array);
  }
  if (ArrayBuffer.isView(value)) {
    return toBuffer(value);
  }
  return value;
}

function convertParams(params?: Scalar[]): unknown[] {
  return (params ?? []).map(toSqlValue);
}

export class NodeDb implements SqlExecutor {
  private readonly db: Database.Database;

  constructor() {
    this.db = new Database(':memory:');
    sqliteVec.load(this.db);
  }

  executeSync(query: string, params?: Scalar[]): QueryResult {
    const stmt = this.db.prepare(query);
    const converted = convertParams(params);
    if (stmt.reader) {
      return {
        rowsAffected: 0,
        rows: stmt.all(...converted) as Array<Record<string, Scalar>>,
      };
    }
    const info = stmt.run(...converted);
    return {
      rowsAffected: info.changes,
      insertId: Number(info.lastInsertRowid),
      rows: [],
    };
  }

  execute(query: string, params?: Scalar[]): Promise<QueryResult> {
    return Promise.resolve(this.executeSync(query, params));
  }

  async transaction(fn: (tx: SqlTx) => Promise<void>): Promise<void> {
    this.db.prepare('BEGIN').run();
    try {
      await fn({
        execute: (q, p) => this.execute(q, p),
      });
      this.db.prepare('COMMIT').run();
    } catch (err: unknown) {
      this.db.prepare('ROLLBACK').run();
      throw err;
    }
  }

  close(): void {
    this.db.close();
  }
}
