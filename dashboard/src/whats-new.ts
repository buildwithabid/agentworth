/**
 * What changed in the dashboard, in plain language, newest first.
 * Add a line here in the same change that ships the feature.
 */
export type Entry = { date: string; title: string; body: string }

export const WHATS_NEW: Entry[] = [
  {
    date: '2026-09-07',
    title: "What's new",
    body: 'This screen. Every change to the dashboard that affects how you use it is listed here, newest first.',
  },
  {
    date: '2026-09-06',
    title: 'Checklist and seeded tasks retired',
    body: 'The onboarding checklist and the pre-filled to-do list were removed. The Pipeline is the working surface: every call and reply is logged there the same day.',
  },
  {
    date: '2026-09-06',
    title: 'Target lists A and B delivered',
    body: 'Ikhtisham has List A and Rehbar has List B: 393 verified UK accountancy firms with switchboard numbers, websites and an opening line each. They live in your inbox, not in the dashboard yet.',
  },
  {
    date: '2026-09-03',
    title: 'Invite-only sign-up and admin controls',
    body: 'New accounts can only be created by invitation. The admin can approve, pause and remove team members from the Team screen.',
  },
  {
    date: '2026-09-03',
    title: 'Dark mode and a faster app',
    body: 'A light/dark switch in the sidebar, and each screen loads on its own so the app opens faster.',
  },
  {
    date: '2026-09-02',
    title: 'Dashboard launched',
    body: 'Pipeline, Capacity, Ledger and Weekly numbers, with roles from the founders agreement: Abid sets what gets committed to build, sales owns the pipeline.',
  },
]
