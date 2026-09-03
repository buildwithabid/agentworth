-- Covering indexes for the foreign keys the performance advisor flagged.
-- Without them, deleting or updating a referenced profile scans the child
-- table, and the joins these columns feed (uploader, approver, author) go
-- unindexed.
create index if not exists checklist_steps_owner_id_idx   on public.checklist_steps (owner_id);
create index if not exists deals_created_by_idx           on public.deals (created_by);
create index if not exists ledger_entries_created_by_idx  on public.ledger_entries (created_by);
create index if not exists ledger_entries_approved_by_idx on public.ledger_entries (approved_by);
create index if not exists tasks_created_by_idx           on public.tasks (created_by);
