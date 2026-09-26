// expo-sqlite implementation of Db (the catalogue database on the phone).
// expo-sqlite is a native module: it needs the development build made at the start of M3.
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import type { Db, SqlValue } from "./database";
import { migrate } from "./schema";

type Native = Pick<SQLiteDatabase, "execAsync" | "runAsync" | "getAllAsync" | "getFirstAsync">;

function wrap(native: Native, transaction: Db["transaction"]): Db {
  return {
    exec: (sql) => native.execAsync(sql),
    run: async (sql, params: readonly SqlValue[] = []) => {
      const result = await native.runAsync(sql, [...params]);
      return { changes: result.changes };
    },
    all: <T>(sql: string, params: readonly SqlValue[] = []) =>
      native.getAllAsync<T>(sql, [...params]),
    first: async <T>(sql: string, params: readonly SqlValue[] = []) =>
      (await native.getFirstAsync<T>(sql, [...params])) ?? undefined,
    transaction,
  };
}

export async function openCatalogueDb(name = "catalogue.db"): Promise<Db> {
  const native = await openDatabaseAsync(name);
  await native.execAsync("PRAGMA journal_mode = WAL;");
  const db = wrap(native, (task) =>
    native.withExclusiveTransactionAsync(async (txn) => {
      // Nested transactions join this one, on the transaction's own connection.
      const txDb: Db = wrap(txn, (inner) => inner(txDb));
      await task(txDb);
    }),
  );
  await migrate(db);
  return db;
}
