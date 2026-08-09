import {
  open,
  type QueryResult,
  type Scalar,
} from '@op-engineering/op-sqlite';

import { MIGRATIONS, SCHEMA_VERSION } from './schema';

export type { QueryResult, Scalar };

// Permukaan minimal yang dipakai repository — dipenuhi op-sqlite di perangkat
// dan adapter better-sqlite3 di pengujian.
export interface SqlTx {
  execute(query: string, params?: Scalar[]): Promise<QueryResult>;
}

export interface SqlExecutor extends SqlTx {
  executeSync(query: string, params?: Scalar[]): QueryResult;
  transaction(fn: (tx: SqlTx) => Promise<void>): Promise<void>;
  close(): void;
}

let db: SqlExecutor | null = null;

export function getDb(): SqlExecutor {
  if (!db) {
    throw new Error('Database not initialized — call initDatabase() first');
  }
  return db;
}

export async function runMigrations(instance: SqlExecutor): Promise<void> {
  // WAL: pembaca tidak menghalangi penulis — penting saat embedding berjalan di latar.
  instance.executeSync('PRAGMA journal_mode = WAL');
  instance.executeSync('PRAGMA foreign_keys = ON');

  const versionRow = instance.executeSync('PRAGMA user_version');
  const current = Number(versionRow.rows[0]?.user_version ?? 0);

  for (let v = current; v < SCHEMA_VERSION; v++) {
    const statements = MIGRATIONS[v];
    if (!statements) {
      continue;
    }
    await instance.transaction(async (tx) => {
      for (const sql of statements) {
        await tx.execute(sql);
      }
      await tx.execute(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

export async function initDatabase(): Promise<SqlExecutor> {
  if (db) {
    return db;
  }
  const instance = open({ name: 'understory.db' });
  await runMigrations(instance);
  db = instance;
  return instance;
}

// Hanya untuk pengujian: memungkinkan adapter better-sqlite3 disuntikkan.
export function __setDbForTests(instance: SqlExecutor | null): void {
  db = instance;
}

