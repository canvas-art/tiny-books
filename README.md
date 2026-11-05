# tiny books

Read classic books a few minutes a day. It mixes the gamified daily habit of Duolingo with the group challenges of GymRats.
This MVP ships one book, *Meditations* by Marcus Aurelius (Project Gutenberg #2680), split into 95 micro-chapters across its 12 books. Each book ends with a 5-question quiz (the "mini-boss").

One Cloudflare Worker serves everything:

- **Frontend**: React 19 + Vite (`src/`), mobile-first, served as static assets
- **Backend**: Hono API at `/api/*` (`worker/index.ts`)
- **Database**: Cloudflare D1 (`migrations/`)

## Run locally

```sh
pnpm install
pnpm dev                # http://localhost:5173
```

`pnpm dev` runs against a local D1 database (SQLite in `.wrangler/state`), never the Cloudflare one.
Before starting, it applies any pending migrations: the schema, the book and the mock data.
`pnpm db:reset:local` wipes the local DB and reseeds it from scratch. Stop the dev server first.

## Deploy

```sh
npx wrangler d1 create tiny-books        # paste the database_id into wrangler.jsonc
pnpm db:migrate:remote
pnpm deploy
```

## What's real and what's mocked

- **Real**: the book text, the micro-chapter split, the quizzes, XP, streaks, daily goal, locked/unlocked progression, cohort leagues, group creation, and group rankings. All of it is stored in D1.
- **Mocked**: auth (you are always John Doe, user 1), the other 25 readers and their progress, and invite emails (they are recorded but not sent). Profile → *Reset my progress* lets you start the book from scratch.

## Rules

- Micro-chapter: 10 XP, plus 5 XP for the first one each day. The daily goal is 1 and you can read as many as you like.
- Quiz: unlocks after every micro-chapter in its book is read. Pass with 3/5. Each correct answer is 5 XP, and a perfect score adds 15 XP. Only your best attempt counts. Passing unlocks the next book.
- League: starting a book puts you in a cohort with readers who started within the same week (up to 30), ranked by XP. No group is needed.
- Groups: a shared challenge on one book, with a leaderboard, an activity feed and an invite code (`/join/<code>`).

## Path themes

Each book's path (the road of steps and quizzes on Home) is drawn by a theme, chosen by the book's `path_theme` column.
*Meditations* uses `roman`; any book without a theme gets `minimal`.
Themes are self-contained folders in `src/path/themes/`. See the README there to add one.
Add `?theme=<id>` to the URL to preview any theme.

## Regenerating the book content

`data/meditations.txt` is the Gutenberg source. `scripts/editorial.json` holds the micro-chapter titles, book themes and quizzes.

```sh
pnpm seed:gen   # rewrites migrations/0002 and 0003
```
