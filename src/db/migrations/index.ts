// Ordered migrations; the index + 1 is the schema version (PRAGMA user_version).
import { initial } from "./001_initial";

export const MIGRATIONS: readonly string[] = [initial];
