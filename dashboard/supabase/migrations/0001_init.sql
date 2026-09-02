-- Agentworth internal dashboard — initial schema
--
-- Three fixed users (Abid, Ikhtisham, Rehbar). There are no roles: anyone who
-- is logged in can read and write everything. Users are created by hand in the
-- Supabase dashboard (Authentication > Users); there is no sign-up flow.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. deals  (screen: Pipeline)
-- ---------------------------------------------------------------------------

create table if not exists public.deals (
  id               uuid primary key default gen_random_uuid(),
  company          text not null check (btrim(company) <> ''),
  -- normalised name, used to detect the same company worked by both owners
  company_key      text generated always as (lower(btrim(company))) stored,
  owner            text not null check (owner in ('Ikhtisham', 'Rehbar')),
  stage            text not null default 'Lead'
                     check (stage in ('Lead','Contacted','Scoped','Proposal','Won','Lost')),
  value_usd        numeric(12,2) not null default 0 check (value_usd >= 0),
  next_action      text,
  next_action_date date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- when the deal last changed stage; drives "deals moved this week"
  stage_changed_at timestamptz not null default now()
);

create index if not exists deals_company_key_idx on public.deals (company_key);
create index if not exists deals_stage_idx on public.deals (stage);
create index if not exists deals_owner_idx on public.deals (owner);

create or replace function public.deals_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists deals_touch on public.deals;
create trigger deals_touch
  before update on public.deals
  for each row execute function public.deals_touch();

-- ---------------------------------------------------------------------------
-- 2. capacity  (screen: Capacity)
-- ---------------------------------------------------------------------------

-- Single row. Abid's weekly billable-hours cap.
create table if not exists public.capacity_settings (
  id                integer primary key default 1 check (id = 1),
  weekly_hours_cap  numeric(5,1) not null default 20 check (weekly_hours_cap >= 0),
  updated_at        timestamptz not null default now()
);

insert into public.capacity_settings (id, weekly_hours_cap)
values (1, 20)
on conflict (id) do nothing;

drop trigger if exists capacity_settings_touch on public.capacity_settings;
create trigger capacity_settings_touch
  before update on public.capacity_settings
  for each row execute function public.set_updated_at();

create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (btrim(name) <> ''),
  client              text,
  est_hours_per_week  numeric(5,1) not null default 0 check (est_hours_per_week >= 0),
  start_date          date not null default current_date,
  -- null = open-ended, i.e. this capacity never frees up on its own
  end_date            date,
  status              text not null default 'active' check (status in ('active','done')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint projects_dates_ordered check (end_date is null or end_date >= start_date)
);

create index if not exists projects_status_idx on public.projects (status);

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. ledger  (screen: Ledger)
-- ---------------------------------------------------------------------------

-- Money lands in Abid's personal account; all three founders see these rows.
-- amount is always positive, direction carries the sign.
create table if not exists public.ledger_entries (
  id            uuid primary key default gen_random_uuid(),
  entry_date    date not null default current_date,
  client        text,
  amount        numeric(14,2) not null check (amount > 0),
  currency      text not null check (currency in ('USD','PKR')),
  direction     text not null check (direction in ('in','out')),
  prc_received  boolean not null default false,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ledger_entries_date_idx on public.ledger_entries (entry_date);

drop trigger if exists ledger_entries_touch on public.ledger_entries;
create trigger ledger_entries_touch
  before update on public.ledger_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. setup checklist  (screen: Setup checklist)
-- ---------------------------------------------------------------------------

-- Steps live here, not in code. Rows are inserted once the step list is agreed;
-- phase_order / step_order control display order and are editable.
create table if not exists public.checklist_steps (
  id             uuid primary key default gen_random_uuid(),
  phase          text not null,
  phase_order    integer not null default 1,
  step_order     integer not null default 1,
  title          text not null check (btrim(title) <> ''),
  owner          text,
  done           boolean not null default false,
  completed_date date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists checklist_steps_order_idx
  on public.checklist_steps (phase_order, step_order);

drop trigger if exists checklist_steps_touch on public.checklist_steps;
create trigger checklist_steps_touch
  before update on public.checklist_steps
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- access: logged in = full access, everyone else = nothing
-- ---------------------------------------------------------------------------

alter table public.deals             enable row level security;
alter table public.capacity_settings enable row level security;
alter table public.projects          enable row level security;
alter table public.ledger_entries    enable row level security;
alter table public.checklist_steps   enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'deals','capacity_settings','projects','ledger_entries','checklist_steps'
  ] loop
    execute format('drop policy if exists founders_all on public.%I', t);
    execute format(
      'create policy founders_all on public.%I for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

grant usage on schema public to authenticated;
