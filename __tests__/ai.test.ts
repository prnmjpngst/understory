/**
 * AI-layer verification: chat history persistence, RRF fusion, RAG prompt
 * assembly, and hybrid retrieval integration against the node DB adapter.
 */
jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => {
    throw new Error('open() must not be called in tests — use __setDbForTests');
  }),
}));

jest.mock('../src/ai/llama', () => ({
  embedText: jest.fn(async () => null),
  isEmbeddingReady: jest.fn(async () => true),
}));

import { __setDbForTests, runMigrations } from '../src/db/database';
import { createDocument, updateDocumentContent } from '../src/db/documents';
import { replaceDocEmbeddings } from '../src/db/embeddings';
import { NodeDb } from './helpers/nodeDb';
import {
  addChatMessage,
  clearChatMessages,
  listChatMessages,
} from '../src/db/chat';
import { reciprocalRankFusion } from '../src/ai/retrieval';
import {
  buildRagMessages,
  buildRagSystemPrompt,
  truncateSnippet,
} from '../src/ai/rag';
import { hybridSearch } from '../src/ai/retrieval';
import { embedText } from '../src/ai/llama';

let nodeDb: NodeDb;

beforeEach(async () => {
  nodeDb = new NodeDb();
  await runMigrations(nodeDb);
  __setDbForTests(nodeDb);
});

afterEach(() => {
  __setDbForTests(null);
  nodeDb.close();
  jest.clearAllMocks();
});

// Embedding deterministik (768-d) dengan pola sederhana untuk KNN.
function fakeEmbedding(seed: number): Float32Array {
  const a = new Float32Array(768);
  for (let i = 0; i < 768; i++) {
    a[i] = Math.sin(seed * 0.7 + i * 0.13);
  }
  return a;
}

describe('chat_messages persistence', () => {
  it('round-trips user/assistant messages with sources', async () => {
    const userId = await addChatMessage('user', 'hello');
    const assistantId = await addChatMessage('assistant', 'hi there', [
      { docId: 7, title: 'Seven', snippet: 'snippet' },
    ]);

    const messages = await listChatMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0].id).toBe(userId);
    expect(messages[0].role).toBe('user');
    expect(messages[0].sources).toEqual([]);
    expect(messages[1].id).toBe(assistantId);
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].sources).toEqual([
      { docId: 7, title: 'Seven', snippet: 'snippet' },
    ]);
  });

  it('clears history', async () => {
    await addChatMessage('user', 'a');
    await addChatMessage('assistant', 'b');
    await clearChatMessages();
    expect(await listChatMessages()).toHaveLength(0);
  });
});

describe('reciprocal rank fusion', () => {
  it('merges keyword-only hits', () => {
    const hits = reciprocalRankFusion(
      [
        { docId: 1, title: 'One', parentId: null, snippet: 's', rank: 0 },
        { docId: 2, title: 'Two', parentId: null, snippet: 't', rank: 1 },
      ],
      [],
    );
    expect(hits).toHaveLength(2);
    expect(hits[0].docId).toBe(1);
    expect(hits[0].fromKeyword).toBe(true);
    expect(hits[0].fromVector).toBe(false);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it('adds vector signal and dedups by doc', () => {
    const hits = reciprocalRankFusion(
      [{ docId: 5, title: 'Five', parentId: null, snippet: 'kw', rank: 0 }],
      [
        { docId: 5, chunkIndex: 0, chunkText: 'vec-best', distance: 0.1 },
        { docId: 5, chunkIndex: 1, chunkText: 'vec-worse', distance: 0.9 },
        { docId: 9, chunkIndex: 0, chunkText: 'nine', distance: 0.2 },
      ],
    );
    expect(hits).toHaveLength(2);
    const five = hits.find((h) => h.docId === 5)!;
    expect(five.fromKeyword).toBe(true);
    expect(five.fromVector).toBe(true);
    expect(five.snippet).toBe('kw'); // snippet keyword dipertahankan
    const nine = hits.find((h) => h.docId === 9)!;
    expect(nine.fromKeyword).toBe(false);
    expect(nine.fromVector).toBe(true);
    expect(nine.snippet).toBe('nine');
  });

  it('orders by combined rrf', () => {
    const hits = reciprocalRankFusion(
      [
        { docId: 1, title: 'One', parentId: null, snippet: '', rank: 0 },
        { docId: 2, title: 'Two', parentId: null, snippet: '', rank: 1 },
      ],
      [{ docId: 2, chunkIndex: 0, chunkText: 'two-vec', distance: 0.0 }],
    );
    expect(hits[0].docId).toBe(2); // keyword rank 1 + vector rank 1 menang
  });
});

describe('RAG prompt building', () => {
  const sources = [
    { docId: 1, title: 'Alpha', snippet: 'first note content', fromKeyword: true, fromVector: false, score: 2 },
    { docId: 2, title: 'Beta', snippet: 'second note content', fromKeyword: false, fromVector: true, score: 1 },
  ];

  it('builds a grounded system prompt with citations', () => {
    const prompt = buildRagSystemPrompt(sources);
    expect(prompt).toContain('You are Understory');
    expect(prompt).toContain('[1] (from: "Alpha")');
    expect(prompt).toContain('[2] (from: "Beta")');
    expect(prompt).toContain('first note content');
    expect(prompt).toContain('do not invent facts');
  });

  it('assembles messages: system + history (last 6) + query', () => {
    const history = Array.from({ length: 8 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `msg ${i}`,
    }));
    const messages = buildRagMessages({ sources, history, query: 'the question' });
    expect(messages[0].role).toBe('system');
    // 1 sistem + 6 pesan riwayat terakhir + 1 pertanyaan.
    expect(messages.length).toBe(8);
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: 'the question' });
  });

  it('truncates long snippets', () => {
    expect(truncateSnippet('a'.repeat(5000)).length).toBeLessThan(1500);
    expect(truncateSnippet('short text')).toBe('short text');
  });
});

describe('hybrid search integration', () => {
  it('surfaces vector-only hits when keywords miss', async () => {
    const docA = await createDocument({ parentId: null, title: 'A', content: 'xylophone zephyr voyage' });
    await updateDocumentContent(docA, 'xylophone zephyr voyage');
    await replaceDocEmbeddings(docA, [{ index: 0, text: 'xylophone zephyr voyage' }], [fakeEmbedding(1)]);

    const docB = await createDocument({ parentId: null, title: 'B', content: 'cat sat on the mat' });
    await updateDocumentContent(docB, 'cat sat on the mat');

    // Query tak cocok dengan keyword mana pun, tapi vektor dekat dengan A.
    (embedText as jest.Mock).mockResolvedValueOnce(fakeEmbedding(1));

    const { results, usedVector } = await hybridSearch('zzz', 10);
    expect(usedVector).toBe(true);
    const a = results.find((r) => r.docId === docA);
    expect(a).toBeDefined();
    expect(a!.fromVector).toBe(true);
    expect(a!.fromKeyword).toBe(false);
    expect(results.find((r) => r.docId === docB)).toBeUndefined();
  });

  it('returns keyword-only results when embedding unavailable', async () => {
    (embedText as jest.Mock).mockResolvedValueOnce(null);
    const docId = await createDocument({ parentId: null, title: 'Pineapple', content: 'a pineapple note' });

    const { results, usedVector } = await hybridSearch('pineapple', 10);
    expect(usedVector).toBe(false);
    expect(results[0].docId).toBe(docId);
    expect(results[0].fromKeyword).toBe(true);
  });
});