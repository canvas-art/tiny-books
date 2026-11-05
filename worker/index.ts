import { Hono } from "hono";
import type {
  Activity, BookDetail, BookSummary, ChapterView, CompleteResult, GroupDetail, GroupSummary, League, Me,
  MicroDetail, MicroStatus, NextStep, QuizCheck, QuizSubmitResult, QuizView, RankRow, Stats, User,
} from "../shared/types";

type Env = { DB: D1Database };
type C = { Bindings: Env };

// MVP: no auth. Everyone is John Doe.
const ME = 1;
const DAILY_GOAL = 1;
const XP_MICRO = 10;
const XP_DAILY_BONUS = 5;
const XP_PER_CORRECT = 5;
const XP_PERFECT = 15;
const PASS_MARK = 3;

const app = new Hono<C>().basePath("/api");

// ---------------------------------------------------------------- helpers

const day = (offset = 0) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

function streakFrom(dates: Set<string>): number {
  let i = dates.has(day()) ? 0 : -1;
  let n = 0;
  while (dates.has(day(i))) { n++; i--; }
  return n;
}

async function activityDates(db: D1Database, userIds: number[]): Promise<Map<number, Set<string>>> {
  const map = new Map<number, Set<string>>(userIds.map((id) => [id, new Set()]));
  if (!userIds.length) return map;
  const ph = userIds.map(() => "?").join(",");
  const { results } = await db.prepare(
    `SELECT user_id, date(completed_at) d FROM completions WHERE user_id IN (${ph})
     UNION SELECT user_id, date(completed_at) d FROM quiz_results WHERE user_id IN (${ph})`,
  ).bind(...userIds, ...userIds).all<{ user_id: number; d: string }>();
  for (const r of results) map.get(r.user_id)?.add(r.d);
  return map;
}

async function getStats(db: D1Database, userId: number): Promise<Stats> {
  const [xpRows, todayRow, weekRows, dates] = await Promise.all([
    db.prepare(
      `SELECT (SELECT COALESCE(SUM(xp),0) FROM completions WHERE user_id=?1) +
              (SELECT COALESCE(SUM(xp),0) FROM quiz_results WHERE user_id=?1) xp,
              (SELECT COUNT(*) FROM completions WHERE user_id=?1) completed`,
    ).bind(userId).first<{ xp: number; completed: number }>(),
    db.prepare(
      `SELECT COUNT(*) n, COALESCE(SUM(xp),0) xp FROM completions WHERE user_id=? AND date(completed_at)=date('now')`,
    ).bind(userId).first<{ n: number; xp: number }>(),
    db.prepare(
      `SELECT d, SUM(xp) xp FROM (
         SELECT date(completed_at) d, xp FROM completions WHERE user_id=?1 AND completed_at >= date('now','-6 days')
         UNION ALL SELECT date(completed_at) d, xp FROM quiz_results WHERE user_id=?1 AND completed_at >= date('now','-6 days')
       ) GROUP BY d`,
    ).bind(userId).all<{ d: string; xp: number }>(),
    activityDates(db, [userId]),
  ]);
  const byDay = new Map(weekRows.results.map((r) => [r.d, r.xp]));
  const week = Array.from({ length: 7 }, (_, i) => { const d = day(i - 6); return { date: d, xp: byDay.get(d) ?? 0 }; });
  return {
    xp: xpRows?.xp ?? 0,
    completed: xpRows?.completed ?? 0,
    streak: streakFrom(dates.get(userId)!),
    todayCount: todayRow?.n ?? 0,
    todayXp: byDay.get(day()) ?? 0,
    dailyGoal: DAILY_GOAL,
    week,
  };
}

type BookRow = { id: number; slug: string; title: string; author: string; translator: string | null; source: string | null; year: string | null; blurb: string | null; cover: string | null; cover_image: string | null; path_theme: string | null };

async function bookSummary(db: D1Database, book: BookRow, userId: number): Promise<BookSummary> {
  const r = await db.prepare(
    `SELECT (SELECT COUNT(*) FROM micro_chapters WHERE book_id=?1) micros,
            (SELECT COUNT(*) FROM chapters WHERE book_id=?1) chapters,
            (SELECT COALESCE(SUM(minutes),0) FROM micro_chapters WHERE book_id=?1) minutes,
            (SELECT COUNT(*) FROM enrollments WHERE book_id=?1) readers,
            (SELECT COUNT(*) FROM enrollments WHERE book_id=?1 AND user_id=?2) enrolled,
            (SELECT COUNT(*) FROM completions c JOIN micro_chapters m ON m.id=c.micro_id WHERE m.book_id=?1 AND c.user_id=?2) completed`,
  ).bind(book.id, userId).first<{ micros: number; chapters: number; minutes: number; readers: number; enrolled: number; completed: number }>();
  return {
    ...book,
    totalMicros: r!.micros, totalChapters: r!.chapters, totalMinutes: r!.minutes,
    readers: r!.readers, enrolled: r!.enrolled > 0, completed: r!.completed,
  };
}

const getBook = (db: D1Database, slug: string) => db.prepare(`SELECT * FROM books WHERE slug=?`).bind(slug).first<BookRow>();

/** Walk the book in order and work out what is done, what is next, and what is still locked. */
async function bookProgress(db: D1Database, bookId: number, userId: number) {
  const [chapters, micros, done, quizzes, qcount] = await Promise.all([
    db.prepare(`SELECT id, position, title, theme FROM chapters WHERE book_id=? ORDER BY position`).bind(bookId)
      .all<{ id: number; position: number; title: string; theme: string | null }>(),
    db.prepare(`SELECT id, chapter_id, position, title, sections, minutes FROM micro_chapters WHERE book_id=? ORDER BY seq`).bind(bookId)
      .all<{ id: number; chapter_id: number; position: number; title: string; sections: string; minutes: number }>(),
    db.prepare(`SELECT c.micro_id FROM completions c JOIN micro_chapters m ON m.id=c.micro_id WHERE c.user_id=? AND m.book_id=?`).bind(userId, bookId)
      .all<{ micro_id: number }>(),
    db.prepare(`SELECT q.chapter_id, q.score, q.passed FROM quiz_results q JOIN chapters c ON c.id=q.chapter_id WHERE q.user_id=? AND c.book_id=?`).bind(userId, bookId)
      .all<{ chapter_id: number; score: number; passed: number }>(),
    db.prepare(`SELECT chapter_id, COUNT(*) n FROM quiz_questions GROUP BY chapter_id`).all<{ chapter_id: number; n: number }>(),
  ]);
  const doneSet = new Set(done.results.map((r) => r.micro_id));
  const quizMap = new Map(quizzes.results.map((r) => [r.chapter_id, r]));
  const qn = new Map(qcount.results.map((r) => [r.chapter_id, r.n]));
  let open = true;
  let next: NextStep | null = null;
  const view: ChapterView[] = chapters.results.map((ch) => {
    const ms = micros.results.filter((m) => m.chapter_id === ch.id).map((m) => {
      let status: MicroStatus = "locked";
      if (doneSet.has(m.id)) status = "done";
      else if (open) {
        status = "current"; open = false;
        next = { type: "micro", id: m.id, title: m.title, chapter: ch.title, minutes: m.minutes };
      }
      return { id: m.id, position: m.position, title: m.title, sections: m.sections, minutes: m.minutes, status };
    });
    const q = quizMap.get(ch.id);
    let qs: MicroStatus = "locked";
    if (q?.passed) qs = "done";
    else if (open) { qs = "current"; open = false; next = { type: "quiz", chapterId: ch.id, chapter: ch.title }; }
    return { ...ch, micros: ms, quiz: { status: qs, score: q?.score ?? null, total: qn.get(ch.id) ?? 0 } };
  });
  return { chapters: view, next: next as NextStep | null, completed: doneSet.size, total: micros.results.length };
}

async function ranking(db: D1Database, userIds: number[], bookId: number, roles?: Map<number, string>): Promise<RankRow[]> {
  if (!userIds.length) return [];
  const ph = userIds.map(() => "?").join(",");
  const { results } = await db.prepare(
    `SELECT u.id, u.name, u.handle, u.color,
       (SELECT COALESCE(SUM(c.xp),0) FROM completions c JOIN micro_chapters m ON m.id=c.micro_id WHERE c.user_id=u.id AND m.book_id=?1) +
       (SELECT COALESCE(SUM(q.xp),0) FROM quiz_results q JOIN chapters ch ON ch.id=q.chapter_id WHERE q.user_id=u.id AND ch.book_id=?1) xp,
       (SELECT COUNT(*) FROM completions c JOIN micro_chapters m ON m.id=c.micro_id WHERE c.user_id=u.id AND m.book_id=?1) completed,
       (SELECT MAX(t) FROM (SELECT MAX(completed_at) t FROM completions WHERE user_id=u.id UNION ALL SELECT MAX(completed_at) FROM quiz_results WHERE user_id=u.id)) last_active
     FROM users u WHERE u.id IN (${ph})`,
  ).bind(bookId, ...userIds).all<User & { xp: number; completed: number; last_active: string | null }>();
  const dates = await activityDates(db, userIds);
  return results
    .map((r) => ({
      user: { id: r.id, name: r.name, handle: r.handle, color: r.color },
      xp: r.xp, completed: r.completed, streak: streakFrom(dates.get(r.id)!), lastActive: r.last_active,
      isMe: r.id === ME, role: roles?.get(r.id),
    }))
    .sort((a, b) => b.xp - a.xp || b.completed - a.completed || a.user.name.localeCompare(b.user.name));
}

/** Join the most recent open cohort for the book (started within 7 days, under 30 readers), or start a new one. */
async function assignCohort(db: D1Database, bookId: number): Promise<number> {
  const open = await db.prepare(
    `SELECT c.id FROM cohorts c WHERE c.book_id=? AND c.started_at >= datetime('now','-7 days')
       AND (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id=c.id) < 30
     ORDER BY c.started_at DESC LIMIT 1`,
  ).bind(bookId).first<{ id: number }>();
  if (open) return open.id;
  const names = ["Morning Stars", "Quiet Harbour", "Inner Citadel", "Promontory", "Olive Grove", "Night Watch"];
  const name = names[Math.floor(Math.random() * names.length)];
  const r = await db.prepare(`INSERT INTO cohorts (book_id, name) VALUES (?, ?) RETURNING id`).bind(bookId, name).first<{ id: number }>();
  return r!.id;
}

// ---------------------------------------------------------------- routes

app.get("/me", async (c) => {
  const db = c.env.DB;
  const user = await db.prepare(`SELECT id, name, handle, color FROM users WHERE id=?`).bind(ME).first<User>();
  const stats = await getStats(db, ME);
  const enr = await db.prepare(
    `SELECT b.* FROM enrollments e JOIN books b ON b.id=e.book_id WHERE e.user_id=? ORDER BY e.started_at DESC LIMIT 1`,
  ).bind(ME).first<BookRow>();
  let reading: Me["reading"] = null;
  if (enr) {
    const p = await bookProgress(db, enr.id, ME);
    reading = { book: await bookSummary(db, enr, ME), completed: p.completed, total: p.total, next: p.next };
  }
  return c.json<Me>({ user: user!, stats, reading });
});

app.get("/books", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM books ORDER BY title`).all<BookRow>();
  return c.json(await Promise.all(results.map((b) => bookSummary(c.env.DB, b, ME))));
});

app.get("/books/:slug", async (c) => {
  const db = c.env.DB;
  const book = await getBook(db, c.req.param("slug"));
  if (!book) return c.json({ error: "Book not found" }, 404);
  const [summary, p, cohort] = await Promise.all([
    bookSummary(db, book, ME),
    bookProgress(db, book.id, ME),
    db.prepare(`SELECT co.id, co.name FROM enrollments e JOIN cohorts co ON co.id=e.cohort_id WHERE e.user_id=? AND e.book_id=?`).bind(ME, book.id).first<{ id: number; name: string }>(),
  ]);
  return c.json<BookDetail>({ book: summary, chapters: p.chapters, next: summary.enrolled ? p.next : null, cohort: cohort ?? null });
});

app.post("/books/:slug/start", async (c) => {
  const db = c.env.DB;
  const book = await getBook(db, c.req.param("slug"));
  if (!book) return c.json({ error: "Book not found" }, 404);
  const existing = await db.prepare(`SELECT cohort_id FROM enrollments WHERE user_id=? AND book_id=?`).bind(ME, book.id).first();
  if (!existing) {
    const cohort = await assignCohort(db, book.id);
    await db.prepare(`INSERT INTO enrollments (user_id, book_id, cohort_id) VALUES (?, ?, ?)`).bind(ME, book.id, cohort).run();
  }
  return c.json({ ok: true });
});

async function microAccess(db: D1Database, microId: number) {
  const m = await db.prepare(`SELECT * FROM micro_chapters WHERE id=?`).bind(microId).first<{
    id: number; book_id: number; chapter_id: number; position: number; seq: number; title: string; sections: string; words: number; minutes: number; content: string;
  }>();
  if (!m) return { error: "Micro-chapter not found", code: 404 as const };
  const enrolled = await db.prepare(`SELECT 1 FROM enrollments WHERE user_id=? AND book_id=?`).bind(ME, m.book_id).first();
  if (!enrolled) return { error: "Start the book first", code: 403 as const };
  const p = await bookProgress(db, m.book_id, ME);
  const status = p.chapters.flatMap((ch) => ch.micros).find((x) => x.id === m.id)!.status;
  if (status === "locked") return { error: "This micro-chapter is still locked", code: 403 as const };
  return { m, status, progress: p };
}

app.get("/micro/:id", async (c) => {
  const db = c.env.DB;
  const a = await microAccess(db, Number(c.req.param("id")));
  if ("error" in a) return c.json({ error: a.error }, a.code);
  const { m, status } = a;
  const [ch, book] = await Promise.all([
    db.prepare(`SELECT id, position, title, footer, (SELECT COUNT(*) FROM micro_chapters WHERE chapter_id=chapters.id) count FROM chapters WHERE id=?`)
      .bind(m.chapter_id).first<{ id: number; position: number; title: string; footer: string | null; count: number }>(),
    db.prepare(`SELECT slug, title, author, (SELECT COUNT(*) FROM micro_chapters WHERE book_id=books.id) total FROM books WHERE id=?`)
      .bind(m.book_id).first<{ slug: string; title: string; author: string; total: number }>(),
  ]);
  return c.json<MicroDetail>({
    id: m.id, title: m.title, sections: m.sections, minutes: m.minutes, words: m.words, position: m.position, seq: m.seq,
    content: JSON.parse(m.content), footer: m.position === ch!.count ? ch!.footer : null, done: status === "done",
    chapter: { id: ch!.id, position: ch!.position, title: ch!.title, count: ch!.count }, book: book!,
  });
});

app.post("/micro/:id/complete", async (c) => {
  const db = c.env.DB;
  const a = await microAccess(db, Number(c.req.param("id")));
  if ("error" in a) return c.json({ error: a.error }, a.code);
  let xp = 0, bonus = 0;
  if (a.status !== "done") {
    const today = await db.prepare(`SELECT COUNT(*) n FROM completions WHERE user_id=? AND date(completed_at)=date('now')`).bind(ME).first<{ n: number }>();
    bonus = today!.n === 0 ? XP_DAILY_BONUS : 0;
    xp = XP_MICRO + bonus;
    await db.prepare(`INSERT INTO completions (user_id, micro_id, xp) VALUES (?, ?, ?)`).bind(ME, a.m.id, xp).run();
  }
  const [stats, p] = await Promise.all([getStats(db, ME), bookProgress(db, a.m.book_id, ME)]);
  return c.json<CompleteResult>({ xp, bonus, alreadyDone: a.status === "done", stats, next: p.next });
});

async function quizAccess(db: D1Database, chapterId: number) {
  const ch = await db.prepare(`SELECT c.id, c.position, c.title, c.book_id, b.slug, b.title book_title FROM chapters c JOIN books b ON b.id=c.book_id WHERE c.id=?`)
    .bind(chapterId).first<{ id: number; position: number; title: string; book_id: number; slug: string; book_title: string }>();
  if (!ch) return { error: "Chapter not found", code: 404 as const };
  const p = await bookProgress(db, ch.book_id, ME);
  const status = p.chapters.find((x) => x.id === ch.id)!.quiz.status;
  if (status === "locked") return { error: "Finish every micro-chapter in this book first", code: 403 as const };
  return { ch, status };
}

app.get("/quiz/:chapterId", async (c) => {
  const db = c.env.DB;
  const a = await quizAccess(db, Number(c.req.param("chapterId")));
  if ("error" in a) return c.json({ error: a.error }, a.code);
  const [{ results }, best] = await Promise.all([
    db.prepare(`SELECT id, question, options FROM quiz_questions WHERE chapter_id=? ORDER BY position`).bind(a.ch.id)
      .all<{ id: number; question: string; options: string }>(),
    db.prepare(`SELECT score FROM quiz_results WHERE user_id=? AND chapter_id=?`).bind(ME, a.ch.id).first<{ score: number }>(),
  ]);
  return c.json<QuizView>({
    chapter: { id: a.ch.id, position: a.ch.position, title: a.ch.title },
    book: { slug: a.ch.slug, title: a.ch.book_title },
    questions: results.map((q) => ({ id: q.id, question: q.question, options: JSON.parse(q.options) })),
    best: best?.score ?? null,
    passMark: PASS_MARK,
  });
});

app.post("/quiz/:chapterId/check", async (c) => {
  const db = c.env.DB;
  const a = await quizAccess(db, Number(c.req.param("chapterId")));
  if ("error" in a) return c.json({ error: a.error }, a.code);
  const body = await c.req.json<{ questionId: number; choice: number }>();
  const q = await db.prepare(`SELECT answer, explanation FROM quiz_questions WHERE id=? AND chapter_id=?`).bind(body.questionId, a.ch.id)
    .first<{ answer: number; explanation: string | null }>();
  if (!q) return c.json({ error: "Question not found" }, 404);
  return c.json<QuizCheck>({ correct: q.answer === body.choice, answer: q.answer, explanation: q.explanation });
});

app.post("/quiz/:chapterId/submit", async (c) => {
  const db = c.env.DB;
  const a = await quizAccess(db, Number(c.req.param("chapterId")));
  if ("error" in a) return c.json({ error: a.error }, a.code);
  const { answers } = await c.req.json<{ answers: Record<string, number> }>();
  const { results } = await db.prepare(`SELECT id, answer FROM quiz_questions WHERE chapter_id=?`).bind(a.ch.id).all<{ id: number; answer: number }>();
  const score = results.filter((q) => answers?.[q.id] === q.answer).length;
  const total = results.length;
  const passed = score >= PASS_MARK;
  const perfect = score === total;
  const earned = score * XP_PER_CORRECT + (perfect ? XP_PERFECT : 0);
  const prev = await db.prepare(`SELECT score, xp, passed FROM quiz_results WHERE user_id=? AND chapter_id=?`).bind(ME, a.ch.id)
    .first<{ score: number; xp: number; passed: number }>();
  let xp = 0;
  // Only the best attempt counts, and only a pass is recorded (retries can still raise it).
  if (passed && (!prev || earned > prev.xp)) {
    xp = earned - (prev?.xp ?? 0);
    await db.prepare(
      `INSERT INTO quiz_results (user_id, chapter_id, score, total, passed, xp) VALUES (?1, ?2, ?3, ?4, 1, ?5)
       ON CONFLICT(user_id, chapter_id) DO UPDATE SET score=?3, total=?4, passed=1, xp=?5, completed_at=datetime('now')`,
    ).bind(ME, a.ch.id, score, total, earned).run();
  }
  const [stats, p] = await Promise.all([getStats(db, ME), bookProgress(db, a.ch.book_id, ME)]);
  return c.json<QuizSubmitResult>({ score, total, passed, xp, perfect, stats, next: p.next });
});

app.get("/league", async (c) => {
  const db = c.env.DB;
  const book = await getBook(db, c.req.query("book") ?? "meditations");
  if (!book) return c.json({ error: "Book not found" }, 404);
  const cohort = await db.prepare(
    `SELECT co.id, co.name, co.started_at, (SELECT COUNT(*) FROM enrollments x WHERE x.cohort_id=co.id) size
     FROM enrollments e JOIN cohorts co ON co.id=e.cohort_id WHERE e.user_id=? AND e.book_id=?`,
  ).bind(ME, book.id).first<{ id: number; name: string; started_at: string; size: number }>();
  let rows: RankRow[] = [];
  if (cohort) {
    const { results } = await db.prepare(`SELECT user_id FROM enrollments WHERE cohort_id=?`).bind(cohort.id).all<{ user_id: number }>();
    rows = await ranking(db, results.map((r) => r.user_id), book.id);
  }
  return c.json<League>({
    book: { slug: book.slug, title: book.title },
    cohort: cohort ? { id: cohort.id, name: cohort.name, startedAt: cohort.started_at, size: cohort.size } : null,
    rows,
  });
});

async function groupSummaries(db: D1Database, where: string, ...binds: unknown[]): Promise<(GroupSummary & { invite_code: string; created_at: string })[]> {
  const { results } = await db.prepare(
    `SELECT g.*, b.slug, b.title book_title, (SELECT COUNT(*) FROM group_members m WHERE m.group_id=g.id) members
     FROM groups g JOIN books b ON b.id=g.book_id WHERE ${where} ORDER BY g.created_at`,
  ).bind(...binds).all<{ id: number; name: string; description: string | null; color: string; owner_id: number; book_id: number; slug: string; book_title: string; members: number; invite_code: string; created_at: string }>();
  return Promise.all(results.map(async (g) => {
    const ids = await db.prepare(`SELECT user_id FROM group_members WHERE group_id=?`).bind(g.id).all<{ user_id: number }>();
    const rows = await ranking(db, ids.results.map((r) => r.user_id), g.book_id);
    return {
      id: g.id, name: g.name, description: g.description, color: g.color, members: g.members,
      myRank: rows.findIndex((r) => r.isMe) + 1, book: { slug: g.slug, title: g.book_title }, isOwner: g.owner_id === ME,
      invite_code: g.invite_code, created_at: g.created_at,
    };
  }));
}

app.get("/groups", async (c) => {
  const list = await groupSummaries(c.env.DB, `g.id IN (SELECT group_id FROM group_members WHERE user_id=?)`, ME);
  return c.json<GroupSummary[]>(list.map(({ invite_code: _i, created_at: _c, ...g }) => g));
});

app.get("/groups/:id", async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param("id"));
  const isMember = await db.prepare(`SELECT 1 FROM group_members WHERE group_id=? AND user_id=?`).bind(id, ME).first();
  if (!isMember) return c.json({ error: "Group not found" }, 404);
  const [g] = await groupSummaries(db, `g.id=?`, id);
  const bookId = (await db.prepare(`SELECT book_id FROM groups WHERE id=?`).bind(id).first<{ book_id: number }>())!.book_id;
  const members = await db.prepare(`SELECT user_id, role FROM group_members WHERE group_id=?`).bind(id).all<{ user_id: number; role: string }>();
  const roles = new Map(members.results.map((m) => [m.user_id, m.role]));
  const ids = [...roles.keys()];
  const ph = ids.map(() => "?").join(",");
  const [rows, invites, act] = await Promise.all([
    ranking(db, ids, bookId, roles),
    db.prepare(`SELECT email, status, created_at FROM group_invites WHERE group_id=? ORDER BY created_at DESC`).bind(id)
      .all<{ email: string; status: string; created_at: string }>(),
    db.prepare(
      `SELECT * FROM (
         SELECT c.user_id, 'micro' kind, m.title, c.xp, c.completed_at at FROM completions c JOIN micro_chapters m ON m.id=c.micro_id WHERE c.user_id IN (${ph}) AND m.book_id=?
         UNION ALL
         SELECT q.user_id, 'quiz' kind, ch.title, q.xp, q.completed_at at FROM quiz_results q JOIN chapters ch ON ch.id=q.chapter_id WHERE q.user_id IN (${ph}) AND ch.book_id=?
       ) ORDER BY at DESC LIMIT 12`,
    ).bind(...ids, bookId, ...ids, bookId).all<{ user_id: number; kind: "micro" | "quiz"; title: string; xp: number; at: string }>(),
  ]);
  const users = new Map(rows.map((r) => [r.user.id, r.user]));
  const activity: Activity[] = act.results.map((a) => ({ user: users.get(a.user_id)!, kind: a.kind, title: a.title, xp: a.xp, at: a.at }));
  const { invite_code, created_at, ...rest } = g;
  return c.json<GroupDetail>({
    group: { ...rest, inviteCode: invite_code, createdAt: created_at },
    rows,
    invites: invites.results.map((i) => ({ email: i.email, status: i.status, createdAt: i.created_at })),
    activity,
  });
});

app.post("/groups", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{ name?: string; description?: string; book?: string }>();
  const name = body.name?.trim();
  if (!name || name.length > 60) return c.json({ error: "Give your group a name (up to 60 characters)" }, 400);
  const book = await getBook(db, body.book ?? "meditations");
  if (!book) return c.json({ error: "Book not found" }, 404);
  const colors = ["#0f766e", "#c2410c", "#7c3aed", "#1d4ed8", "#be123c", "#4d7c0f"];
  const code = `${name.replace(/[^a-z]/gi, "").slice(0, 4).toUpperCase().padEnd(4, "X")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  const g = await db.prepare(
    `INSERT INTO groups (name, description, book_id, owner_id, color, invite_code) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(name, body.description?.trim() || null, book.id, ME, colors[Math.floor(Math.random() * colors.length)], code).first<{ id: number }>();
  await db.batch([
    db.prepare(`INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'owner')`).bind(g!.id, ME),
    db.prepare(`INSERT OR IGNORE INTO enrollments (user_id, book_id, cohort_id) VALUES (?, ?, ?)`).bind(ME, book.id, await assignCohort(db, book.id)),
  ]);
  return c.json({ id: g!.id });
});

app.post("/groups/:id/invite", async (c) => {
  const db = c.env.DB;
  const id = Number(c.req.param("id"));
  const isMember = await db.prepare(`SELECT 1 FROM group_members WHERE group_id=? AND user_id=?`).bind(id, ME).first();
  if (!isMember) return c.json({ error: "Group not found" }, 404);
  const { email } = await c.req.json<{ email?: string }>();
  const e = email?.trim().toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return c.json({ error: "That doesn't look like an email address" }, 400);
  // Mocked: no email is actually sent. The invite is just recorded as pending.
  await db.prepare(`INSERT INTO group_invites (group_id, email, invited_by) VALUES (?, ?, ?)`).bind(id, e, ME).run();
  return c.json({ ok: true });
});

app.post("/groups/join", async (c) => {
  const db = c.env.DB;
  const { code } = await c.req.json<{ code?: string }>();
  const g = await db.prepare(`SELECT id, book_id FROM groups WHERE invite_code=?`).bind((code ?? "").trim().toUpperCase()).first<{ id: number; book_id: number }>();
  if (!g) return c.json({ error: "No group uses that invite code" }, 404);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)`).bind(g.id, ME),
    db.prepare(`INSERT OR IGNORE INTO enrollments (user_id, book_id, cohort_id) VALUES (?, ?, ?)`).bind(ME, g.book_id, await assignCohort(db, g.book_id)),
  ]);
  return c.json({ id: g.id });
});

app.post("/demo/reset", async (c) => {
  const db = c.env.DB;
  await db.batch([
    db.prepare(`DELETE FROM completions WHERE user_id=?`).bind(ME),
    db.prepare(`DELETE FROM quiz_results WHERE user_id=?`).bind(ME),
    db.prepare(`DELETE FROM enrollments WHERE user_id=?`).bind(ME),
  ]);
  return c.json({ ok: true });
});

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => { console.error(err); return c.json({ error: "Something went wrong" }, 500); });

export default app satisfies ExportedHandler<Env>;
