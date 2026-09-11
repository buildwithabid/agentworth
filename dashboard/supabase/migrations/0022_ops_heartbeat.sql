-- Recorded after the fact: applied live on 2026-09-10 as ops_heartbeat
-- (20260910072432), between 0019 and 0020.
-- The statement below is verbatim from supabase_migrations.schema_migrations.

-- The VPS's proof of life, written somewhere the VPS does not control.
--
-- Every other monitor Abid has runs ON the box it monitors, so the thing that
-- would report a dead box dies with it. This row is updated by the sweep every
-- 20 minutes; an external checker reads it and raises the alarm when it goes
-- stale. Supabase is the right home: it is already reachable from both sides
-- and it is not the VPS.
create table public.heartbeat (
  id          integer primary key default 1 check (id = 1),
  beat_at     timestamptz not null default now(),
  host        text,
  detail      jsonb,
  constraint heartbeat_singleton check (id = 1)
);

insert into public.heartbeat (id, host, detail)
values (1, 'vmi3524045', '{"note":"created 2026-09-10"}'::jsonb);

alter table public.heartbeat enable row level security;
create policy heartbeat_read  on public.heartbeat for select using (public.is_member());
create policy heartbeat_write on public.heartbeat for all
  using (public.is_admin()) with check (public.is_admin());

comment on table public.heartbeat is
  'Updated by the VPS sweep every 20 minutes. If beat_at is older than about an hour the box, its network, or its timers are down — and nothing on the box itself can tell anyone, because the WhatsApp bridge that sends alerts lives there too.';
