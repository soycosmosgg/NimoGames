ALTER TABLE site_messages
ADD COLUMN sender TEXT NOT NULL DEFAULT 'Arb'
CHECK (sender IN ('Arb', 'Miticraft89'));
