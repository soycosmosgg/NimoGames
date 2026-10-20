CREATE TABLE IF NOT EXISTS active_visitors (
  session_id TEXT PRIMARY KEY NOT NULL,
  last_seen INTEGER NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  game_id TEXT
);

CREATE INDEX IF NOT EXISTS active_visitors_last_seen_idx
  ON active_visitors (last_seen);

CREATE TABLE IF NOT EXISTS site_greetings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  greetings_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO site_greetings (id, greetings_json, updated_at)
VALUES (
  1,
  '{"firstVisit":["Hi! I hope you like the page!","Welcome! Enjoy exploring!","Hey there! Have fun!","Hello! Glad you''re here!","Welcome to the page!"],"returning":["Hello again!!!","Welcome back!","Nice to see you again!","You''re back! Enjoy your visit!","Hey again!"]}',
  0
);

CREATE TABLE IF NOT EXISTS site_messages (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  message TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  sender TEXT NOT NULL DEFAULT 'Arb'
    CHECK (sender IN ('Arb', 'Miticraft89'))
);

INSERT OR IGNORE INTO site_messages (id, message, updated_at, sender)
VALUES (1, '', 0, 'Arb');

CREATE TABLE IF NOT EXISTS site_analytics_daily (
  day TEXT PRIMARY KEY NOT NULL,
  page_views INTEGER NOT NULL DEFAULT 0 CHECK (page_views >= 0),
  peak_visitors INTEGER NOT NULL DEFAULT 0 CHECK (peak_visitors >= 0)
);

CREATE TABLE IF NOT EXISTS game_analytics_daily (
  day TEXT NOT NULL,
  game_id TEXT NOT NULL,
  game_launches INTEGER NOT NULL DEFAULT 0 CHECK (game_launches >= 0),
  PRIMARY KEY (day, game_id)
);

CREATE INDEX IF NOT EXISTS game_analytics_daily_day_idx
  ON game_analytics_daily (day);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  client_id TEXT PRIMARY KEY NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  lock_level INTEGER NOT NULL DEFAULT 0 CHECK (lock_level >= 0),
  locked_until INTEGER NOT NULL DEFAULT 0 CHECK (locked_until >= 0),
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS live_abuse_events (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  event_type TEXT NOT NULL
    CHECK (event_type IN ('number-rain', 'game-invite', 'jumpscare')),
  game_id TEXT,
  sender TEXT NOT NULL CHECK (sender IN ('Arb', 'Miticraft89')),
  created_at INTEGER NOT NULL
);
