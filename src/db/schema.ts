// Catalogue schema (04-build/architecture.md: catalogues live in SQLite, searched with FTS5).
// One database for every playlist; rows carry the playlist id. Migrations run by user_version.
import type { Db } from "./database";
import { MIGRATIONS } from "./migrations";

export type Kind = "live" | "movie" | "series";

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: Db): Promise<void> {
  const row = await db.first<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.transaction(async (tx) => {
      await tx.exec(MIGRATIONS[version] as string);
      await tx.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
