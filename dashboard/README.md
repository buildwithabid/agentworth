# Agentworth internal dashboard

Internal-only dashboard for the three founders. Not client facing, not linked
from the marketing site at the repo root.

Stack: React + Vite + TypeScript + Tailwind, Supabase for data and auth,
deployed as a static build.

## ⚠ Before you put real data in this

**Public sign-up is still open on the Supabase project.** The anon key ships
inside the JS bundle, so anyone who opens the deployed page can call
`/auth/v1/signup`, create an account, and — because every policy grants full
access to any logged-in user — read and write the pipeline and the ledger.

Fix it before the first real row goes in:
**Supabase dashboard → Authentication → Sign In / Providers → Email →
turn off "Allow new users to sign up"**, then create the three founder accounts
by hand under **Authentication → Users**.

I verified sign-up is open by creating a test account, then deleted it. The
project currently has zero users and zero rows.

Worth doing at the same time: **Authentication → Policies → enable leaked
password protection** (the only security-advisor warning left on the project).

## Supabase project

Already created and migrated: **agentworth-dashboard**
(`fanvuxwojwccowofshjm`, region ap-south-1, free tier).

Both migrations in `supabase/migrations/` are applied. Tables: `deals`,
`capacity_settings` (seeded with a 20 h cap), `projects`, `ledger_entries`,
`checklist_steps`. RLS is on everywhere with one policy per table: any
authenticated user has full read/write. Verified: anonymous callers get zero
rows on read and 401 on insert.

## Screens

| # | Screen | Status |
|---|--------|--------|
| 1 | Pipeline — deals by stage, duplicate-company warning, value per owner | built, tested against the live database |
| 2 | Capacity — weekly hours cap vs committed, earliest free week | built, tested against the live database |
| 3 | Ledger | schema only |
| 4 | Setup checklist | schema only |
| 5 | Weekly numbers | schema only |

## Running it

```
cp .env.example .env      # already points at the live project
npm install
npm run dev               # local
npm run build             # static build into dist/
```

`vite.config.ts` uses a relative `base`, so `dist/` works from the domain root
or from a subpath. Routing is hash-based for the same reason — no server
rewrite rules needed.

## Things worth knowing

- **Duplicate companies.** Detected on a normalised name — the generated
  `company_key` column is `lower(btrim(company))`, so `"  northgate
  ACCOUNTANTS "` collides with `"Northgate Accountants"`. Deals in `Lost` are
  ignored; a dead deal is not a collision. The warning shows on the board, on
  the affected cards, and live in the form before you save.
- **Pipeline value.** "Open" means `Lead`, `Contacted`, `Scoped`, `Proposal`.
  `Won` is reported separately; `Lost` is not counted.
- **Capacity.** A project consumes its `est_hours_per_week` in every week
  between `start_date` and `end_date` inclusive. A project with no end date
  holds those hours forever, so free capacity never appears — that is
  deliberate, put an end date on anything meant to finish.
- **Earliest free week** looks 26 weeks ahead and reports the first week under
  cap. If nothing is free in that horizon it says so rather than guessing.
- **Stage history.** `deals.stage_changed_at` is maintained by a trigger. It is
  not used by any screen yet; it exists so "deals moved this week" on screen 5
  has data when that screen gets built.
- The `checklist_steps` table is empty on purpose. Steps get inserted as rows
  once the 19-step list is agreed — they are not in code.
