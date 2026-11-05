// Types shared by the Worker API and the React client.

export type User = { id: number; name: string; handle: string; color: string };

export type Stats = {
  xp: number;
  streak: number;
  todayCount: number;
  todayXp: number;
  dailyGoal: number;
  completed: number;
  week: { date: string; xp: number }[];
};

export type Me = { user: User; stats: Stats; reading: ReadingSummary | null };

export type ReadingSummary = {
  book: BookSummary;
  completed: number;
  total: number;
  next: NextStep | null;
};

export type NextStep =
  | { type: "micro"; id: number; title: string; chapter: string; minutes: number }
  | { type: "quiz"; chapterId: number; chapter: string };

export type BookSummary = {
  id: number;
  slug: string;
  title: string;
  author: string;
  translator: string | null;
  source: string | null;
  year: string | null;
  blurb: string | null;
  cover: string | null;
  cover_image: string | null;
  /** Path theme id (a folder in src/path/themes). null = the default theme. */
  path_theme: string | null;
  totalMicros: number;
  totalChapters: number;
  totalMinutes: number;
  readers: number;
  enrolled: boolean;
  completed: number;
};

/** A row of the books table: a BookSummary without the computed fields. */
export type BookRow = Omit<BookSummary, "totalMicros" | "totalChapters" | "totalMinutes" | "readers" | "enrolled" | "completed">;

/** The read-only data the Worker sends the browser. See src/local/engine.ts. */
export type Snapshot = {
  books: BookRow[];
  chapters: { id: number; book_id: number; position: number; title: string; theme: string | null; footer: string | null }[];
  micros: { id: number; book_id: number; chapter_id: number; position: number; seq: number; title: string; sections: string; words: number; minutes: number }[];
  questions: { id: number; chapter_id: number; position: number; question: string; options: string; answer: number; explanation: string | null }[];
  users: User[];
  cohorts: { id: number; book_id: number; name: string; started_at: string }[];
  enrollments: { user_id: number; book_id: number; cohort_id: number | null; started_at: string }[];
  completions: { user_id: number; micro_id: number; xp: number; completed_at: string }[];
  quizResults: { user_id: number; chapter_id: number; score: number; total: number; passed: number; xp: number; completed_at: string }[];
  groups: { id: number; name: string; description: string | null; book_id: number; owner_id: number; color: string; invite_code: string; created_at: string }[];
  members: { group_id: number; user_id: number; role: string; joined_at: string }[];
  invites: { group_id: number; email: string; status: string; created_at: string }[];
};

export type MicroStatus = "done" | "current" | "locked";

export type ChapterView = {
  id: number;
  position: number;
  title: string;
  theme: string | null;
  micros: { id: number; position: number; title: string; sections: string; minutes: number; status: MicroStatus }[];
  quiz: { status: MicroStatus; score: number | null; total: number };
};

export type BookDetail = { book: BookSummary; chapters: ChapterView[]; next: NextStep | null; cohort: { id: number; name: string } | null };

export type MicroDetail = {
  id: number;
  title: string;
  sections: string;
  minutes: number;
  words: number;
  position: number;
  seq: number;
  content: { n: string; paras: string[] }[];
  footer: string | null;
  done: boolean;
  chapter: { id: number; position: number; title: string; count: number };
  book: { slug: string; title: string; author: string; total: number };
};

export type CompleteResult = {
  xp: number;
  bonus: number;
  alreadyDone: boolean;
  stats: Stats;
  next: NextStep | null;
};

export type QuizQuestion = { id: number; question: string; options: string[] };
export type QuizView = { chapter: { id: number; position: number; title: string }; book: { slug: string; title: string }; questions: QuizQuestion[]; best: number | null; passMark: number };
export type QuizCheck = { correct: boolean; answer: number; explanation: string | null };
export type QuizSubmitResult = { score: number; total: number; passed: boolean; xp: number; perfect: boolean; stats: Stats; next: NextStep | null };

export type RankRow = { user: User; xp: number; completed: number; streak: number; lastActive: string | null; isMe: boolean; role?: string };

export type League = {
  book: { slug: string; title: string };
  cohort: { id: number; name: string; startedAt: string; size: number } | null;
  rows: RankRow[];
};

export type GroupSummary = { id: number; name: string; description: string | null; color: string; members: number; myRank: number; book: { slug: string; title: string }; isOwner: boolean };

export type Activity = { user: User; kind: "micro" | "quiz"; title: string; xp: number; at: string };

export type GroupDetail = {
  group: GroupSummary & { inviteCode: string; createdAt: string };
  rows: RankRow[];
  invites: { email: string; status: string; createdAt: string }[];
  activity: Activity[];
};
