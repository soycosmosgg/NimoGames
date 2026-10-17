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
