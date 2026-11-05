-- Core schema for Tiny Books
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  translator TEXT,
  source TEXT,
  year TEXT,
  blurb TEXT,
  cover TEXT
);

CREATE TABLE chapters (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id),
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  theme TEXT,
  footer TEXT
);

CREATE TABLE micro_chapters (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id),
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  position INTEGER NOT NULL,          -- position inside the chapter
  seq INTEGER NOT NULL,               -- position inside the whole book
  title TEXT NOT NULL,
  sections TEXT NOT NULL,             -- e.g. "I–IV"
  words INTEGER NOT NULL,
  minutes INTEGER NOT NULL,
  content TEXT NOT NULL               -- JSON: [{n, paras: [..]}]
);
CREATE INDEX idx_micro_book_seq ON micro_chapters(book_id, seq);

CREATE TABLE quiz_questions (
  id INTEGER PRIMARY KEY,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  position INTEGER NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,              -- JSON array
  answer INTEGER NOT NULL,
  explanation TEXT
);

CREATE TABLE cohorts (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id),
  name TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE enrollments (
  user_id INTEGER NOT NULL REFERENCES users(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  cohort_id INTEGER REFERENCES cohorts(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, book_id)
);

CREATE TABLE completions (
  user_id INTEGER NOT NULL REFERENCES users(id),
  micro_id INTEGER NOT NULL REFERENCES micro_chapters(id),
  xp INTEGER NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, micro_id)
);

CREATE TABLE quiz_results (
  user_id INTEGER NOT NULL REFERENCES users(id),
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  xp INTEGER NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, chapter_id)
);

CREATE TABLE groups (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  book_id INTEGER NOT NULL REFERENCES books(id),
  owner_id INTEGER NOT NULL REFERENCES users(id),
  color TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_invites (
  id INTEGER PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  email TEXT NOT NULL,
  invited_by INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
