# Agentworth internal dashboard

Internal-only dashboard for the three founders. Not client facing, not linked
from the marketing site at the repo root.

Stack: React + Vite + TypeScript + Tailwind, Supabase for data and auth,
deployed as a static build.

## Screens

| # | Screen | Status |
|---|--------|--------|
| 1 | Pipeline — deals by stage, duplicate-company warning, value per owner | built |
| 2 | Capacity — weekly hours cap vs committed, earliest free week | built |
| 3 | Ledger | schema only |
| 4 | Setup checklist | schema only |
| 5 | Weekly numbers | schema only |

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor (or
   `supabase db push` if you use the CLI).
3. Create the three users by hand in **Authentication → Users**. There is no
   sign-up flow: anyone with a login sees and edits everything.
4. Copy `.env.example` to `.env` and fill in the project URL and anon key.

```
npm install
npm run dev      # local
npm run build    # static build into dist/
```

`vite.config.ts` uses a relative `base`, so `dist/` works from the domain root
or from a subpath. Routing is hash-based for the same reason — no server
rewrite rules needed.

## Things worth knowing

- **Duplicate companies.** Detected on a normalised name (trimmed, lowercased,
  stored as the generated `company_key` column). Deals in `Lost` are ignored —
  a dead deal is not a collision. The warning shows on the board, on the
  affected cards, and live in the deal form before you save.
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
