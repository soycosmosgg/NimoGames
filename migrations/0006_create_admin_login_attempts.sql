CREATE TABLE IF NOT EXISTS admin_login_attempts (
  client_id TEXT PRIMARY KEY NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  lock_level INTEGER NOT NULL DEFAULT 0 CHECK (lock_level >= 0),
  locked_until INTEGER NOT NULL DEFAULT 0 CHECK (locked_until >= 0),
  updated_at INTEGER NOT NULL
);
