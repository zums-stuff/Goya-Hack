// lib/snapshots.ts — In-memory store for cross-request state when needed.
// Solo para Bloque 0. En producción todo es DB o cache distribuido.
type Entry = { id: string; createdAt: number };
const map = new Map<string, Entry>();

class SnapshotStore {
  record(id: string) {
    map.set(id, { id, createdAt: Date.now() });
  }
  get(id: string): Entry | undefined {
    return map.get(id);
  }
  clear() {
    map.clear();
  }
}

export const escrowSnapshotStore = new SnapshotStore();
