import { useEffect, useState } from 'react';
import { create } from 'zustand';

import {
  createDocument as dbCreate,
  deleteDocument as dbDelete,
  getDocument,
  listAllDocuments,
  moveDocument as dbMove,
  renameDocument as dbRename,
  setPinned as dbSetPinned,
  type DocumentRow,
} from '../db/documents';

interface DocumentsState {
  ready: boolean;
  rows: DocumentRow[];
  expandedIds: Set<number>;
  refresh: () => Promise<void>;
  create: (
    parentId: number | null,
    title: string,
    content?: string,
  ) => Promise<number>;
  rename: (id: number, title: string) => Promise<void>;
  deleteDocument: (id: number) => Promise<void>;
  move: (id: number, parentId: number | null, index: number) => Promise<void>;
  setPinned: (id: number, pinned: boolean) => Promise<void>;
  setExpanded: (id: number, expanded: boolean) => void;
  toggleExpanded: (id: number) => void;
}

export const useDocumentsStore = create<DocumentsState>()((set, get) => ({
  ready: false,
  rows: [],
  expandedIds: new Set<number>(),

  refresh: async () => {
    const rows = await listAllDocuments();
    set({ rows, ready: true });
  },

  create: async (parentId, title, content) => {
    const id = await dbCreate({ parentId, title, content });
    if (parentId !== null) {
      const next = new Set(get().expandedIds);
      next.add(parentId);
      set({ expandedIds: next });
    }
    await get().refresh();
    return id;
  },

  rename: async (id, title) => {
    await dbRename(id, title);
    await get().refresh();
  },

  deleteDocument: async (id) => {
    await dbDelete(id);
    await get().refresh();
  },

  move: async (id, parentId, index) => {
    await dbMove(id, parentId, index);
    await get().refresh();
  },

  setPinned: async (id, pinned) => {
    await dbSetPinned(id, pinned);
    await get().refresh();
  },

  setExpanded: (id, expanded) => {
    const next = new Set(get().expandedIds);
    if (expanded) {
      next.add(id);
    } else {
      next.delete(id);
    }
    set({ expandedIds: next });
  },

  toggleExpanded: (id) => {
    const next = new Set(get().expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ expandedIds: next });
  },
}));

// Baca satu dokumen langsung dari DB; mengikuti perubahan id.
export function useDocumentRow(id: number | null): DocumentRow | null {
  const [doc, setDoc] = useState<DocumentRow | null>(null);
  useEffect(() => {
    if (id === null) {
      setDoc(null);
      return;
    }
    let cancelled = false;
    getDocument(id).then((d) => {
      if (!cancelled) {
        setDoc(d);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  return doc;
}