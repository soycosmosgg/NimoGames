ALTER TABLE active_visitors
ADD COLUMN city TEXT NOT NULL DEFAULT '';

ALTER TABLE active_visitors
ADD COLUMN country TEXT NOT NULL DEFAULT '';

ALTER TABLE active_visitors
ADD COLUMN game_id TEXT;
