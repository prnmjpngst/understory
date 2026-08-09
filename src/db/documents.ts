import { getDb } from './database';

export interface DocumentRow {
  id: number;
  parent_id: number | null;
  title: string;
  content_markdown: string;
  sort_order: number;
  pinned: number;
  created_at: number;
  updated_at: number;
}

export interface DocumentNode extends DocumentRow {
  children: DocumentNode[];
}

function toDocumentRow(raw: Record<string, unknown>): DocumentRow {
  return {
    id: Number(raw.id),
    parent_id: raw.parent_id === null ? null : Number(raw.parent_id),
    title: String(raw.title ?? ''),
    content_markdown: String(raw.content_markdown ?? ''),
    sort_order: Number(raw.sort_order ?? 0),
    pinned: Number(raw.pinned ?? 0),
    created_at: Number(raw.created_at ?? 0),
    updated_at: Number(raw.updated_at ?? 0),
  };
}

export async function createDocument(params: {
  parentId: number | null;
  title: string;
  content?: string;
  sortOrder?: number;
}): Promise<number> {
  const db = getDb();
  const now = Date.now();
  let sortOrder = params.sortOrder;
  if (sortOrder === undefined) {
    const res = await db.execute(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM documents WHERE parent_id IS ?',
      [params.parentId],
    );
    sortOrder = Number(res.rows[0]?.next ?? 0);
  }
  const res = await db.execute(
    `INSERT INTO documents(parent_id, title, content_markdown, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [params.parentId, params.title, params.content ?? '', sortOrder, now, now],
  );
  return Number(res.insertId);
}

export async function getDocument(id: number): Promise<DocumentRow | null> {
  const db = getDb();
  const res = await db.execute('SELECT * FROM documents WHERE id = ?', [id]);
  return res.rows.length > 0 ? toDocumentRow(res.rows[0]) : null;
}

export async function listAllDocuments(): Promise<DocumentRow[]> {
  const db = getDb();
  const res = await db.execute(
    'SELECT * FROM documents ORDER BY sort_order ASC, id ASC',
  );
  return res.rows.map(toDocumentRow);
}

export async function renameDocument(id: number, title: string): Promise<void> {
  const db = getDb();
  await db.execute('UPDATE documents SET title = ?, updated_at = ? WHERE id = ?', [
    title,
    Date.now(),
    id,
  ]);
}

export async function updateDocumentContent(
  id: number,
  contentMarkdown: string,
): Promise<void> {
  const db = getDb();
  await db.execute(
    'UPDATE documents SET content_markdown = ?, updated_at = ? WHERE id = ?',
    [contentMarkdown, Date.now(), id],
  );
}

export async function setPinned(id: number, pinned: boolean): Promise<void> {
  const db = getDb();
  await db.execute('UPDATE documents SET pinned = ? WHERE id = ?', [
    pinned ? 1 : 0,
    id,
  ]);
}

// Mengumpulkan id seluruh keturunan dokumen (termasuk dirinya) — dipakai untuk
// mencegah pemindahan ke dalam subpohonnya sendiri dan untuk hapus embedding.
export async function getSubtreeIds(id: number): Promise<number[]> {
  const db = getDb();
  const res = await db.execute(
    `WITH RECURSIVE subtree(id) AS (
       SELECT id FROM documents WHERE id = ?
       UNION ALL
       SELECT d.id FROM documents d JOIN subtree s ON d.parent_id = s.id
     )
     SELECT id FROM subtree`,
    [id],
  );
  return res.rows.map((r) => Number(r.id));
}

// Memindahkan dokumen ke parent baru pada posisi targetIndex.
// Aturan: sort_order saudara lama & baru ditulis ulang agar rapat (0..n-1).
export async function moveDocument(
  id: number,
  newParentId: number | null,
  targetIndex: number,
): Promise<void> {
  const db = getDb();
  const moving = await getDocument(id);
  if (!moving) {
    return;
  }
  // Tolak pemindahan ke dalam subpohonnya sendiri (akan membuat siklus).
  if (newParentId !== null) {
    const subtree = await getSubtreeIds(id);
    if (subtree.includes(newParentId)) {
      throw new Error('Cannot move a document into its own subtree');
    }
  }

  await db.transaction(async (tx) => {
    const oldSiblings = await tx.execute(
      'SELECT id FROM documents WHERE parent_id IS ? AND id != ? ORDER BY sort_order',
      [moving.parent_id, id],
    );
    const newSiblings = await tx.execute(
      'SELECT id FROM documents WHERE parent_id IS ? AND id != ? ORDER BY sort_order',
      [newParentId, id],
    );

    const newIds = newSiblings.rows.map((r) => Number(r.id));
    const clamped = Math.max(0, Math.min(targetIndex, newIds.length));
    newIds.splice(clamped, 0, id);

    for (let i = 0; i < newIds.length; i++) {
      await tx.execute(
        'UPDATE documents SET parent_id = ?, sort_order = ? WHERE id = ?',
        [newParentId, i, newIds[i]],
      );
    }
    // Rapatkan urutan saudara lama jika parent berubah.
    if (moving.parent_id !== newParentId) {
      const oldIds = oldSiblings.rows.map((r) => Number(r.id));
      for (let i = 0; i < oldIds.length; i++) {
        await tx.execute('UPDATE documents SET sort_order = ? WHERE id = ?', [
          i,
          oldIds[i]],
        );
      }
    }
  });
}

// Menghapus dokumen beserta seluruh subpohonnya.
// FTS dibersihkan oleh trigger; vec_chunks dibersihkan manual di sini.
export async function deleteDocument(id: number): Promise<void> {
  const db = getDb();
  const subtreeIds = await getSubtreeIds(id);
  await db.transaction(async (tx) => {
    for (const subId of subtreeIds) {
      await tx.execute('DELETE FROM vec_chunks WHERE doc_id = CAST(? AS INTEGER)', [
        subId,
      ]);
    }
    await tx.execute('DELETE FROM documents WHERE id = ?', [id]);
  });
}

// Menyusun pohon dari daftar datar; anak diurutkan per sort_order.
// Dokumen pinned tidak dipisah di sini — pemisahan pinned adalah urusan UI.
export function buildTree(rows: DocumentRow[]): DocumentNode[] {
  const nodes = new Map<number, DocumentNode>();
  for (const row of rows) {
    nodes.set(row.id, { ...row, children: [] });
  }
  const roots: DocumentNode[] = [];
  for (const node of nodes.values()) {
    if (node.parent_id !== null && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (list: DocumentNode[]) => {
    list.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    for (const n of list) {
      sortRec(n.children);
    }
  };
  sortRec(roots);
  return roots;
}
