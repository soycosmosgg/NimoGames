ALTER TABLE active_visitors ADD COLUMN browser TEXT NOT NULL DEFAULT 'Unknown';
ALTER TABLE active_visitors ADD COLUMN device TEXT NOT NULL DEFAULT 'Unknown';

CREATE TABLE IF NOT EXISTS visitor_analytics_daily (
  day TEXT NOT NULL,
  dimension TEXT NOT NULL CHECK (dimension IN ('browser', 'device')),
  value TEXT NOT NULL,
  page_views INTEGER NOT NULL DEFAULT 0 CHECK (page_views >= 0),
  PRIMARY KEY (day, dimension, value)
);

CREATE INDEX IF NOT EXISTS visitor_analytics_daily_day_idx
  ON visitor_analytics_daily (day, dimension);
