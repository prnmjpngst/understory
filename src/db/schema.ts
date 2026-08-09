// Skema database Understory. Migrasi berjalan berurutan berdasarkan PRAGMA user_version.
//
// Catatan desain (domain):
// - `documents` memakai INTEGER PK agar bisa jadi content_rowid untuk FTS5.
// - `documents_fts` adalah FTS5 external-content table yang disinkronkan via trigger,
//   sehingga index pencarian tidak pernah keluar dari transaksi yang sama dengan datanya.
// - `vec_chunks` adalah tabel virtual sqlite-vec (vec0) berdimensi 768
//   (nomic-embed-text-v1.5). Semua parameter integer yang masuk ke vec0 WAJIB lewat
//   CAST(? AS INTEGER) karena binding JS bisa mengirim REAL dan vec0 menolaknya.
// - `inbox_items` menyimpan snippet Zettelkasten yang menunggu archiving oleh agen.
// - `chat_messages` menyimpan riwayat chat-with-notes beserta sumber chunk yang dipakai.

export const SCHEMA_VERSION = 1;

export const MIGRATIONS: readonly (readonly string[])[] = [
  // v1 — skema awal
  [
    `CREATE TABLE documents(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      content_markdown TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX idx_documents_parent ON documents(parent_id, sort_order)`,

    `CREATE VIRTUAL TABLE documents_fts USING fts5(
      title, content_markdown,
      content='documents', content_rowid='id'
    )`,
    `CREATE TRIGGER documents_ai AFTER INSERT ON documents BEGIN
      INSERT INTO documents_fts(rowid, title, content_markdown)
        VALUES (new.id, new.title, new.content_markdown);
    END`,
    `CREATE TRIGGER documents_ad AFTER DELETE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, title, content_markdown)
        VALUES('delete', old.id, old.title, old.content_markdown);
    END`,
    `CREATE TRIGGER documents_au AFTER UPDATE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, title, content_markdown)
        VALUES('delete', old.id, old.title, old.content_markdown);
      INSERT INTO documents_fts(rowid, title, content_markdown)
        VALUES (new.id, new.title, new.content_markdown);
    END`,

    `CREATE VIRTUAL TABLE vec_chunks USING vec0(
      embedding float[768],
      +doc_id INTEGER,
      +chunk_index INTEGER,
      +chunk_text TEXT
    )`,

    `CREATE TABLE inbox_items(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      archived_at INTEGER,
      result_doc_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
      result_action TEXT
    )`,
    `CREATE INDEX idx_inbox_status ON inbox_items(status, created_at DESC)`,

    `CREATE TABLE chat_messages(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sources_json TEXT,
      created_at INTEGER NOT NULL
    )`,
  ],
];
