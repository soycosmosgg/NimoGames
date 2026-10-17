CREATE TABLE IF NOT EXISTS site_analytics_daily (
  day TEXT PRIMARY KEY NOT NULL,
  page_views INTEGER NOT NULL DEFAULT 0 CHECK (page_views >= 0),
  peak_visitors INTEGER NOT NULL DEFAULT 0 CHECK (peak_visitors >= 0)
);
