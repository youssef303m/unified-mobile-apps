// 1: categories, items, the FTS5 index (kept in sync by triggers), sync state.
export const initial = `
  CREATE TABLE categories (
    playlist_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('live', 'movie', 'series')),
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    parent_id TEXT NOT NULL DEFAULT '0',
    -- R-060 test A (xxx, adult, porn): PIN lock, search, favourites, history.
    is_adult INTEGER NOT NULL DEFAULT 0,
    -- R-060 test B (also "sex"): kept out of Top Rated / Newly Added / Recently Added.
    hide_from_rows INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (playlist_id, kind, category_id)
  );

  CREATE TABLE items (
    id INTEGER PRIMARY KEY,
    playlist_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('live', 'movie', 'series')),
    item_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    num REAL,
    rating REAL,
    added INTEGER,
    extension TEXT,
    url TEXT,
    cmd TEXT,
    tv_archive INTEGER NOT NULL DEFAULT 0,
    tv_archive_duration INTEGER NOT NULL DEFAULT 0,
    data TEXT
  );
  CREATE INDEX items_by_category ON items (playlist_id, kind, category_id, position);
  CREATE INDEX items_by_id ON items (playlist_id, kind, item_id);

  CREATE VIRTUAL TABLE items_fts USING fts5 (
    name,
    content = 'items',
    content_rowid = 'id',
    tokenize = 'unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
    INSERT INTO items_fts (rowid, name) VALUES (new.id, new.name);
  END;
  CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
    INSERT INTO items_fts (items_fts, rowid, name) VALUES ('delete', old.id, old.name);
  END;

  CREATE TABLE sync_state (
    playlist_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    synced_at INTEGER NOT NULL,
    item_count INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, kind)
  );
  `;
