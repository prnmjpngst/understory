import { getDb } from './database';

export type ChatRole = 'user' | 'assistant';

// Sources cited when answering: chunks retrieved from the user's notes.
export interface ChatSource {
  docId: number;
  title: string;
  snippet: string;
}

export interface ChatMessage {
  id: number;
  role: ChatRole;
  content: string;
  sources: ChatSource[];
  created_at: number;
}

function toChatSource(raw: unknown): ChatSource {
  const s = (raw ?? {}) as Partial<ChatSource>;
  return {
    docId: Number(s.docId ?? 0),
    title: String(s.title ?? ''),
    snippet: String(s.snippet ?? ''),
  };
}

function parseSources(json: string | null): ChatSource[] {
  if (!json) {
    return [];
  }
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(toChatSource);
  } catch {
    return [];
  }
}

function toChatMessage(raw: Record<string, unknown>): ChatMessage {
  return {
    id: Number(raw.id),
    role: raw.role === 'assistant' ? 'assistant' : 'user',
    content: String(raw.content ?? ''),
    sources: parseSources(raw.sources_json === null ? null : String(raw.sources_json)),
    created_at: Number(raw.created_at ?? 0),
  };
}

export async function addChatMessage(
  role: ChatRole,
  content: string,
  sources?: ChatSource[],
): Promise<number> {
  const db = getDb();
  const sourcesJson = sources && sources.length > 0 ? JSON.stringify(sources) : null;
  const res = await db.execute(
    `INSERT INTO chat_messages(role, content, sources_json, created_at)
     VALUES (?, ?, ?, ?)`,
    [role, content, sourcesJson, Date.now()],
  );
  return Number(res.insertId);
}

export async function listChatMessages(): Promise<ChatMessage[]> {
  const db = getDb();
  const res = await db.execute(
    'SELECT * FROM chat_messages ORDER BY created_at ASC, id ASC',
  );
  return res.rows.map(toChatMessage);
}

export async function deleteChatMessage(id: number): Promise<void> {
  const db = getDb();
  await db.execute('DELETE FROM chat_messages WHERE id = ?', [id]);
}

export async function clearChatMessages(): Promise<void> {
  const db = getDb();
  await db.execute('DELETE FROM chat_messages');
}

export async function countChatMessages(): Promise<number> {
  const db = getDb();
  const res = await db.execute('SELECT count(*) AS c FROM chat_messages');
  return Number(res.rows[0]?.c ?? 0);
}