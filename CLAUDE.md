# Agentworth

Two things live in this repo:

- **`/`** — the public marketing site for agentworth.co. A single hand-written
  `index.html` plus `CNAME` and `.nojekyll`, served by GitHub Pages from `main`.
  **Do not restructure it.** It is the live company site.
- **`dashboard/`** — the founders' internal dashboard. Vite + React 19 +
  TypeScript + Tailwind 4, Supabase for data, auth and storage. Deployed as a
  static build to `dashboard/` on `main`, so it serves at
  https://agentworth.co/dashboard/ without touching the marketing page.

`dashboard/README.md` is the detailed guide. This file is the short version.

## The business, because the code encodes it

Three part-time founders (20 hrs/week each), Islamabad, agentic AI services:

- **Abid Ali** — technical founder. Delivers everything. He is the capacity
  constraint, and the dashboard's main job is making that visible before the
  other two oversell it.
- **Ikhtisham Ul Haq** and **Muhammad Rehbar** — sales, working separate target
  lists (A and B) so they never approach the same buyer.

## Permission model — read this before changing any policy

Roles are `admin` (Abid) and `sales`, stored on `public.profiles` and enforced
by row-level security. **The rules are taken from the founders' agreement, not
invented.** If you change one, you are changing what the founders signed:

- **Clauses 2 and 5** — the technical founder sets the capacity limit and has
  the final word on commitments. So `capacity_settings` and `projects` are
  admin-write, member-read.
- **Clause 5** — sales "decide how they run their own pipelines". So a sales
  user writes only deals where `owner_id = auth.uid()`; the `with check` also
  stops them reassigning one away.
- **Clause 7** — leads belong to the business. So `deals` delete is admin-only,
  and everyone reads the whole pipeline (the duplicate-company check needs it).
- **Clause 6** — spending over PKR 5,000 needs a second founder. Outgoing
  `ledger_entries` above the threshold carry an approval, and `ledger_guard()`
  refuses to let anyone approve an entry they created, admin included.

A new sign-up gets a `pending` profile with access to nothing until an admin
assigns a role. Never widen a policy to `to authenticated` without a role check.

### Gotchas that already bit once

- `guard_profile_role()` exempts callers with no JWT (SQL editor, service role).
  Without that there is no way to appoint the first admin.
- Postgres grants `EXECUTE` on new functions to PUBLIC and PostgREST publishes
  them at `/rest/v1/rpc/<name>`. **Revoke it on every new trigger function**
  (migration 0006 does this for the existing ones). Triggers fire regardless.
- `my_role()` is `security definer` and keeps `EXECUTE` for `authenticated` on
  purpose: RLS expressions are evaluated as the caller. The advisor flags it;
  that is expected.

## Conventions

- Money: USD and PKR are **never summed**. There is no exchange rate anywhere.
- Dates are `YYYY-MM-DD` strings compared lexicographically; `parseDate()` reads
  them at local midday so time zones cannot shift a day.
- Capacity: a project consumes its hours every week between `start_date` and
  `end_date`. A null end date holds them forever and free capacity never
  appears — deliberate.
- Checklist rows carry `sub_label` (`a`/`b`/`c`) where one plan step was split
  per founder. Display is `03a`, `05b`.
- Permissions are shown as well as enforced: disable a control with a
  `disabledReason` rather than letting the write fail with a raw policy error.

## Working on it

```
cd dashboard
npm install
npm run dev
npm run build        # tsc -b && vite build
```

`.env` is gitignored; `.env.example` holds the real project URL and the
publishable key (not a secret — it ships in the bundle).

Migrations are applied to the live project already. Add new ones as
`supabase/migrations/NNNN_name.sql` **and** apply them; keep the two in step.
Run the Supabase security advisor after any schema change.

Redeploy after a change:

```
cd dashboard && npm run build
git worktree add --detach /tmp/deploy origin/main
cp -r dist/. /tmp/deploy/dashboard/
cd /tmp/deploy && git add -A && git commit -m "Update dashboard build"
git push origin HEAD:main
git worktree remove /tmp/deploy
```

## Out of scope

The founders excluded these explicitly: invoicing, time tracking, a
client-facing portal, email or notifications, and charts beyond simple bars.
Don't add them.
