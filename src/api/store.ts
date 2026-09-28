// The small persistent key-value store that some API modules need (the domain-list cache, the
// Stalker quirks cache). The app passes the MMKV wrapper; tests pass
// `memoryStore()`. Keys are the full keys (prefix included where the TV uses one).

export interface KeyValueStore {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** Every stored key (key renames on a new playlist id, Clear Cache). */
  keys(): string[];
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const values = new Map(Object.entries(initial));
  return {
    get: (key) => values.get(key),
    set: (key, value) => void values.set(key, value),
    remove: (key) => void values.delete(key),
    keys: () => [...values.keys()],
  };
}

export function readJson<T>(store: KeyValueStore, key: string): T | undefined {
  const raw = store.get(key);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}
