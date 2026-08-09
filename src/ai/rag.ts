import type { RNLlamaOAICompatibleMessage } from 'llama.rn';

import { addChatMessage } from '../db/chat';
import { getDocument } from '../db/documents';
import { streamChatCompletion, type ChatTurn } from './llama';
import {
  hybridSearch,
  type RetrievalSource,
} from './retrieval';

const MAX_CONTEXT_SOURCES = 6;

// Potong teks chunk agar prompt tidak meledak. Murni, bisa diuji.
export function truncateSnippet(text: string, maxChars = 1400): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}…`;
}

// Susun prompt sistem untuk RAG dengan kutipan [n]. Murni, bisa diuji.
export function buildRagSystemPrompt(sources: RetrievalSource[]): string {
  const excerpts = sources
    .map(
      (s, i) =>
        `[${i + 1}] (from: "${s.title}")\n${truncateSnippet(s.snippet)}`,
    )
    .join('\n\n');

  return [
    'You are Understory, a personal assistant grounded only in the user\'s own notes.',
    'Answer the question using ONLY the note excerpts below. Cite the sources you rely',
    'on inline like [1], [2] (the number refers to the excerpt list).',
    'If the excerpts do not contain the answer, say so clearly and do not invent facts.',
    '',
    'Note excerpts:',
    excerpts,
  ].join('\n');
}

export function buildRagMessages(params: {
  sources: RetrievalSource[];
  history: ChatTurn[];
  query: string;
}): RNLlamaOAICompatibleMessage[] {
  const { sources, history, query } = params;
  const system = buildRagSystemPrompt(sources);
  const messages: RNLlamaOAICompatibleMessage[] = [{ role: 'system', content: system }];

  // Riwayat dibatasi beberapa pesan terakhir agar konteks model tidak penuh.
  const recentHistory = history.slice(-6);
  for (const turn of recentHistory) {
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: 'user', content: query });
  return messages;
}

// Siapkan sumber relevan untuk query — dipakai oleh chat. Mengembalikan daftar
// sumber dan apakah pencarian semantik ikut dipakai.
export async function retrieveForQuery(
  query: string,
): Promise<{ sources: RetrievalSource[]; usedVector: boolean }> {
  const { results, usedVector } = await hybridSearch(query, MAX_CONTEXT_SOURCES);
  const sources = results.slice(0, MAX_CONTEXT_SOURCES).map((s, i) => ({
    ...s,
    score: MAX_CONTEXT_SOURCES - i,
  }));
  return { sources, usedVector };
}

export interface AskResult {
  content: string;
  sources: RetrievalSource[];
  usedVector: boolean;
}

// Tanya catatan: retriemen → streaming LLM → simpan riwayat chat.
export async function askNotes(params: {
  query: string;
  history: ChatTurn[];
  onToken?: (delta: string, full: string) => void;
}): Promise<AskResult> {
  const { query, history, onToken } = params;
  const { sources, usedVector } = await retrieveForQuery(query);

  await addChatMessage('user', query);
  const messages = buildRagMessages({ sources, history, query });
  const result = await streamChatCompletion(messages, onToken ?? (() => {}));

  const cleanText = result.text.trim();
  const keptSources = sources.map((s) => ({
    docId: s.docId,
    title: s.title,
    snippet: truncateSnippet(s.snippet, 200),
  }));

  // Pastikan dokumen sumber masih ada sebelum dipakai sebagai kutipan.
  const existing: typeof keptSources = [];
  for (const src of keptSources) {
    const doc = await getDocument(src.docId);
    if (doc) {
      existing.push(src);
    }
  }

  await addChatMessage('assistant', cleanText, existing);
  return { content: cleanText, sources, usedVector };
}