# Changelog

Agentworth marketing site (agentworth.co, GitHub Pages from `main`) and the internal dashboard at `/dashboard/`.

## 2026-09-09
- Dashboard: fixed a blank page at `/dashboard/` that had been live since 2026-09-07. The published build was made without `dashboard/.env`, so Vite inlined `undefined` for the Supabase URL and key and the app threw before rendering; Pages still served a 200, so nothing reported it. Rebuilt with the values from `.env.example`, and `dashboard/vite.config.ts` now fails the build when either variable is missing so the same bundle cannot ship again.
- Dashboard: removed 11 orphaned asset bundles left by earlier builds; `dashboard/assets/` now holds only the files the current build references.

## 2026-09-07
- Dashboard: a What's new screen (plain-language changes, newest first), fed by `dashboard/src/whats-new.ts`. Marketing page untouched.

## 2026-09-06
- Dashboard: the onboarding checklist and the seeded to-do tasks were retired (archived in the database as `archive.checklist_steps_20260906` and `archive.tasks_20260906`); the pipeline is the only working surface.
- Target lists A and B (393 verified UK accountancy firms with phone numbers and opening lines) delivered to the founders; not in the repo.

## 2026-09-05
- Marketing page made launch-ready: copy, layout, Open Graph image, site CSS.
- Repository set back to public and GitHub Pages restored after a private-repo outage took the site down for about 6.5 hours. The repo must stay public: it hosts the live site.

## 2026-09-02 to 2026-09-03
- Internal dashboard published at `/dashboard/`: roles, tasks, checklist, ledger, weekly numbers; documents and per-person checklist; dark mode, sidebar, code-split routes; invite-only sign-up and admin account controls.

## 2026-08-29 to 2026-08-30
- Single-page marketing site added; custom domain (CNAME) configured.
