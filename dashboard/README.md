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
| Checklist | The setup plan, one named owner per line |
| Documents | Shared private file store for all three |
| Weekly | The Monday meeting on one screen |
| Team | Roles (admin only) |

## Supabase project

**agentworth-dashboard** (`fanvuxwojwccowofshjm`, ap-south-1, free tier). All
migrations in `supabase/migrations/` are applied.

## Accounts

Three accounts exist: Abid (admin), Ikhtisham and Rehbar (sales).

**Sign-up is invite-only, enforced by the database.** An address that is not on
`public.allowed_signups` cannot create an account by any route — the trigger on
`auth.users` refuses the insert, so it holds even from the Supabase console and
even if the dashboard's sign-up toggle is switched on. Manage the list on the
Team screen.

**Adding someone:** invite the address on the Team screen, then create the
account in the Supabase dashboard under Authentication → Users with **Auto
Confirm User** ticked. They land as `pending`, which grants nothing anywhere,
until Abid assigns a role.

**Removing someone:** set them back to `pending` on the Team screen. They are
locked out immediately and nothing they entered is deleted.

Do not delete the auth user instead. `deals.owner_id` is `on delete restrict`,
so the delete fails while they still own any deal — deliberately, because
clause 7 makes the leads the business's. Reassign the deals first if you really
mean to remove the account.

**The founding admin** is bootstrapped by email in `public.handle_new_user()`.
If that address ever changes, edit the function.

Public sign-up is closed at the database, so the dashboard toggle is belt and
braces rather than the control. Still worth enabling leaked-password protection
under Authentication → Policies.

Supabase's security advisor is clean except for two entries, both understood:
leaked-password protection (the toggle above), and `my_role()` being callable
by signed-in users. The second is deliberate — RLS policies are evaluated as
the caller, so `authenticated` must hold EXECUTE on it; the function takes no
arguments and returns the caller's own role. Every trigger function has had
EXECUTE revoked so none of them are reachable over the REST API.

## The checklist

The plan's 19 steps became 23 rows, because three of them are per-person by
the plan's own wording and were split so each founder has their own line:

- **03a/b/c** — each founder gets their own NTN with their own CNIC
- **05a/b** — one close each, one per sales founder
- **16a/b** — same lead channel, one row per founder's list

Every row has exactly one named owner. As seeded that is Abid on 17 and the
sales founders on 3 each — which is what the plan actually distributes:
registration, tax, banking, contracts, capacity and the filing calendar
(clause 10 names him) are all his. If you want that shared differently, the
owner is a dropdown on each step.

**Step 01 is already ticked.** The founders' agreement is signed and dated
01/09/2026 and clause 4 carries the four-year vesting with a one-year cliff,
which is exactly its done-when. Untick it if you disagree.

## Documents

A private Supabase Storage bucket, 25 MB per file, shared with all three of
you. Anyone on the team can upload and everyone sees everything — the same
principle clause 6 applies to the money. Deleting is narrower: your own
uploads, or Abid, so the signed agreement cannot be removed by accident.

Files are stored under `<uuid>/<original name>`, so two people uploading
`scan.pdf` do not collide and the name you chose survives. Nothing is
reachable by URL: opening a file mints a signed link that expires after two
minutes.

## Admin powers

The Team screen gives the admin:

- **The invite list** — who may hold an account at all. Removing an address
  stops future registration; it does not touch an existing account.
- **Roles** — `pending` is the immediate revoke. They keep an account and can
  still sign in, but every table refuses them from that moment and they see the
  "no access yet" screen. Nothing they entered is deleted.
- **Pipeline handover** — move every deal someone owns to another founder in one
  action. Clause 7 makes leads the business's, so a departure hands them on
  rather than losing them.

**Two things deliberately not in the browser:** setting someone's password and
deleting an account outright. Both need the service-role key, which must never
ship in a bundle. `supabase/functions/admin-users/` holds a deployable Edge
Function that does them safely — it reads the caller's own JWT, checks their
role in the database, and refuses anyone who is not an admin. It is **not
deployed**; until it is, use Authentication → Users in the Supabase console.

## Interface

- **Dark mode** follows the system by default, with a toggle in the sidebar that
  overrides it either way. The choice is remembered per browser and applied
  before first paint, so a dark-mode user never sees a light flash.
- **Layout** is a fixed sidebar on desktop and a scrolling tab strip on phones.
  Both navs exist in the DOM; CSS hides one, so only one reaches assistive tech.
- **Icons** are hand-authored inline SVG in `components/icons.tsx` — eight nav
  marks and a dozen interface ones do not justify a dependency, and they inherit
  `currentColor` so they follow the theme with no extra rules.
- **Colour is token-only.** Every surface and text colour comes from a custom
  property defined in `index.css`; nothing is hardcoded, which is what makes the
  dark palette a single block rather than a sweep through the components.
- **Screens are code-split.** Opening the Monday meeting does not download the
  ledger's code. Initial JS is about 122 KB gzipped, each screen 2–4 KB on top.
- **A render error shows a recovery screen**, not a blank page, and says plainly
  that nothing entered was lost.

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
