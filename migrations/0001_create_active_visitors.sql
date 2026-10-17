CREATE TABLE IF NOT EXISTS active_visitors (
  session_id TEXT PRIMARY KEY NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS active_visitors_last_seen_idx
  ON active_visitors (last_seen);
