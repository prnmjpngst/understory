import { create } from 'zustand';

import type { DownloadProgress } from '../ai/models';

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AiState {
  // Status model lokal (dimuat via llama.rn).
  chatStatus: ModelStatus;
  chatLoadProgress: number;
  chatError: string | null;
  embeddingStatus: ModelStatus;
  embeddingLoadProgress: number;
  embeddingError: string | null;

  // Jumlah chunk yang sudah di-index (untuk dashboard).
  indexedChunks: number;
  embeddingQueue: number; // antrean dokumen menunggu embedding.

  // Unduhan model.
  downloads: Record<string, DownloadProgress>;
  downloading: string[];

  // Streaming jawaban chat.
  chatStreaming: boolean;
  chatStreamText: string;

  setChatStatus: (status: ModelStatus, progress: number, error?: string | null) => void;
  setEmbeddingStatus: (status: ModelStatus, progress: number, error?: string | null) => void;
  setIndexedChunks: (count: number) => void;
  setEmbeddingQueue: (count: number) => void;
  startDownload: (specId: string) => void;
  updateDownload: (specId: string, progress: DownloadProgress) => void;
  finishDownload: (specId: string) => void;
  setChatStreaming: (streaming: boolean, text?: string) => void;
}

export const useAiStore = create<AiState>()((set) => ({
  chatStatus: 'idle',
  chatLoadProgress: 0,
  chatError: null,
  embeddingStatus: 'idle',
  embeddingLoadProgress: 0,
  embeddingError: null,

  indexedChunks: 0,
  embeddingQueue: 0,

  downloads: {},
  downloading: [],

  chatStreaming: false,
  chatStreamText: '',

  setChatStatus: (status, progress, error = null) =>
    set({ chatStatus: status, chatLoadProgress: progress, chatError: error }),

  setEmbeddingStatus: (status, progress, error = null) =>
    set({
      embeddingStatus: status,
      embeddingLoadProgress: progress,
      embeddingError: error,
    }),

  setIndexedChunks: (count) => set({ indexedChunks: count }),
  setEmbeddingQueue: (count) => set({ embeddingQueue: count }),

  startDownload: (specId) =>
    set((s) => ({
      downloading: s.downloading.includes(specId)
        ? s.downloading
        : [...s.downloading, specId],
      downloads: { ...s.downloads, [specId]: { bytesWritten: 0, bytesTotal: 1, fraction: 0 } },
    })),

  updateDownload: (specId, progress) =>
    set((s) => ({ downloads: { ...s.downloads, [specId]: progress } })),

  finishDownload: (specId) =>
    set((s) => {
      const next = { ...s.downloads };
      delete next[specId];
      return { downloading: s.downloading.filter((id) => id !== specId), downloads: next };
    }),

  setChatStreaming: (streaming: boolean, text?: string) =>
    set({ chatStreaming: streaming, chatStreamText: text }),
}));