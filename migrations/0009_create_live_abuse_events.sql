CREATE TABLE IF NOT EXISTS live_abuse_events (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  event_type TEXT NOT NULL CHECK (event_type IN ('number-rain', 'taco-event')),
  game_id TEXT,
  sender TEXT NOT NULL CHECK (sender IN ('Arb', 'Miticraft89')),
  created_at INTEGER NOT NULL
);
