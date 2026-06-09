---
name: feedback-dashboard
description: >
  Build a production-disciplined customer feedback dashboard from scratch in ~100 minutes.
  Use this skill whenever the user wants to build a feedback collection app, survey dashboard,
  review aggregator, NPS tracker, or any form-to-table data pipeline — especially in a
  Vietnamese business or SaaS context. Triggers on: "feedback dashboard", "customer reviews app",
  "build a feedback form", "admin feedback table", "sentiment dashboard", "coffee chain app",
  or any request to scaffold a web app with form submission + admin view + CSV export.
  Even if the user just says "I want to collect feedback from customers", use this skill.
---

# Feedback Dashboard Skill

A disciplined, step-by-step workflow for building a customer feedback dashboard.
Reference stack: **Next.js + Tailwind CSS + SQLite (better-sqlite3)**.
Each step ends with a `git commit`. Total time: ~100 minutes.

---

## Phase 0 — Context Setup (5 min)

Before writing any code, create two anchor files.

### `CLAUDE.md` (project root)

This file gives Claude persistent context across every session. Include:

```markdown
# Project: [Brand] Feedback Dashboard

## Stack
- Next.js 14 (App Router)
- Tailwind CSS
- SQLite via better-sqlite3
- TypeScript

## Domain
- Vietnamese coffee chain (or adapt to brand)
- Branches: list branch names
- Feedback fields: branch, rating (1–5), category, comment, timestamp

## Conventions
- All monetary values: VND (no decimals)
- Dates: ISO 8601 stored, `dd/MM/yyyy HH:mm` displayed
- Sentiment: score ≥ 4 = positive (green), score = 3 = neutral (yellow), score ≤ 2 = negative (red)
- API routes: /api/feedback (POST = submit, GET = list with filters)
- Components in /components, db logic in /lib/db.ts

## Commit discipline
- One commit per feature step
- Format: `feat: <step-name>` or `fix: <description>`
```

### Reusable Skill Context

Note in `CLAUDE.md` that this project follows the `feedback-dashboard` skill pattern.
Any future Claude session reading this file should consult the skill for sequence and conventions.

**Commit:** `chore: add CLAUDE.md and project context`

---

## Phase 1 — Spec (10 min)

Write `SPEC.md` at project root before scaffolding. Sections:

```markdown
## Features
1. Public submit form — branch, rating (stars), category, comment
2. Admin table — sortable, paginated list of all feedback
3. Filters — by branch, date range, sentiment
4. Sentiment color coding — row/badge colors based on rating
5. CSV export — filtered results as downloadable CSV

## Data Model
feedback {
  id          INTEGER PRIMARY KEY AUTOINCREMENT
  branch      TEXT NOT NULL
  rating      INTEGER NOT NULL  -- 1 to 5
  category    TEXT              -- 'Service' | 'Product' | 'Ambiance' | 'Other'
  comment     TEXT
  created_at  TEXT DEFAULT (datetime('now'))
}

## Non-goals (v1)
- Authentication (admin is open)
- Charts / analytics
- Email notifications
```

**Commit:** `docs: add SPEC.md`

---

## Phase 2 — Scaffold (10 min)

```bash
npx create-next-app@latest feedback-dashboard \
  --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd feedback-dashboard
npm install better-sqlite3
npm install -D @types/better-sqlite3
git init   # if not already
```

Create `/lib/db.ts`:

```ts
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'feedback.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        branch TEXT NOT NULL,
        rating INTEGER NOT NULL,
        category TEXT,
        comment TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }
  return db;
}
```

Add `feedback.db` to `.gitignore`.

**Commit:** `feat: scaffold Next.js app with SQLite db init`

---

## Phase 3 — Submit Form (15 min)

### API Route `/app/api/feedback/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { branch, rating, category, comment } = await req.json();
  if (!branch || !rating) {
    return NextResponse.json({ error: 'branch and rating required' }, { status: 400 });
  }
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO feedback (branch, rating, category, comment) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(branch, rating, category ?? null, comment ?? null);
  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
```

### Page `/app/page.tsx` — Submit Form UI

Key form fields:
- **Branch** — `<select>` with branch list from `CLAUDE.md`
- **Rating** — star button group (1–5), store as integer
- **Category** — `<select>`: Service, Product, Ambiance, Other
- **Comment** — `<textarea>` optional

On submit: `fetch('/api/feedback', { method: 'POST', body: JSON.stringify(data) })`

Show success toast or inline confirmation on 201.

**Commit:** `feat: submit form with POST /api/feedback`

---

## Phase 4 — Admin Table (15 min)

### Extend API route (GET handler in same file)

```ts
export async function GET(req: NextRequest) {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM feedback ORDER BY created_at DESC'
  ).all();
  return NextResponse.json(rows);
}
```

### Page `/app/admin/page.tsx`

- `useEffect` → fetch `/api/feedback` on mount
- Render `<table>` with columns: ID, Branch, Rating, Category, Comment, Date
- Format `created_at` as `dd/MM/yyyy HH:mm`
- Basic Tailwind table styling: `table-auto w-full text-sm`

**Commit:** `feat: admin table with GET /api/feedback`

---

## Phase 5 — Filters (15 min)

### Extend GET handler to accept query params

```ts
const { searchParams } = new URL(req.url);
const branch   = searchParams.get('branch');
const sentiment = searchParams.get('sentiment'); // 'positive'|'neutral'|'negative'
const from     = searchParams.get('from');  // ISO date string
const to       = searchParams.get('to');

let query = 'SELECT * FROM feedback WHERE 1=1';
const params: unknown[] = [];

if (branch)    { query += ' AND branch = ?';       params.push(branch); }
if (from)      { query += ' AND created_at >= ?';  params.push(from); }
if (to)        { query += ' AND created_at <= ?';  params.push(to + 'T23:59:59'); }
if (sentiment === 'positive') { query += ' AND rating >= 4'; }
if (sentiment === 'neutral')  { query += ' AND rating = 3'; }
if (sentiment === 'negative') { query += ' AND rating <= 2'; }

query += ' ORDER BY created_at DESC';
const rows = db.prepare(query).all(...params);
```

### Filter UI (admin page)

Three controls above the table:
1. Branch `<select>` (+ "All Branches" option)
2. Sentiment `<select>`: All / Positive / Neutral / Negative
3. Date range: two `<input type="date">` fields

Wire each control to rebuild the query string and re-fetch.

**Commit:** `feat: branch/sentiment/date filters`

---

## Phase 6 — Sentiment Color Coding (10 min)

### Utility function `/lib/sentiment.ts`

```ts
export type Sentiment = 'positive' | 'neutral' | 'negative';

export function getSentiment(rating: number): Sentiment {
  if (rating >= 4) return 'positive';
  if (rating === 3) return 'neutral';
  return 'negative';
}

export const SENTIMENT_CLASSES: Record<Sentiment, string> = {
  positive: 'bg-green-50 text-green-800',
  neutral:  'bg-yellow-50 text-yellow-800',
  negative: 'bg-red-50 text-red-800',
};

export const SENTIMENT_BADGE: Record<Sentiment, string> = {
  positive: 'bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium',
  neutral:  'bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-medium',
  negative: 'bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium',
};
```

Apply `SENTIMENT_CLASSES` to each `<tr>` and `SENTIMENT_BADGE` to the Rating cell.

**Commit:** `feat: sentiment color coding on admin table rows`

---

## Phase 7 — CSV Export (10 min)

### API route `/app/api/feedback/export/route.ts`

Reuse same filter logic, then serialize to CSV:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  // ... same filter logic as main GET handler ...
  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];

  const headers = ['id', 'branch', 'rating', 'category', 'comment', 'created_at'];
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => JSON.stringify(r[h] ?? '')).join(',')
    )
  ].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="feedback-export.csv"',
    },
  });
}
```

### Export Button (admin page)

```tsx
const handleExport = () => {
  const params = new URLSearchParams(currentFilters);
  window.open(`/api/feedback/export?${params}`, '_blank');
};
```

Place "Export CSV" button alongside filters. Exports only the currently filtered view.

**Commit:** `feat: CSV export respecting active filters`

---

## Phase 8 — GitHub Push (5 min)

```bash
# First push
git remote add origin https://github.com/<user>/<repo>.git
git branch -M main
git push -u origin main
```

Verify `feedback.db` is absent from the push (`.gitignore` check).

**Final commit before push (if anything unstaged):**
```bash
git add .
git commit -m "chore: final cleanup before first push"
git push
```

---

## Commit Log Summary

| Step | Commit message |
|------|---------------|
| 0    | `chore: add CLAUDE.md and project context` |
| 1    | `docs: add SPEC.md` |
| 2    | `feat: scaffold Next.js app with SQLite db init` |
| 3    | `feat: submit form with POST /api/feedback` |
| 4    | `feat: admin table with GET /api/feedback` |
| 5    | `feat: branch/sentiment/date filters` |
| 6    | `feat: sentiment color coding on admin table rows` |
| 7    | `feat: CSV export respecting active filters` |
| 8    | `chore: final cleanup before first push` |

---

## Debugging Quick Reference

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `better-sqlite3` build error | Native module, needs rebuild | `npm rebuild better-sqlite3` |
| DB not found in prod | `process.cwd()` differs | Use absolute path via `__dirname` equivalent |
| Filters not applying | Query param parsing order | Log `searchParams` before building query |
| CSV garbled in Excel | Encoding | Add BOM: prepend `'\uFEFF'` to csv string |
| Tailwind classes missing | Dynamic class names | Use full class strings, not template literals |

---

## Customization Notes

- **Branches**: populate from environment variable or a `branches` table for multi-tenant use
- **Auth**: add NextAuth.js basic credentials to protect `/admin`
- **Localization**: wrap labels in a simple `t()` function for Vietnamese/English toggle
- **Deployment**: works on Vercel (use `@vercel/sqlite` or Turso instead of local SQLite for production)
