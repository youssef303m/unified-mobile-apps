// The small async database interface the content layer uses. The app implements it with
// expo-sqlite (expoDb.ts); tests use better-sqlite3 (__tests__/testDb.ts). SQL is written once.

export type SqlValue = string | number | null;

export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: readonly SqlValue[]): Promise<T | undefined>;
  /** Runs `task` in one exclusive transaction; rolls back if it throws. */
  transaction(task: (tx: Db) => Promise<void>): Promise<void>;
}
