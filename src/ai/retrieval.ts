import { knnChunks, type SimilarChunk } from '../db/embeddings';
import { getDocument } from '../db/documents';
import { keywordSearch, type KeywordHit } from '../db/search';
import { embedText } from './llama';

export interface RetrievalSource {
  docId: number;
  title: string;
  snippet: string;
  // Sinyal mana yang menemukan dokumen ini.
  fromKeyword: boolean;
  fromVector: boolean;
  // Skor fusi peringkat timbal-balik (semakin tinggi semakin relevan).
  score: number;
}

interface VectorDocHit {
  docId: number;
  text: string;
  distance: number;
  index: number;
}

// Fusi peringkat timbal-balik (RRF) untuk menggabungkan hasil keyword (FTS)
// dan vektor (KNN). Murni dan mudah diuji.
export function reciprocalRankFusion(
  keywordHits: KeywordHit[],
  vectorHits: SimilarChunk[],
  k = 60,
): RetrievalSource[] {
  const merged = new Map<number, RetrievalSource>();

  keywordHits.forEach((hit, index) => {
    const existing = merged.get(hit.docId);
    const rrf = 1 / (k + index);
    if (existing) {
      existing.fromKeyword = true;
      existing.score += rrf;
    } else {
      merged.set(hit.docId, {
        docId: hit.docId,
        title: hit.title || 'Untitled',
        snippet: hit.snippet,
        fromKeyword: true,
        fromVector: false,
        score: rrf,
      });
    }
  });

  // Dedup per dokumen: ambil chunk dengan jarak terkecil.
  const bestByDoc = new Map<number, VectorDocHit>();
  vectorHits.forEach((hit, index) => {
    const existing = bestByDoc.get(hit.docId);
    if (!existing || hit.distance < existing.distance) {
      bestByDoc.set(hit.docId, {
        docId: hit.docId,
        text: hit.chunkText,
        distance: hit.distance,
        index,
      });
    }
  });

  bestByDoc.forEach((hit) => {
    const rrf = 1 / (k + hit.index);
    const existing = merged.get(hit.docId);
    if (existing) {
      existing.fromVector = true;
      existing.score += rrf;
      if (!existing.snippet) {
        existing.snippet = hit.text;
      }
    } else {
      merged.set(hit.docId, {
        docId: hit.docId,
        title: 'Untitled',
        snippet: hit.text,
        fromKeyword: false,
        fromVector: true,
        score: rrf,
      });
    }
  });

  return [...merged.values()].sort((a, b) => b.score - a.score);
}

// Beri judul dokumen yang benar untuk hasil yang hanya datang dari vektor
// (keyword memakai judul langsung dari tabel FTS).
async function hydrateTitles(results: RetrievalSource[]): Promise<void> {
  const missing = results.filter((r) => !r.fromKeyword);
  for (const r of missing) {
    const doc = await getDocument(r.docId);
    if (doc) {
      r.title = doc.title || 'Untitled';
    }
  }
}

export interface HybridSearchResult {
  results: RetrievalSource[];
  usedVector: boolean;
}

// Pencarian hibrida: keyword FTS + pencarian semantik (bila embedding siap).
export async function hybridSearch(
  rawQuery: string,
  limit = 20,
): Promise<HybridSearchResult> {
  const query = rawQuery.trim();
  if (!query) {
    return { results: [], usedVector: false };
  }

  const keywordResults = await keywordSearch(query, limit);
  let vectorResults: SimilarChunk[] = [];
  let usedVector = false;

  const queryEmbedding = await embedText(query);
  if (queryEmbedding) {
    const knn = await knnChunks(queryEmbedding, limit);
    vectorResults = knn;
    usedVector = knn.length > 0;
  }

  const results = reciprocalRankFusion(keywordResults, vectorResults).slice(0, limit);
  await hydrateTitles(results);
  return { results, usedVector };
}