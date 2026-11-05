import { Hono } from "hono";
import type { Snapshot } from "../shared/types";
import { accessStatus, baseProtection, grantAccess, requireAccess, validId, type SecurityBindings } from "./security";

type Env = SecurityBindings & { DB: D1Database };
type C = { Bindings: Env };

// The database is read-only for clients: every query here is a SELECT, and any other method is rejected.
// Each visitor's progress lives in their own browser (src/local/engine.ts).
const app = new Hono<C>().basePath("/api");

app.use("*", ...baseProtection);
app.get("/access", accessStatus);
app.post("/access", grantAccess);
app.on(["POST", "PUT", "PATCH", "DELETE"], "*", (c) => c.json({ error: "This API is read-only" }, 405));
app.use("*", requireAccess);

const SNAPSHOT_QUERIES = [
  `SELECT * FROM books ORDER BY title`,
  `SELECT id, book_id, position, title, theme, footer FROM chapters ORDER BY position`,
  `SELECT id, book_id, chapter_id, position, seq, title, sections, words, minutes FROM micro_chapters ORDER BY seq`,
  `SELECT id, chapter_id, position, question, options, answer, explanation FROM quiz_questions ORDER BY position`,
  `SELECT id, name, handle, color FROM users`,
  `SELECT id, book_id, name, started_at FROM cohorts`,
  `SELECT user_id, book_id, cohort_id, started_at FROM enrollments`,
  `SELECT user_id, micro_id, xp, completed_at FROM completions`,
  `SELECT user_id, chapter_id, score, total, passed, xp, completed_at FROM quiz_results`,
  `SELECT id, name, description, book_id, owner_id, color, invite_code, created_at FROM groups ORDER BY created_at`,
  `SELECT group_id, user_id, role, joined_at FROM group_members`,
  `SELECT group_id, email, status, created_at FROM group_invites ORDER BY created_at DESC`,
];

/** Everything the browser needs except the book text, which loads one micro-chapter at a time. */
app.get("/snapshot", async (c) => {
  const db = c.env.DB;
  const [books, chapters, micros, questions, users, cohorts, enrollments, completions, quizResults, groups, members, invites] =
    await db.batch(SNAPSHOT_QUERIES.map((q) => db.prepare(q)));
  return c.json({
    books: books.results, chapters: chapters.results, micros: micros.results, questions: questions.results,
    users: users.results, cohorts: cohorts.results, enrollments: enrollments.results, completions: completions.results,
    quizResults: quizResults.results, groups: groups.results, members: members.results, invites: invites.results,
  } as Snapshot);
});

app.get("/micro/:id/content", async (c) => {
  const id = Number(c.req.param("id"));
  if (!validId(id)) return c.json({ error: "Micro-chapter not found" }, 404);
  const row = await c.env.DB.prepare(`SELECT content FROM micro_chapters WHERE id=?`).bind(id).first<{ content: string }>();
  if (!row) return c.json({ error: "Micro-chapter not found" }, 404);
  return c.json({ content: JSON.parse(row.content) });
});

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => { console.error(err); return c.json({ error: "Something went wrong" }, 500); });

export default app satisfies ExportedHandler<Env>;
