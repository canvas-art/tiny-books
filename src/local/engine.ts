// The app's rules, running in the browser. The server only supplies read-only data: everything a
// visitor does (reading, quizzes, groups) is saved in their own localStorage, and never reaches the
// database or other visitors. Requests and responses keep the shape of a normal API, so pages don't
// need to know this. When accounts arrive, this module can move back behind real endpoints.
import type {
  Activity, BookDetail, BookRow, BookSummary, ChapterView, CompleteResult, GroupDetail, GroupSummary, League, Me,
  MicroDetail, MicroStatus, NextStep, QuizCheck, QuizSubmitResult, QuizView, RankRow, Snapshot, Stats,
} from "../../shared/types";
import { ApiError, request } from "../http";

const ME = 1; // No accounts yet: every visitor is John Doe, with a private copy of his progress.
const DAILY_GOAL = 1;
const XP_MICRO = 10;
const XP_DAILY_BONUS = 5;
const XP_PER_CORRECT = 5;
const XP_PERFECT = 15;
const PASS_MARK = 3;
const MAX_DESCRIPTION = 280;
const MAX_EMAIL = 254;
const FIRST_LOCAL_ID = 1_000_000; // Far above seeded ids, so local rows never collide with them.
const STORAGE_KEY = "tiny-books:progress:v1";

/** This visitor's rows. Anything the server holds for ME is only the starting point. */
type LocalState = Pick<Snapshot, "cohorts" | "enrollments" | "completions" | "quizResults" | "groups" | "members" | "invites">;

const fail = (message: string, status: number): never => { throw new ApiError(message, status); };
const isId = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) > 0;
const mine = <T extends { user_id: number }>(rows: T[]) => rows.filter((r) => r.user_id === ME);
const others = <T extends { user_id: number }>(rows: T[]) => rows.filter((r) => r.user_id !== ME);

const day = (offset = 0) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const timestamp = (offset = 0) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 19).replace("T", " ");

function streakFrom(dates: Set<string>) {
  let i = dates.has(day()) ? 0 : -1;
  let n = 0;
  while (dates.has(day(i))) { n++; i--; }
  return n;
}

// ---------------------------------------------------------------- data

let snapshot: Promise<Snapshot> | null = null;
const loadSnapshot = () => (snapshot ??= request<Snapshot>("/snapshot").catch((e) => { snapshot = null; throw e; }));

const seedState = (s: Snapshot): LocalState => ({
  cohorts: [], groups: [], invites: [], members: mine(s.members),
  enrollments: mine(s.enrollments), completions: mine(s.completions), quizResults: mine(s.quizResults),
});

let state: LocalState | null = null;

function loadState(s: Snapshot): LocalState {
  if (state) return state;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return (state = JSON.parse(saved) as LocalState);
  } catch { /* Private window or corrupt data: start again from the seed. */ }
  return (state = seedState(s));
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Keeps working until the tab closes. */ }
}

/** The world as this visitor sees it: everyone else from the server, this visitor from the browser. */
function world(s: Snapshot) {
  const l = loadState(s);
  return {
    s, l,
    // Getters, so rules that run right after a write see it.
    get cohorts() { return [...s.cohorts, ...l.cohorts]; },
    get enrollments() { return [...others(s.enrollments), ...l.enrollments]; },
    get completions() { return [...others(s.completions), ...l.completions]; },
    get quizResults() { return [...others(s.quizResults), ...l.quizResults]; },
    get groups() { return [...s.groups, ...l.groups]; },
    get members() { return [...others(s.members), ...l.members]; },
    get invites() { return [...l.invites, ...s.invites]; },
  };
}
type World = ReturnType<typeof world>;

const nextLocalId = (rows: { id: number }[]) => Math.max(FIRST_LOCAL_ID - 1, ...rows.map((r) => r.id)) + 1;

// ---------------------------------------------------------------- rules

function activityDates(w: World, userId: number) {
  return new Set([...w.completions, ...w.quizResults].filter((r) => r.user_id === userId).map((r) => r.completed_at.slice(0, 10)));
}

function getStats(w: World): Stats {
  const completions = w.l.completions, quizzes = w.l.quizResults;
  const byDay = new Map<string, number>();
  for (const r of [...completions, ...quizzes]) {
    if (r.completed_at >= day(-6)) byDay.set(r.completed_at.slice(0, 10), (byDay.get(r.completed_at.slice(0, 10)) ?? 0) + r.xp);
  }
  return {
    xp: [...completions, ...quizzes].reduce((sum, r) => sum + r.xp, 0),
    completed: completions.length,
    streak: streakFrom(activityDates(w, ME)),
    todayCount: completions.filter((r) => r.completed_at.slice(0, 10) === day()).length,
    todayXp: byDay.get(day()) ?? 0,
    dailyGoal: DAILY_GOAL,
    week: Array.from({ length: 7 }, (_, i) => { const d = day(i - 6); return { date: d, xp: byDay.get(d) ?? 0 }; }),
  };
}

function bookSummary(w: World, book: BookRow): BookSummary {
  const micros = w.s.micros.filter((m) => m.book_id === book.id);
  const ids = new Set(micros.map((m) => m.id));
  return {
    ...book,
    totalMicros: micros.length,
    totalChapters: w.s.chapters.filter((c) => c.book_id === book.id).length,
    totalMinutes: micros.reduce((sum, m) => sum + m.minutes, 0),
    readers: w.enrollments.filter((e) => e.book_id === book.id).length,
    enrolled: w.l.enrollments.some((e) => e.book_id === book.id),
    completed: w.l.completions.filter((c) => ids.has(c.micro_id)).length,
  };
}

const getBook = (w: World, slug: string) => w.s.books.find((b) => b.slug === slug) ?? fail("Book not found", 404);

/** Walk the book in order and work out what is done, what is next, and what is still locked. */
function bookProgress(w: World, bookId: number) {
  const micros = w.s.micros.filter((m) => m.book_id === bookId);
  const ids = new Set(micros.map((m) => m.id));
  const done = new Set(w.l.completions.filter((c) => ids.has(c.micro_id)).map((c) => c.micro_id));
  const quizMap = new Map(w.l.quizResults.map((r) => [r.chapter_id, r]));
  let open = true;
  let next: NextStep | null = null;
  const chapters: ChapterView[] = w.s.chapters.filter((c) => c.book_id === bookId).map((ch) => {
    const ms = micros.filter((m) => m.chapter_id === ch.id).map((m) => {
      let status: MicroStatus = "locked";
      if (done.has(m.id)) status = "done";
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
    return {
      id: ch.id, position: ch.position, title: ch.title, theme: ch.theme, micros: ms,
      quiz: { status: qs, score: q?.score ?? null, total: w.s.questions.filter((x) => x.chapter_id === ch.id).length },
    };
  });
  return { chapters, next: next as NextStep | null, completed: done.size, total: micros.length };
}

function ranking(w: World, userIds: number[], bookId: number, roles?: Map<number, string>): RankRow[] {
  const microXp = new Map(w.s.micros.filter((m) => m.book_id === bookId).map((m) => [m.id, true]));
  const chapterIds = new Set(w.s.chapters.filter((c) => c.book_id === bookId).map((c) => c.id));
  return w.s.users
    .filter((u) => userIds.includes(u.id))
    .map((user) => {
      const completions = w.completions.filter((c) => c.user_id === user.id);
      const quizzes = w.quizResults.filter((q) => q.user_id === user.id);
      const inBook = completions.filter((c) => microXp.has(c.micro_id));
      const lastActive = [...completions, ...quizzes].map((r) => r.completed_at).sort().at(-1) ?? null;
      return {
        user: { id: user.id, name: user.name, handle: user.handle, color: user.color },
        xp: inBook.reduce((sum, c) => sum + c.xp, 0) + quizzes.filter((q) => chapterIds.has(q.chapter_id)).reduce((sum, q) => sum + q.xp, 0),
        completed: inBook.length,
        streak: streakFrom(activityDates(w, user.id)),
        lastActive,
        isMe: user.id === ME,
        role: roles?.get(user.id),
      };
    })
    .sort((a, b) => b.xp - a.xp || b.completed - a.completed || a.user.name.localeCompare(b.user.name));
}

/** Join the most recent open cohort for the book (started within 7 days, under 30 readers), or start a new one. */
function assignCohort(w: World, bookId: number): number {
  const open = w.cohorts
    .filter((c) => c.book_id === bookId && c.started_at >= timestamp(-7) && w.enrollments.filter((e) => e.cohort_id === c.id).length < 30)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  if (open) return open.id;
  const names = ["Morning Stars", "Quiet Harbour", "Inner Citadel", "Promontory", "Olive Grove", "Night Watch"];
  const id = nextLocalId(w.cohorts);
  w.l.cohorts.push({ id, book_id: bookId, name: names[Math.floor(Math.random() * names.length)], started_at: timestamp() });
  return id;
}

function enroll(w: World, bookId: number) {
  if (w.l.enrollments.some((e) => e.book_id === bookId)) return;
  w.l.enrollments.push({ user_id: ME, book_id: bookId, cohort_id: assignCohort(w, bookId), started_at: timestamp() });
}

function microAccess(w: World, microId: number) {
  const m = (isId(microId) ? w.s.micros.find((x) => x.id === microId) : undefined) ?? fail("Micro-chapter not found", 404);
  if (!w.l.enrollments.some((e) => e.book_id === m.book_id)) fail("Start the book first", 403);
  const status = bookProgress(w, m.book_id).chapters.flatMap((ch) => ch.micros).find((x) => x.id === m.id)!.status;
  if (status === "locked") fail("This micro-chapter is still locked", 403);
  return { m, status };
}

function quizAccess(w: World, chapterId: number) {
  const ch = (isId(chapterId) ? w.s.chapters.find((c) => c.id === chapterId) : undefined) ?? fail("Chapter not found", 404);
  const status = bookProgress(w, ch.book_id).chapters.find((x) => x.id === ch.id)!.quiz.status;
  if (status === "locked") fail("Finish every micro-chapter in this book first", 403);
  return { ch, book: w.s.books.find((b) => b.id === ch.book_id)! };
}

function groupSummary(w: World, id: number) {
  const g = w.groups.find((x) => x.id === id)!;
  const book = w.s.books.find((b) => b.id === g.book_id)!;
  const members = w.members.filter((m) => m.group_id === id);
  const rows = ranking(w, members.map((m) => m.user_id), g.book_id);
  const summary: GroupSummary = {
    id: g.id, name: g.name, description: g.description, color: g.color, members: members.length,
    myRank: rows.findIndex((r) => r.isMe) + 1, book: { slug: book.slug, title: book.title }, isOwner: g.owner_id === ME,
  };
  return summary;
}

const isMember = (w: World, groupId: number) => w.l.members.some((m) => m.group_id === groupId);

// ---------------------------------------------------------------- routes

function getMe(w: World): Me {
  const user = w.s.users.find((u) => u.id === ME)!;
  const latest = [...w.l.enrollments].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  let reading: Me["reading"] = null;
  if (latest) {
    const book = w.s.books.find((b) => b.id === latest.book_id)!;
    const p = bookProgress(w, book.id);
    reading = { book: bookSummary(w, book), completed: p.completed, total: p.total, next: p.next };
  }
  return { user: { id: user.id, name: user.name, handle: user.handle, color: user.color }, stats: getStats(w), reading };
}

function getBookDetail(w: World, slug: string): BookDetail {
  const book = getBook(w, slug);
  const summary = bookSummary(w, book);
  const p = bookProgress(w, book.id);
  const enrollment = w.l.enrollments.find((e) => e.book_id === book.id);
  const cohort = enrollment && w.cohorts.find((c) => c.id === enrollment.cohort_id);
  return { book: summary, chapters: p.chapters, next: summary.enrolled ? p.next : null, cohort: cohort ? { id: cohort.id, name: cohort.name } : null };
}

async function getMicro(w: World, id: number): Promise<MicroDetail> {
  const { m, status } = microAccess(w, id);
  const { content } = await request<Pick<MicroDetail, "content">>(`/micro/${m.id}/content`);
  const ch = w.s.chapters.find((c) => c.id === m.chapter_id)!;
  const book = w.s.books.find((b) => b.id === m.book_id)!;
  const count = w.s.micros.filter((x) => x.chapter_id === ch.id).length;
  return {
    id: m.id, title: m.title, sections: m.sections, minutes: m.minutes, words: m.words, position: m.position, seq: m.seq,
    content, footer: m.position === count ? ch.footer : null, done: status === "done",
    chapter: { id: ch.id, position: ch.position, title: ch.title, count },
    book: { slug: book.slug, title: book.title, author: book.author, total: w.s.micros.filter((x) => x.book_id === book.id).length },
  };
}

function completeMicro(w: World, id: number): CompleteResult {
  const { m, status } = microAccess(w, id);
  let xp = 0, bonus = 0;
  if (status !== "done") {
    const today = w.l.completions.filter((c) => c.completed_at.slice(0, 10) === day()).length;
    bonus = today === 0 ? XP_DAILY_BONUS : 0;
    xp = XP_MICRO + bonus;
    w.l.completions.push({ user_id: ME, micro_id: m.id, xp, completed_at: timestamp() });
    save();
  }
  return { xp, bonus, alreadyDone: status === "done", stats: getStats(w), next: bookProgress(w, m.book_id).next };
}

function getQuiz(w: World, chapterId: number): QuizView {
  const { ch, book } = quizAccess(w, chapterId);
  return {
    chapter: { id: ch.id, position: ch.position, title: ch.title },
    book: { slug: book.slug, title: book.title },
    questions: w.s.questions.filter((q) => q.chapter_id === ch.id).map((q) => ({ id: q.id, question: q.question, options: JSON.parse(q.options) })),
    best: w.l.quizResults.find((r) => r.chapter_id === ch.id)?.score ?? null,
    passMark: PASS_MARK,
  };
}

function checkQuiz(w: World, chapterId: number, body: { questionId?: unknown; choice?: unknown }): QuizCheck {
  const { ch } = quizAccess(w, chapterId);
  const q = w.s.questions.find((x) => x.id === body.questionId && x.chapter_id === ch.id) ?? fail("Question not found", 404);
  return { correct: q.answer === body.choice, answer: q.answer, explanation: q.explanation };
}

function submitQuiz(w: World, chapterId: number, body: { answers?: Record<string, number> }): QuizSubmitResult {
  const { ch } = quizAccess(w, chapterId);
  const questions = w.s.questions.filter((q) => q.chapter_id === ch.id);
  const score = questions.filter((q) => body.answers?.[q.id] === q.answer).length;
  const total = questions.length;
  const passed = score >= PASS_MARK;
  const perfect = score === total;
  const earned = score * XP_PER_CORRECT + (perfect ? XP_PERFECT : 0);
  const prev = w.l.quizResults.find((r) => r.chapter_id === ch.id);
  let xp = 0;
  // Only the best attempt counts, and only a pass is recorded (retries can still raise it).
  if (passed && (!prev || earned > prev.xp)) {
    xp = earned - (prev?.xp ?? 0);
    const row = { user_id: ME, chapter_id: ch.id, score, total, passed: 1, xp: earned, completed_at: timestamp() };
    if (prev) Object.assign(prev, row);
    else w.l.quizResults.push(row);
    save();
  }
  return { score, total, passed, xp, perfect, stats: getStats(w), next: bookProgress(w, ch.book_id).next };
}

function getLeague(w: World, slug: string): League {
  const book = getBook(w, slug);
  const enrollment = w.l.enrollments.find((e) => e.book_id === book.id);
  const cohort = enrollment && w.cohorts.find((c) => c.id === enrollment.cohort_id);
  const peers = cohort ? w.enrollments.filter((e) => e.cohort_id === cohort.id).map((e) => e.user_id) : [];
  return {
    book: { slug: book.slug, title: book.title },
    cohort: cohort ? { id: cohort.id, name: cohort.name, startedAt: cohort.started_at, size: peers.length } : null,
    rows: ranking(w, peers, book.id),
  };
}

function getGroup(w: World, id: number): GroupDetail {
  if (!isId(id) || !isMember(w, id)) fail("Group not found", 404);
  const g = w.groups.find((x) => x.id === id)!;
  const members = w.members.filter((m) => m.group_id === id);
  const roles = new Map(members.map((m) => [m.user_id, m.role]));
  const rows = ranking(w, [...roles.keys()], g.book_id, roles);
  const users = new Map(rows.map((r) => [r.user.id, r.user]));
  const micros = new Map(w.s.micros.filter((m) => m.book_id === g.book_id).map((m) => [m.id, m.title]));
  const chapters = new Map(w.s.chapters.filter((c) => c.book_id === g.book_id).map((c) => [c.id, c.title]));
  const activity: Activity[] = [
    ...w.completions.filter((c) => roles.has(c.user_id) && micros.has(c.micro_id))
      .map((c) => ({ user: users.get(c.user_id)!, kind: "micro" as const, title: micros.get(c.micro_id)!, xp: c.xp, at: c.completed_at })),
    ...w.quizResults.filter((q) => roles.has(q.user_id) && chapters.has(q.chapter_id))
      .map((q) => ({ user: users.get(q.user_id)!, kind: "quiz" as const, title: chapters.get(q.chapter_id)!, xp: q.xp, at: q.completed_at })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  return {
    group: { ...groupSummary(w, id), inviteCode: g.invite_code, createdAt: g.created_at },
    rows,
    invites: w.invites.filter((i) => i.group_id === id).map((i) => ({ email: i.email, status: i.status, createdAt: i.created_at })),
    activity,
  };
}

function createGroup(w: World, body: { name?: unknown; description?: unknown; book?: unknown }) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 60) fail("Give your group a name (up to 60 characters)", 400);
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > MAX_DESCRIPTION) fail(`Keep the description under ${MAX_DESCRIPTION} characters`, 400);
  const book = getBook(w, typeof body.book === "string" ? body.book : "meditations");
  const colors = ["#0f766e", "#c2410c", "#7c3aed", "#1d4ed8", "#be123c", "#4d7c0f"];
  const code = `${name.replace(/[^a-z]/gi, "").slice(0, 4).toUpperCase().padEnd(4, "X")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  const id = nextLocalId(w.groups);
  w.l.groups.push({
    id, name, description: description || null, book_id: book.id, owner_id: ME,
    color: colors[Math.floor(Math.random() * colors.length)], invite_code: code, created_at: timestamp(),
  });
  w.l.members.push({ group_id: id, user_id: ME, role: "owner", joined_at: timestamp() });
  enroll(w, book.id);
  save();
  return { id };
}

function inviteToGroup(w: World, id: number, body: { email?: unknown }) {
  if (!isId(id) || !isMember(w, id)) fail("Group not found", 404);
  const e = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!e || e.length > MAX_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail("That doesn't look like an email address", 400);
  // Mocked: no email is actually sent. The invite is just recorded as pending.
  w.l.invites.unshift({ group_id: id, email: e, status: "pending", created_at: timestamp() });
  save();
  return { ok: true };
}

function joinGroup(w: World, body: { code?: unknown }) {
  const code = (typeof body.code === "string" ? body.code : "").trim().toUpperCase();
  const g = w.groups.find((x) => x.invite_code === code) ?? fail("No group uses that invite code", 404);
  if (!isMember(w, g.id)) w.l.members.push({ group_id: g.id, user_id: ME, role: "member", joined_at: timestamp() });
  enroll(w, g.book_id);
  save();
  return { id: g.id };
}

/** Back to a clean start: no progress, and only the groups this visitor began with. */
function reset(w: World) {
  state = { ...seedState(w.s), enrollments: [], completions: [], quizResults: [] };
  save();
  return { ok: true };
}

/** Answers an app request the way an API would, throwing ApiError for failures. */
export async function localApi(method: string, path: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const w = world(await loadSnapshot());
  const url = new URL(path, "http://local");
  const [a, b, c] = url.pathname.split("/").filter(Boolean);
  const id = Number(b);

  if (method === "GET") {
    if (a === "me" && !b) return getMe(w);
    if (a === "books" && !b) return w.s.books.map((book) => bookSummary(w, book));
    if (a === "books" && !c) return getBookDetail(w, b);
    if (a === "micro" && !c) return getMicro(w, id);
    if (a === "quiz" && !c) return getQuiz(w, id);
    if (a === "league" && !b) return getLeague(w, url.searchParams.get("book") ?? "meditations");
    if (a === "groups" && !b) return w.groups.filter((g) => isMember(w, g.id)).map((g) => groupSummary(w, g.id));
    if (a === "groups" && !c) return getGroup(w, id);
  } else {
    if (a === "books" && c === "start") { enroll(w, getBook(w, b).id); save(); return { ok: true }; }
    if (a === "micro" && c === "complete") return completeMicro(w, id);
    if (a === "quiz" && c === "check") return checkQuiz(w, id, body);
    if (a === "quiz" && c === "submit") return submitQuiz(w, id, body);
    if (a === "groups" && b === "join") return joinGroup(w, body);
    if (a === "groups" && !b) return createGroup(w, body);
    if (a === "groups" && c === "invite") return inviteToGroup(w, id, body);
    if (a === "demo" && b === "reset") return reset(w);
  }
  return fail("Not found", 404);
}
