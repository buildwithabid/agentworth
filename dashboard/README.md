# Agentworth internal dashboard

Internal-only dashboard for the three founders. Not client facing, not linked
from the marketing site at the repo root.

Stack: React + Vite + TypeScript + Tailwind, Supabase for data and auth,
deployed as a static build.

## Live at https://agentworth.co/dashboard/

Published from `main` as part of the existing GitHub Pages site. The marketing
page at the root is untouched.

**To redeploy after a change:**

```
cd dashboard && npm run build
git worktree add --detach /tmp/deploy origin/main
cp -r dist/. /tmp/deploy/dashboard/
cd /tmp/deploy && git add -A && git commit -m "Update dashboard build" && git push origin HEAD:main
git worktree remove /tmp/deploy
```

## Who can do what

Two roles, taken from the signed founders' agreement rather than invented:

| | admin (Abid) | sales (Ikhtisham, Rehbar) | pending |
|---|---|---|---|
| Pipeline | every deal | reads all, writes only their own | nothing |
| Deal delete / reassign | yes | **no** | no |
| Capacity cap & projects | sets them | read only | no |
| Ledger | records entries | reads, and signs second approvals | no |
| Checklist | edits the list | ticks their own and shared steps | no |
| Tasks | anything | raises any, moves their own or ones they raised | no |
| Team & roles | yes | no | no |

Why those lines, specifically:

- **Clause 2 and 5** — the technical founder "sets the price and the delivery
  capacity limit" and has "the final word on what we commit to build, on
  timelines and on the price floor". So the cap and the project list are
  admin-only; sales see them and work to them.
- **Clause 5** — founders B and C "decide how they run their own pipelines".
  So sales own their own deals outright, and cannot touch the other one's.
- **Clause 7** — "clients and leads belong to the business, not to the founder
  who brought them in". So a sales founder cannot delete a deal or hand it to
  the other owner; only an admin can. This matters most on the day someone
  leaves (clause 8 handover).
- **Clause 6** — spending above PKR 5,000 needs a second founder's approval.
  Outgoing ledger entries above the threshold show as needing approval, and
  **nobody can approve an entry they recorded themselves**, admin included.
  Thresholds are on the settings row and editable; the USD figure is a rough
  equivalent, not a converted rate — change it to whatever you actually mean.

Everyone reads the whole pipeline. That is deliberate: the duplicate-company
warning cannot work otherwise, and clause 7 says the leads are the business's.

Permissions are enforced by Postgres row-level security, not by hiding buttons.
Hiding a button is a courtesy; the policy is the control. Verified by signing in
as each role and by exercising the policies directly.

## Screens

| Screen | What it is for |
|---|---|
| Pipeline | Deals by stage, duplicate-company warning, value per owner |
| Capacity | Weekly hours cap vs committed, earliest free week |
| Tasks | To-dos with one named owner and a due date |
| Ledger | Money in and out, PRC tracking, clause 6 approvals |
| Checklist | The 19-step setup plan, in the database and editable |
| Weekly | The Monday meeting on one screen |
| Team | Roles (admin only) |

## Supabase project

**agentworth-dashboard** (`fanvuxwojwccowofshjm`, ap-south-1, free tier). All
migrations in `supabase/migrations/` are applied.

## Accounts

Three accounts exist: Abid (admin), Ikhtisham and Rehbar (sales).

**Adding someone:** create the account in the Supabase dashboard under
Authentication → Users with **Auto Confirm User** ticked. A trigger gives them a
`pending` profile, which grants nothing anywhere. Abid then assigns a role on
the Team screen.

**Removing someone:** set them back to `pending` on the Team screen. They are
locked out immediately and nothing they entered is deleted.

**The founding admin** is bootstrapped by email in `public.handle_new_user()`.
If that address ever changes, edit the function.

Worth doing in the Supabase dashboard: turn off Authentication → Sign In /
Providers → Email → "Allow new users to sign up", and enable leaked-password
protection. Neither is load-bearing now — a stray sign-up lands as `pending`
with no access — but both are free.

## Things worth knowing

- **Duplicate companies** are matched on a normalised name (the generated
  `company_key` column), so `"  northgate ACCOUNTANTS "` collides with
  `"Northgate Accountants"`. Lost deals are ignored — a dead deal is not a
  collision.
- **Pipeline value.** "Open" means Lead, Contacted, Scoped, Proposal. Won is
  reported separately; Lost is not counted.
- **Capacity.** A project consumes its hours in every week between its start
  and end dates. No end date means the hours are held forever and free capacity
  never appears — deliberate, so put an end date on anything meant to finish.
- **Earliest free week** looks 26 weeks ahead and says so plainly when nothing
  is free, rather than guessing.
- **Ledger balances are per currency.** USD and PKR are never added together.
- **PRC flag** turns red on incoming payments older than 30 days without one.

## Running it locally

```
cp .env.example .env
npm install
npm run dev
npm run build
```
