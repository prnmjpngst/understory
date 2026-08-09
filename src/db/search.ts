import { getDb } from './database';

export interface KeywordHit {
  docId: number;
  title: string;
  parentId: number | null;
  // Snippet dengan penanda ‹…› di sekitar kata yang cocok.
  snippet: string;
  rank: number;
}

// Ubah query bebas menjadi ekspresi FTS5 yang aman:
// tiap token dibersihkan dari karakter khusus FTS5 dan diberi prefix-match `*`.
// Semua token harus cocok (AND implisit FTS5).
export function toFtsQuery(raw: string): string | null {
  const tokens = raw
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}0-9_]/gu, ''))
    .filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return null;
  }
  return tokens.map((t) => `${t}*`).join(' ');
}

export async function keywordSearch(
  raw: string,
  limit = 20,
): Promise<KeywordHit[]> {
  const ftsQuery = toFtsQuery(raw);
  if (!ftsQuery) {
    return [];
  }
  const db = getDb();
  // bm25 weights: judul 12x lebih berat dari isi.
  const res = await db.execute(
    `SELECT d.id AS doc_id, d.title AS title, d.parent_id AS parent_id,
            snippet(documents_fts, 1, '‹', '›', '…', 16) AS snippet,
            bm25(documents_fts, 12.0, 1.0) AS rank
     FROM documents_fts
     JOIN documents d ON d.id = documents_fts.rowid
     WHERE documents_fts MATCH ?
     ORDER BY rank
     LIMIT CAST(? AS INTEGER)`,
    [ftsQuery, limit],
  );
  return res.rows.map((r) => ({
    docId: Number(r.doc_id),
    title: String(r.title ?? ''),
    parentId: r.parent_id === null ? null : Number(r.parent_id),
    snippet: String(r.snippet ?? ''),
    rank: Number(r.rank),
  }));
}
