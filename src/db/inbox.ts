import { getDb } from './database';

export type InboxStatus = 'pending' | 'archived';
export type ArchiveAction = 'append_to_existing' | 'create_new';

export interface InboxItem {
  id: number;
  content: string;
  status: InboxStatus;
  created_at: number;
  archived_at: number | null;
  result_doc_id: number | null;
  result_action: ArchiveAction | null;
}

function toInboxItem(raw: Record<string, unknown>): InboxItem {
  return {
    id: Number(raw.id),
    content: String(raw.content ?? ''),
    status: raw.status === 'archived' ? 'archived' : 'pending',
    created_at: Number(raw.created_at ?? 0),
    archived_at: raw.archived_at === null ? null : Number(raw.archived_at),
    result_doc_id: raw.result_doc_id === null ? null : Number(raw.result_doc_id),
    result_action:
      raw.result_action === 'append_to_existing' ||
      raw.result_action === 'create_new'
        ? raw.result_action
        : null,
  };
}

export async function addInboxItem(content: string): Promise<number> {
  const db = getDb();
  const res = await db.execute(
    'INSERT INTO inbox_items(content, created_at) VALUES (?, ?)',
    [content, Date.now()],
  );
  return Number(res.insertId);
}

export async function listInboxItems(
  status?: InboxStatus,
): Promise<InboxItem[]> {
  const db = getDb();
  const res = status
    ? await db.execute(
        'SELECT * FROM inbox_items WHERE status = ? ORDER BY created_at DESC',
        [status],
      )
    : await db.execute('SELECT * FROM inbox_items ORDER BY created_at DESC');
  return res.rows.map(toInboxItem);
}

export async function markInboxArchived(
  id: number,
  resultDocId: number,
  action: ArchiveAction,
): Promise<void> {
  const db = getDb();
  await db.execute(
    `UPDATE inbox_items
     SET status = 'archived', archived_at = ?, result_doc_id = ?, result_action = ?
     WHERE id = ?`,
    [Date.now(), resultDocId, action, id],
  );
}

export async function deleteInboxItem(id: number): Promise<void> {
  const db = getDb();
  await db.execute('DELETE FROM inbox_items WHERE id = ?', [id]);
}

export async function countPendingInbox(): Promise<number> {
  const db = getDb();
  const res = await db.execute(
    "SELECT count(*) AS c FROM inbox_items WHERE status = 'pending'",
  );
  return Number(res.rows[0]?.c ?? 0);
}
