"""Generate D1 seed migrations: the real book (0002) and mock social data (0003)."""
import json, math, random

ROOT = __file__.rsplit("/scripts/", 1)[0]
micros = json.load(open(f"{ROOT}/data/micros.json"))
ed = json.load(open(f"{ROOT}/scripts/editorial.json"))

def q(s):
    return "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"

# ---------- 0002: book content ----------
b = ed["book"]
out = ["-- Meditations by Marcus Aurelius (Project Gutenberg #2680), split into micro-chapters.",
       f"INSERT INTO books (id, slug, title, author, translator, source, year, blurb, cover) VALUES (1, {q(b['slug'])}, {q(b['title'])}, {q(b['author'])}, {q(b['translator'])}, {q(b['source'])}, {q(b['year'])}, {q(b['blurb'])}, {q(b['cover'])});"]
mid, qid, seq = 0, 0, 0
micro_ids = []          # ordered list of all micro ids
chapter_of = {}         # micro id -> chapter id
for ci, bk in enumerate(micros):
    ch = ed["chapters"][ci]
    out.append(f"INSERT INTO chapters (id, book_id, position, title, theme, footer) VALUES ({ci+1}, 1, {ci+1}, {q(ch['title'])}, {q(ch['theme'])}, {q(bk['footer'])});")
    titles = ed["micro_titles"][ci]
    assert len(titles) == len(bk["micros"]), (ci, len(titles), len(bk["micros"]))
    for pi, m in enumerate(bk["micros"]):
        mid += 1; seq += 1
        secs = m["sections"]
        label = secs[0]["n"] if len(secs) == 1 else f"{secs[0]['n']}–{secs[-1]['n']}"
        content = json.dumps([{"n": s["n"], "paras": s["paras"]} for s in secs], ensure_ascii=False)
        minutes = max(2, math.ceil(m["words"] / 200))
        out.append(f"INSERT INTO micro_chapters (id, book_id, chapter_id, position, seq, title, sections, words, minutes, content) VALUES ({mid}, 1, {ci+1}, {pi+1}, {seq}, {q(titles[pi])}, {q(label)}, {m['words']}, {minutes}, {q(content)});")
        micro_ids.append(mid); chapter_of[mid] = ci + 1
    for qi, qq in enumerate(ed["quizzes"][ci]):
        qid += 1
        out.append(f"INSERT INTO quiz_questions (id, chapter_id, position, question, options, answer, explanation) VALUES ({qid}, {ci+1}, {qi+1}, {q(qq['q'])}, {q(json.dumps(qq['options'], ensure_ascii=False))}, {qq['answer']}, {q(qq['why'])});")
open(f"{ROOT}/migrations/0002_book_meditations.sql", "w").write("\n".join(out) + "\n")

# ---------- 0003: mock social data ----------
rnd = random.Random(42)
COLORS = ["#c2410c", "#0f766e", "#7c3aed", "#b45309", "#be123c", "#1d4ed8", "#4d7c0f", "#a21caf", "#0e7490", "#57534e"]
names = ["John Doe", "Maria Santos", "Leo Park", "Aisha Bello", "Tom Becker", "Sofia Rossi", "Kenji Ito", "Clara Dupont",
         "Ravi Menon", "Elena Petrova", "Lucas Silva", "Nora Lindqvist", "Omar Haddad", "Grace Kim", "Pedro Alves",
         "Hannah Weiss", "Samuel Okafor", "Isabel Cruz", "Yuki Tanaka", "Daniel Moore", "Amara Diallo", "Felix Wagner",
         "Zoe Turner", "Mateo Garcia", "Ines Costa", "Victor Hugo Lima"]
out = ["-- Mock users, cohorts, groups and progress. Dates are relative to the moment the migration runs."]
for i, n in enumerate(names, start=1):
    handle = n.lower().replace(" ", ".")
    out.append(f"INSERT INTO users (id, name, handle, color) VALUES ({i}, {q(n)}, {q(handle)}, {q(COLORS[i % len(COLORS)])});")

# Cohorts: an older one and the current one John joined.
out.append("INSERT INTO cohorts (id, book_id, name, started_at) VALUES (1, 1, 'Early Risers', datetime('now', '-16 days'));")
out.append("INSERT INTO cohorts (id, book_id, name, started_at) VALUES (2, 1, 'Morning Stars', datetime('now', '-3 days'));")

def ts(days_ago, hour):
    return f"datetime('now', 'start of day', '-{days_ago} days', '+{hour} hours', '+{rnd.randint(0, 59)} minutes')"

def progress(uid, started_days_ago, count, cohort):
    out.append(f"INSERT INTO enrollments (user_id, book_id, cohort_id, started_at) VALUES ({uid}, 1, {cohort}, datetime('now', '-{started_days_ago} days'));")
    # spread completions over the days since start (oldest first), at most a few per day
    days = []
    d = started_days_ago
    for k in range(count):
        days.append(max(0, d))
        if rnd.random() < 0.6: d -= 1
    seen_day = set()
    done_chapters = {}
    for k in range(count):
        m = micro_ids[k]; day = days[k]
        xp = 10 + (5 if day not in seen_day else 0)
        seen_day.add(day)
        out.append(f"INSERT INTO completions (user_id, micro_id, xp, completed_at) VALUES ({uid}, {m}, {xp}, {ts(day, rnd.randint(6, 22))});")
        done_chapters.setdefault(chapter_of[m], []).append(day)
    # boss quizzes for fully completed chapters
    for ch, ds in done_chapters.items():
        total = sum(1 for mm in micro_ids if chapter_of[mm] == ch)
        if len(ds) == total and rnd.random() < 0.9:
            score = rnd.choice([3, 4, 4, 5, 5])
            xp = score * 5 + (15 if score == 5 else 0)
            out.append(f"INSERT INTO quiz_results (user_id, chapter_id, score, total, passed, xp, completed_at) VALUES ({uid}, {ch}, {score}, 5, 1, {xp}, {ts(min(ds), 23)});")

# John (1): current cohort, 3 micro-chapters done (2 days ago, yesterday, yesterday).
out.append("INSERT INTO enrollments (user_id, book_id, cohort_id, started_at) VALUES (1, 1, 2, datetime('now', '-2 days', '-3 hours'));")
out.append(f"INSERT INTO completions (user_id, micro_id, xp, completed_at) VALUES (1, 1, 15, {ts(2, 8)});")
out.append(f"INSERT INTO completions (user_id, micro_id, xp, completed_at) VALUES (1, 2, 15, {ts(1, 7)});")
out.append(f"INSERT INTO completions (user_id, micro_id, xp, completed_at) VALUES (1, 3, 10, {ts(1, 21)});")

# Current cohort "Morning Stars": users 2..19 started 0-3 days ago.
for uid in range(2, 20):
    start = rnd.randint(0, 3)
    count = min(rnd.choice([0, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8]), (start + 1) * 3)
    progress(uid, start, count, 2)
# Older cohort "Early Risers": users 20..26 started 16 days ago, much further along.
for uid in range(20, 27):
    progress(uid, 16, rnd.randint(8, 24), 1)

# Groups
out.append("INSERT INTO groups (id, name, description, book_id, owner_id, color, invite_code, created_at) VALUES (1, 'Stoa at Dawn', 'Friends reading one micro-chapter before coffee. Slow and steady.', 1, 2, '#0f766e', 'STOA-7K2Q', datetime('now', '-5 days'));")
out.append("INSERT INTO groups (id, name, description, book_id, owner_id, color, invite_code, created_at) VALUES (2, 'Office Philosophers', 'Lunch-break Stoicism for the product team.', 1, 1, '#c2410c', 'DESK-3FQ9', datetime('now', '-3 days'));")
for uid, role in [(2, 'owner'), (1, 'member'), (3, 'member'), (4, 'member'), (20, 'member'), (7, 'member'), (11, 'member')]:
    out.append(f"INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (1, {uid}, '{role}', datetime('now', '-{rnd.randint(2, 5)} days'));")
for uid, role in [(1, 'owner'), (5, 'member'), (9, 'member'), (14, 'member')]:
    out.append(f"INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (2, {uid}, '{role}', datetime('now', '-{rnd.randint(1, 3)} days'));")
out.append("INSERT INTO group_invites (group_id, email, invited_by, created_at) VALUES (2, 'priya@example.com', 1, datetime('now', '-1 days'));")
open(f"{ROOT}/migrations/0003_mock_data.sql", "w").write("\n".join(out) + "\n")
print(f"wrote {len(micro_ids)} micro-chapters, {qid} quiz questions")
