CREATE TABLE live_abuse_events_v2 (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  event_type TEXT NOT NULL CHECK (event_type IN ('number-rain', 'game-invite')),
  game_id TEXT,
  sender TEXT NOT NULL CHECK (sender IN ('Arb', 'Miticraft89')),
  created_at INTEGER NOT NULL
);

INSERT INTO live_abuse_events_v2 (id, event_type, game_id, sender, created_at)
SELECT id,
  CASE event_type WHEN 'taco-event' THEN 'game-invite' ELSE event_type END,
  game_id,
  sender,
  created_at
FROM live_abuse_events;

DROP TABLE live_abuse_events;
ALTER TABLE live_abuse_events_v2 RENAME TO live_abuse_events;
