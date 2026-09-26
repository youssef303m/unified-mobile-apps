// better-sqlite3 implementation of Db for tests (a real SQLite with FTS5, like expo-sqlite's
// Android build), used by the core tests.
import Database from "better-sqlite3";

import type { Db, SqlValue } from "../database";
import { migrate } from "../schema";

export async function openTestDb(): Promise<Db> {
  const native = new Database(":memory:");
  let depth = 0;
  const db: Db = {
    exec: async (sql) => void native.exec(sql),
    run: async (sql, params: readonly SqlValue[] = []) => ({
      changes: native.prepare(sql).run(...params).changes,
    }),
    all: async <T>(sql: string, params: readonly SqlValue[] = []) =>
      native.prepare(sql).all(...params) as T[],
    first: async <T>(sql: string, params: readonly SqlValue[] = []) =>
      native.prepare(sql).get(...params) as T | undefined,
    transaction: async (task) => {
      // Nested calls join the outer transaction (as expo-sqlite's exclusive transaction does).
      if (depth > 0) return task(db);
      depth++;
      native.exec("BEGIN IMMEDIATE");
      try {
        await task(db);
        native.exec("COMMIT");
      } catch (error) {
        native.exec("ROLLBACK");
        throw error;
      } finally {
        depth--;
      }
    },
  };
  await migrate(db);
  return db;
}
