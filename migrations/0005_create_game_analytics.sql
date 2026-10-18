CREATE TABLE IF NOT EXISTS game_analytics_daily (
  day TEXT NOT NULL,
  game_id TEXT NOT NULL,
  game_launches INTEGER NOT NULL DEFAULT 0 CHECK (game_launches >= 0),
  PRIMARY KEY (day, game_id)
);

CREATE INDEX IF NOT EXISTS game_analytics_daily_day_idx
  ON game_analytics_daily (day);
