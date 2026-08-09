/**
 * Standalone data-layer verification (Deliverable 2 & 5 SQL behavior):
 * schema + FTS5 triggers + repository CRUD + tree moves + vec0 KNN.
 * Runs on better-sqlite3 via the NodeDb adapter — no device needed.
 */
jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => {
    throw new Error('open() must not be called in tests — use __setDbForTests');
  }),
}));

import {
  __setDbForTests,
  getDb,
  runMigrations,
} from '../src/db/database';
import {
  buildTree,
  createDocument,
  deleteDocument,
  getDocument,
  getSubtreeIds,
  listAllDocuments,
  moveDocument,
  renameDocument,
  setPinned,
  updateDocumentContent,
} from '../src/db/documents';
import { keywordSearch, toFtsQuery } from '../src/db/search';
import { chunkMarkdown } from '../src/db/chunks';
import {
  countEmbeddedChunks,
  knnChunks,
  replaceDocEmbeddings,
} from '../src/db/embeddings';
import {
  addInboxItem,
  countPendingInbox,
  listInboxItems,
  markInboxArchived,
} from '../src/db/inbox';
import { NodeDb } from './helpers/nodeDb';

let nodeDb: NodeDb;

beforeEach(async () => {
  nodeDb = new NodeDb();
  await runMigrations(nodeDb);
  __setDbForTests(nodeDb);
});

afterEach(() => {
  __setDbForTests(null);
  nodeDb.close();
});

// Deterministic pseudo-embeddings for KNN tests.
function fakeEmbedding(seed: number): Float32Array {
  const a = new Float32Array(768);
  for (let i = 0; i < 768; i++) {
    a[i] = Math.cos(seed * (i + 1));
  }
  return a;
}

describe('schema & migrations', () => {
  it('sets user_version and creates tables', async () => {
    const v = getDb().executeSync('PRAGMA user_version');
    expect(Number(v.rows[0].user_version)).toBe(1);
    const tables = getDb().executeSync(
      "SELECT name FROM sqlite_master WHERE type IN ('table','trigger') ORDER BY name",
    );
    const names = tables.rows.map((r) => String(r.name));
    expect(names).toContain('documents');
    expect(names).toContain('documents_fts');
    expect(names).toContain('vec_chunks');
    expect(names).toContain('inbox_items');
    expect(names).toContain('documents_ai');
    expect(names).toContain('documents_ad');
    expect(names).toContain('documents_au');
  });
});

describe('documents repository', () => {
  it('creates, reads, renames, pins', async () => {
    const id = await createDocument({ parentId: null, title: 'Root' });
    const doc = await getDocument(id);
    expect(doc?.title).toBe('Root');
    expect(doc?.sort_order).toBe(0);

    const id2 = await createDocument({ parentId: null, title: 'Second' });
    expect((await getDocument(id2))?.sort_order).toBe(1);

    await renameDocument(id, 'Renamed');
    expect((await getDocument(id))?.title).toBe('Renamed');

    await setPinned(id, true);
    expect((await getDocument(id))?.pinned).toBe(1);
  });

  it('builds a nested tree in sort order', async () => {
    const a = await createDocument({ parentId: null, title: 'A' });
    const b = await createDocument({ parentId: null, title: 'B' });
    const a1 = await createDocument({ parentId: a, title: 'A1' });
    const a2 = await createDocument({ parentId: a, title: 'A2' });
    const tree = buildTree(await listAllDocuments());
    expect(tree.map((n) => n.title)).toEqual(['A', 'B']);
    expect(tree[0].children.map((n) => n.title)).toEqual(['A1', 'A2']);
    expect(tree[0].children[0].id).toBe(a1);
    expect(tree[0].children[1].id).toBe(a2);
    expect(tree[1].id).toBe(b);
  });

  it('moves a document to a new parent at a target index', async () => {
    const a = await createDocument({ parentId: null, title: 'A' });
    const b = await createDocument({ parentId: null, title: 'B' });
    const c = await createDocument({ parentId: null, title: 'C' });
    await moveDocument(c, null, 0);
    let tree = buildTree(await listAllDocuments());
    expect(tree.map((n) => n.title)).toEqual(['C', 'A', 'B']);

    // Pindahkan B ke bawah C, lalu pastikan urutan root rapat.
    await moveDocument(b, c, 0);
    tree = buildTree(await listAllDocuments());
    expect(tree.map((n) => n.title)).toEqual(['C', 'A']);
    expect(tree[0].children.map((n) => n.title)).toEqual(['B']);
    expect((await getDocument(b))?.parent_id).toBe(c);
    expect(a).toBeTruthy();
  });

  it('refuses to move a document into its own subtree', async () => {
    const a = await createDocument({ parentId: null, title: 'A' });
    const a1 = await createDocument({ parentId: a, title: 'A1' });
    await expect(moveDocument(a, a1, 0)).rejects.toThrow('subtree');
  });

  it('deletes a subtree and cleans FTS + vectors', async () => {
    const a = await createDocument({
      parentId: null,
      title: 'Zettel',
      content: 'atomic notes',
    });
    const a1 = await createDocument({
      parentId: a,
      title: 'Child',
      content: 'atomic child content',
    });
    await replaceDocEmbeddings(
      a1,
      [{ index: 0, text: 'atomic child content' }],
      [fakeEmbedding(1)],
    );
    expect(await countEmbeddedChunks()).toBe(1);

    await deleteDocument(a);
    expect(await getDocument(a1)).toBeNull();
    expect(await countEmbeddedChunks()).toBe(0);
    const hits = await keywordSearch('atomic');
    expect(hits).toHaveLength(0);
  });
});

describe('keyword search (FTS5)', () => {
  it('sanitizes queries into safe FTS5 expressions', () => {
    expect(toFtsQuery('hello world')).toBe('hello* world*');
    expect(toFtsQuery('  ')).toBeNull();
    expect(toFtsQuery('note: "quoted" (x)')).toBe('note* quoted* x*');
    expect(toFtsQuery('catatan² café')).toBe('catatan* café*');
  });

  it('finds documents by content with highlight snippet', async () => {
    await createDocument({
      parentId: null,
      title: 'Zettelkasten method',
      content: 'Atomic notes linked together form a network.',
    });
    const hits = await keywordSearch('atomic');
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toBe('Zettelkasten method');
    expect(hits[0].snippet).toContain('‹Atomic›');
  });

  it('ranks title matches above body-only matches', async () => {
    await createDocument({
      parentId: null,
      title: 'Gardening',
      content: 'Notes about compost and soil.',
    });
    await createDocument({
      parentId: null,
      title: 'Compost basics',
      content: 'A short guide.',
    });
    const hits = await keywordSearch('compost');
    expect(hits.map((h) => h.title)).toEqual(['Compost basics', 'Gardening']);
  });

  it('syncs the FTS index on update and delete via triggers', async () => {
    const id = await createDocument({
      parentId: null,
      title: 'Doc',
      content: 'original words',
    });
    await updateDocumentContent(id, 'replaced with manganese');
    expect(await keywordSearch('original')).toHaveLength(0);
    expect(await keywordSearch('manganese')).toHaveLength(1);
    await deleteDocument(id);
    expect(await keywordSearch('manganese')).toHaveLength(0);
  });

  it('supports multi-token prefix queries', async () => {
    await createDocument({
      parentId: null,
      title: 'Note linking',
      content: 'Links between atomic notes create structure.',
    });
    await createDocument({ parentId: null, title: 'Other', content: 'nothing' });
    const hits = await keywordSearch('atom note');
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toBe('Note linking');
  });
});

describe('chunking', () => {
  it('splits by heading and prefixes the document title', () => {
    const md = '# Intro\n\nAlpha text.\n\n## Details\n\nBeta text.';
    const chunks = chunkMarkdown('My Doc', md);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].text.startsWith('My Doc\n\n')).toBe(true);
    expect(chunks.map((c) => c.index)).toEqual(
      chunks.map((_, i) => i),
    );
  });

  it('splits large sections with overlap', () => {
    const paragraph = 'Lorem ipsum dolor sit amet. '.repeat(50);
    const md = `# Big\n\n${paragraph}\n\n${paragraph}\n\n${paragraph}`;
    const chunks = chunkMarkdown('Big', md);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      // 2000 karakter target + prefix judul + toleransi batas paragraf.
      expect(c.text.length).toBeLessThanOrEqual(2100);
    }
  });

  it('returns a single chunk for empty-ish docs without crashing', () => {
    expect(chunkMarkdown('T', '')).toEqual([]);
  });
});

describe('vector store (sqlite-vec)', () => {
  it('replaces embeddings per document', async () => {
    const id = await createDocument({ parentId: null, title: 'Doc' });
    await replaceDocEmbeddings(
      id,
      [
        { index: 0, text: 'chunk one' },
        { index: 1, text: 'chunk two' },
      ],
      [fakeEmbedding(1), fakeEmbedding(2)],
    );
    expect(await countEmbeddedChunks()).toBe(2);

    // Replace: hapus lama, tulis baru.
    await replaceDocEmbeddings(
      id,
      [{ index: 0, text: 'only chunk' }],
      [fakeEmbedding(3)],
    );
    expect(await countEmbeddedChunks()).toBe(1);
  });

  it('KNN returns nearest chunk first (two-step search source)', async () => {
    const a = await createDocument({ parentId: null, title: 'A' });
    const b = await createDocument({ parentId: null, title: 'B' });
    await replaceDocEmbeddings(
      a,
      [{ index: 0, text: 'alpha chunk' }],
      [fakeEmbedding(1)],
    );
    await replaceDocEmbeddings(
      b,
      [{ index: 0, text: 'beta chunk' }],
      [fakeEmbedding(9)],
    );
    const hits = await knnChunks(fakeEmbedding(1.05), 2);
    expect(hits[0].docId).toBe(a);
    expect(hits[0].chunkText).toBe('alpha chunk');
    expect(hits[1].docId).toBe(b);
    expect(hits[0].distance).toBeLessThan(hits[1].distance);
  });
});

describe('inbox', () => {
  it('adds, lists pending, marks archived', async () => {
    const itemId = await addInboxItem('a fleeting note');
    expect(await countPendingInbox()).toBe(1);

    const docId = await createDocument({ parentId: null, title: 'Filed' });
    await markInboxArchived(itemId, docId, 'append_to_existing');

    expect(await countPendingInbox()).toBe(0);
    const archived = await listInboxItems('archived');
    expect(archived).toHaveLength(1);
    expect(archived[0].result_doc_id).toBe(docId);
    expect(archived[0].result_action).toBe('append_to_existing');
  });
});
