import { chunkMarkdown } from '../db/chunks';
import { countEmbeddedChunks, replaceDocEmbeddings } from '../db/embeddings';
import { listAllDocuments, getDocument } from '../db/documents';
import { embedText, isEmbeddingReady } from './llama';
import { useAiStore } from '../store/aiStore';

// Muatan embedding berjalan di latar; jika model belum siap, pekerjaan dibatalkan
// (dijadwalkan ulang saat pengguna menyalakan embedding di Settings).

const EMBED_BATCH_SIZE = 4;
const QUEUE_DELAY_MS = 1500;

// Antrean per dokumen: debounce agar mengetik tidak memicu embedding tiap detik.
const pending = new Map<number, ReturnType<typeof setTimeout>>();
let running = false;

async function refreshIndexedCount(): Promise<void> {
  const count = await countEmbeddedChunks().catch(() => 0);
  useAiStore.getState().setIndexedChunks(count);
}

async function flushQueue(): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  try {
    while (pending.size > 0) {
      const docIds = [...pending.keys()];
      pending.clear();
      useAiStore.getState().setEmbeddingQueue(0);

      // Cek model sekali saja; jika belum siap, batalkan semua (tidak menyia-nyiakan memori).
      const ready = await isEmbeddingReady();
      if (!ready) {
        return;
      }

      for (const docId of docIds) {
        try {
          await embedDocumentNow(docId);
        } catch (err) {
          console.error(`embedDocument(${docId}) failed`, err);
        }
      }
      await refreshIndexedCount();
    }
  } finally {
    running = false;
  }
}

// Jadwalkan (debounced) embedding ulang sebuah dokumen.
export function enqueueEmbedding(docId: number): void {
  const existing = pending.get(docId);
  if (existing) {
    clearTimeout(existing);
  }
  const timer = setTimeout(() => {
    pending.delete(docId);
    flushQueue();
  }, QUEUE_DELAY_MS);
  pending.set(docId, timer);
  useAiStore.getState().setEmbeddingQueue(pending.size);
}

// Embed seluruh dokumen yang belum ter-index (dipakai dari Settings).
export async function reindexAll(): Promise<{ indexed: number; skipped: number }> {
  const ready = await isEmbeddingReady();
  if (!ready) {
    throw new Error('Embedding model not ready');
  }
  const docs = await listAllDocuments();
  let indexed = 0;
  let skipped = 0;
  for (let i = 0; i < docs.length; i++) {
    try {
      const changed = await embedDocumentNow(docs[i].id);
      if (changed) {
        indexed++;
      } else {
        skipped++;
      }
      if (i % 5 === 0) {
        await refreshIndexedCount();
      }
    } catch (err) {
      console.error(`reindex doc ${docs[i].id} failed`, err);
      skipped++;
    }
  }
  await refreshIndexedCount();
  return { indexed, skipped };
}

// Embed satu dokumen: chunking → embedding (batch) → tulis vec_chunks.
// Mengembalikan true bila ada embedding yang ditulis.
export async function embedDocumentNow(docId: number): Promise<boolean> {
  const doc = await getDocument(docId);
  if (!doc) {
    return false;
  }
  const chunks = chunkMarkdown(doc.title, doc.content_markdown);
  if (chunks.length === 0) {
    await replaceDocEmbeddings(docId, [], []);
    return false;
  }

  const embeddings: Float32Array[] = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    for (const chunk of batch) {
      const emb = await embedText(chunk.text);
      if (!emb) {
        return false;
      }
      embeddings.push(emb);
    }
  }
  if (embeddings.length !== chunks.length) {
    return false;
  }
  await replaceDocEmbeddings(docId, chunks, embeddings);
  return true;
}

// Kosongkan seluruh index vektor (dipakai saat pengguna melepas model embedding).
export async function wipeEmbeddings(): Promise<void> {
  const docs = await listAllDocuments();
  for (const doc of docs) {
    await replaceDocEmbeddings(doc.id, [], []).catch(() => {});
  }
  await refreshIndexedCount();
}