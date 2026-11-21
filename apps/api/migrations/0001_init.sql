-- Anonymous by design: no accounts, no emails. A visitor is a random id kept in their own browser.

-- Who is in the building right now. One row per visitor, refreshed by a heartbeat.
CREATE TABLE presence (
  anon_id  TEXT PRIMARY KEY,
  room     TEXT,
  avatar   TEXT NOT NULL,
  seen_at  INTEGER NOT NULL
);
CREATE INDEX presence_seen_at ON presence (seen_at);

-- One attempt per visitor per question per UTC day; trying again the same day replaces the earlier score.
CREATE TABLE attempts (
  anon_id     TEXT NOT NULL,
  question_id TEXT NOT NULL,
  day         TEXT NOT NULL,
  score       INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  seconds     INTEGER NOT NULL CHECK (seconds >= 0),
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (anon_id, question_id, day)
);
CREATE INDEX attempts_question ON attempts (question_id);
CREATE INDEX attempts_day ON attempts (day);
