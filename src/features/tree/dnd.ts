// Model baris datar untuk pohon dokumen + kalkulasi target drop.
// Memakai "flat rows" (bukan rekursif) supaya drag&drop bisa menghitung posisi
// setiap baris dalam satu koordinat konten yang konsisten.
import type { DocumentNode } from '../../db/documents';

export interface FlatRow {
  id: number;
  title: string;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  parentId: number | null;
  index: number;
  childCount: number;
}

export function flattenTree(
  roots: DocumentNode[],
  expanded: Set<number>,
): FlatRow[] {
  const out: FlatRow[] = [];
  const visit = (nodes: DocumentNode[], depth: number) => {
    nodes.forEach((node, sibIndex) => {
      const isExpanded = expanded.has(node.id);
      const visibleChildren = isExpanded ? node.children : [];
      out.push({
        id: node.id,
        title: node.title,
        depth,
        hasChildren: node.children.length > 0,
        expanded: isExpanded,
        parentId: node.parent_id,
        index: sibIndex,
        childCount: node.children.length,
      });
      if (visibleChildren.length > 0) {
        visit(visibleChildren, depth + 1);
      }
    });
  };
  visit(roots, 0);
  return out;
}

export interface RowGeom {
  y: number;
  h: number;
  depth: number;
  hasChildren: boolean;
  childCount: number;
  parentId: number | null;
  index: number;
}

export type DropAction = 'before' | 'after' | 'into';

export interface DropTarget {
  action: DropAction;
  rowId: number;
  parentId: number | null;
  index: number;
  depth: number;
}

export type GeomMap = Record<number, RowGeom>;
export type BlockedMap = Record<number, true>;

// Keputusan target drop (worklet, tanpa alokasi besar).
// `py` adalah posisi pointer dalam koordinat konten (bukan viewport) —
// sudah memperhitungkan scroll + posisi jari.
export function decideDropTarget(
  py: number,
  draggedId: number,
  order: number[],
  geom: GeomMap,
  blocked: BlockedMap,
): DropTarget | null {
  'worklet';
  let lastRowId: number | null = null;
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const g = geom[id];
    if (!g) {
      continue;
    }
    lastRowId = id;
    const yTop = g.y;
    const yBot = g.y + g.h;

    if (py < yTop) {
      if (!blocked[id]) {
        return {
          action: 'before',
          rowId: id,
          parentId: g.parentId,
          index: g.index,
          depth: g.depth,
        };
      }
      continue;
    }
    if (py <= yBot) {
      if (blocked[id]) {
        continue;
      }
      const rel = py - yTop;
      // Zona atas = letakkan SEBELUM baris, zona bawah = SESUDAH,
      // zona tengah = MASUKAN anak terakhir (hanya bila folde).
      if (rel <= g.h * 0.3) {
        return {
          action: 'before',
          rowId: id,
          parentId: g.parentId,
          index: g.index,
          depth: g.depth,
        };
      }
      if (rel >= g.h * 0.7) {
        return {
          action: 'after',
          rowId: id,
          parentId: g.parentId,
          index: g.index + 1,
          depth: g.depth,
        };
      }
      if (g.hasChildren) {
        return {
          action: 'into',
          rowId: id,
          parentId: id,
          index: g.childCount,
          depth: g.depth + 1,
        };
      }
      return {
        action: 'after',
        rowId: id,
        parentId: g.parentId,
        index: g.index + 1,
        depth: g.depth,
      };
    }
  }
  if (lastRowId !== null && !blocked[lastRowId]) {
    const g = geom[lastRowId];
    return {
      action: 'after',
      rowId: lastRowId,
      parentId: g.parentId,
      index: g.index + 1,
      depth: g.depth,
    };
  }
  return null;
}

// Kumpulkan id subpohon yang dilarang sebagai target (diri sendiri + keturunan).
export function buildBlockedMap(
  draggedId: number,
  geom: GeomMap,
): BlockedMap {
  const children = new Map<number, number[]>();
  const order: number[] = Object.keys(geom).map(Number).sort((a, b) => geom[a].y - geom[b].y);
  for (const id of order) {
    const g = geom[id];
    if (g.parentId !== null) {
      const list = children.get(g.parentId) ?? [];
      list.push(id);
      children.set(g.parentId, list);
    }
  }
  const blocked: BlockedMap = {};
  const stack = [draggedId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (blocked[id]) {
      continue;
    }
    blocked[id] = true;
    stack.push(...(children.get(id) ?? []));
  }
  return blocked;
}