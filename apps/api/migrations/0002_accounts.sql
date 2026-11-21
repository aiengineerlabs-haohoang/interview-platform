-- Optional accounts. Anonymous play still works; a signed-in player's attempts are keyed `u:<user id>` in the
-- existing attempts/presence tables, which can never collide with an anonymous id (those have no colon).

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  avatar        TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL
);

-- Only the SHA-256 of the session token is stored, so a copy of the database cannot be replayed as cookies.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX sessions_expires ON sessions (expires_at);
