-- A handover file must name the mailbox each email goes from, and the sequence
-- caps email at 40 per mailbox per day. Neither was possible: drafts never
-- recorded who sends them, so every handover said "your own mailbox" and
-- release_batch applied the cap to all three mailboxes together. Null for
-- LinkedIn and call drafts, which do not go from a mailbox.
alter table public.drafts add column mailbox text;
