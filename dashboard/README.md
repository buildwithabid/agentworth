# Agentworth internal dashboard

Internal-only dashboard for the three founders. Not client facing, not linked
from the marketing site at the repo root.

Stack: React + Vite + TypeScript + Tailwind, Supabase for data and auth,
deployed as a static build.

## Live at https://agentworth.co/dashboard/

Published from `main` as part of the existing GitHub Pages site. The marketing
page at the root is untouched. The URL is public but the data is not: every
table is restricted to a named list of founder emails (see below), so anyone
who reaches the page gets a login they cannot pass.

**To redeploy after a change:**

```
cd dashboard && npm run build
# then copy dist/ to dashboard/ on main and push:
git worktree add --detach /tmp/deploy origin/main
cp -r dist/. /tmp/deploy/dashboard/
cd /tmp/deploy && git add -A && git commit -m "Update dashboard build" && git push origin HEAD:main
git worktree remove /tmp/deploy
```

## Who can get in

`public.is_founder()` (migration 0003) holds the allowlist. Every table's RLS
policy calls it, so access is by email, not merely by being logged in.

**Currently allowed: `aitechpro1987@gmail.com` only.** Add the other two
founders by editing that one function and re-running it, then create their
accounts under **Authentication → Users** in the Supabase dashboard.

Verified: an authenticated user outside the list sees zero rows on every table
and is refused on insert; a listed founder reads and writes normally.

Still worth doing, though no longer load-bearing: turn off
**Authentication → Sign In / Providers → Email → "Allow new users to sign up"**,
and enable leaked-password protection (the last security-advisor warning).

## Supabase project

Already created and migrated: **agentworth-dashboard**
(`fanvuxwojwccowofshjm`, region ap-south-1, free tier).

All three migrations in `supabase/migrations/` are applied. Tables: `deals`,
`capacity_settings` (seeded with a 20 h cap), `projects`, `ledger_entries`,
`checklist_steps`. RLS is on everywhere with one policy per table, gated on
`public.is_founder()`. Verified: anonymous callers get zero rows on read and
401 on insert.

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
