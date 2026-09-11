-- Recorded after the fact: applied live on 2026-09-06 as
-- archive_checklist_and_tasks_20260906 (20260906063709), between 0011 and 0012.
-- The statement below is verbatim from supabase_migrations.schema_migrations.

-- Abid asked (6 Sept 2026) for the setup checklist and the seeded to-do tasks to be removed
-- from the dashboard. Copies are kept here, in the same database, in case anything is wanted back.
create schema if not exists archive;
create table archive.checklist_steps_20260906 as select * from public.checklist_steps;
create table archive.tasks_20260906 as select * from public.tasks;
revoke all on schema archive from anon, authenticated;
