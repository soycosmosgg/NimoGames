CREATE TABLE IF NOT EXISTS site_messages (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  message TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO site_messages (id, message, updated_at)
VALUES (1, '', 0);
