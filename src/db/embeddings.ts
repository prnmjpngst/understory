import { getDb } from './database';
import type { Chunk } from './chunks';

export interface SimilarChunk {
  docId: number;
  chunkIndex: number;
  chunkText: string;
  distance: number;
}

function embeddingToBuffer(embedding: Float32Array): ArrayBuffer {
  // Salin ke ArrayBuffer baru — buffer sumber bisa saja view dengan offset.
  const copy = new Float32Array(embedding);
  return copy.buffer;
}

// Ganti seluruh embedding sebuah dokumen (dipanggil saat simpan, debounced).
// Semua parameter integer ke vec0 lewat CAST — lihat catatan di schema.ts.
export async function replaceDocEmbeddings(
  docId: number,
  chunks: Chunk[],
  embeddings: Float32Array[],
): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.execute('DELETE FROM vec_chunks WHERE doc_id = CAST(? AS INTEGER)', [
      docId,
    ]);
    for (let i = 0; i < chunks.length; i++) {
      await tx.execute(
        `INSERT INTO vec_chunks(embedding, doc_id, chunk_index, chunk_text)
         VALUES (?, CAST(? AS INTEGER), CAST(? AS INTEGER), ?)`,
        [embeddingToBuffer(embeddings[i]), docId, chunks[i].index, chunks[i].text],
      );
    }
  });
}

export async function deleteDocEmbeddings(docIds: number[]): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const id of docIds) {
      await tx.execute('DELETE FROM vec_chunks WHERE doc_id = CAST(? AS INTEGER)', [
        id,
      ]);
    }
  });
}

// Langkah pertama pencarian semantik: KNN mentah di vec0.
// Dedup per-dokumen & pengambilan metadata dokumen dilakukan di lapisan atas —
// vec0 menolak GROUP BY/ORDER BY asing pada query yang mengandung MATCH.
export async function knnChunks(
  queryEmbedding: Float32Array,
  k: number,
): Promise<SimilarChunk[]> {
  const db = getDb();
  const res = await db.execute(
    `SELECT doc_id, chunk_index, chunk_text, distance
     FROM vec_chunks
     WHERE embedding MATCH ? AND k = CAST(? AS INTEGER)
     ORDER BY distance`,
    [embeddingToBuffer(queryEmbedding), k],
  );
  return res.rows.map((r) => ({
    docId: Number(r.doc_id),
    chunkIndex: Number(r.chunk_index),
    chunkText: String(r.chunk_text ?? ''),
    distance: Number(r.distance),
  }));
}

export async function countEmbeddedChunks(): Promise<number> {
  const db = getDb();
  const res = await db.execute('SELECT count(*) AS c FROM vec_chunks');
  return Number(res.rows[0]?.c ?? 0);
}
