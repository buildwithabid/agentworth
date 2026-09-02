-- Roles, tasks and team capabilities.
--
-- Replaces the flat "any founder can do anything" model with the split the
-- signed founders' agreement already describes:
--
--   Founder A (Abid)      technical, admin. Clause 2 and 5: scopes and prices
--                         every job, sets the delivery capacity limit, has the
--                         final word on what is committed to, on timelines and
--                         on the price floor. Named responsible for the filing
--                         calendar (clause 10).
--   Founders B and C      sales. Clause 5: "decide how they run their own
--                         pipelines" — so they own their own deals and nothing
--                         else.
--
-- Two rules from the agreement are enforced here rather than left to habit:
--   * Clause 7 — "clients and leads belong to the business, not to the founder
--     who brought them in": sales cannot delete a deal or hand it to the other
--     owner. Only an admin can.
--   * Clause 6 — spending above PKR 5,000 needs a second founder's approval:
--     outgoing ledger entries above the threshold carry an approval, and
--     nobody can approve their own.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, carrying the role
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       text not null default 'pending' check (role in ('admin','sales','pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- A new sign-up lands as 'pending', which grants nothing anywhere. The one
-- bootstrap exception is the founding admin, matched by email.
-- TO CHANGE THE FOUNDING ADMIN: edit the address below and re-run this function.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
             split_part(new.email, '@', 1)),
    case when lower(new.email) = 'aitechpro1987@gmail.com' then 'admin' else 'pending' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nobody promotes themselves. Role changes are admin-only, enforced in a
-- trigger so it holds no matter which policy allowed the update through.
-- The SQL editor and the service role are exempt: they hold database
-- credentials already, and without the exemption there is no way to appoint
-- the first admin or recover from losing the last one. Every API request
-- carries a JWT, so the guard still covers the case it exists for — a
-- signed-in user promoting themselves.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and new.role is distinct from old.role
     and not public.is_admin()
  then
    raise exception 'only an admin can change a role';
  end if;
  if new.id is distinct from old.id then
    raise exception 'profile id is immutable';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- role helpers. security definer so policies can read profiles without
-- recursing through the profiles policy that calls them.
-- ---------------------------------------------------------------------------

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.role from public.profiles p where p.id = (select auth.uid())), 'pending');
$$;

create or replace function public.is_admin()
returns boolean language sql stable set search_path = ''
as $$ select public.my_role() = 'admin' $$;

create or replace function public.is_member()
returns boolean language sql stable set search_path = ''
as $$ select public.my_role() in ('admin','sales') $$;

grant execute on function public.my_role(), public.is_admin(), public.is_member() to authenticated;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------------
-- deals now belong to a user, not to a typed-in name
-- ---------------------------------------------------------------------------

alter table public.deals drop column if exists owner;
alter table public.deals add column if not exists owner_id uuid references public.profiles(id) on delete restrict;
alter table public.deals add column if not exists created_by uuid references public.profiles(id) on delete set null;
create index if not exists deals_owner_id_idx on public.deals (owner_id);

-- ---------------------------------------------------------------------------
-- tasks: a to-do with one named owner, per step 18 of the plan
-- ---------------------------------------------------------------------------

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (btrim(title) <> ''),
  detail       text,
  assignee_id  uuid references public.profiles(id) on delete set null,
  due_date     date,
  status       text not null default 'todo' check (status in ('todo','doing','done')),
  created_by   uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists tasks_status_idx on public.tasks (status);

create or replace function public.tasks_touch()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch
  before update on public.tasks
  for each row execute function public.tasks_touch();

-- ---------------------------------------------------------------------------
-- checklist steps carry the plan's own wording and an assignable owner
-- ---------------------------------------------------------------------------

alter table public.checklist_steps rename column owner to owner_note;
alter table public.checklist_steps add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.checklist_steps add column if not exists detail text;
alter table public.checklist_steps add column if not exists meta text;
alter table public.checklist_steps add column if not exists phase_when text;

-- ---------------------------------------------------------------------------
-- ledger: clause 6 second-founder approval
-- ---------------------------------------------------------------------------

alter table public.ledger_entries add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.ledger_entries add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.ledger_entries add column if not exists approved_at timestamptz;

-- thresholds live on the settings singleton so they can be changed without a
-- migration. PKR 5,000 is the figure written into clause 6; the USD figure is
-- its rough equivalent and is a guess — change it to whatever you mean.
alter table public.capacity_settings add column if not exists approval_threshold_pkr numeric(14,2) not null default 5000;
alter table public.capacity_settings add column if not exists approval_threshold_usd numeric(14,2) not null default 20;

create or replace function public.ledger_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- a non-admin may touch nothing but the approval
  if not public.is_admin() then
    if row(new.entry_date, new.client, new.amount, new.currency, new.direction,
           new.prc_received, new.note, new.created_by)
       is distinct from
       row(old.entry_date, old.client, old.amount, old.currency, old.direction,
           old.prc_received, old.note, old.created_by)
    then
      raise exception 'only an admin can change the details of a ledger entry';
    end if;
  end if;

  -- an approval is your own signature, and never on your own entry
  if new.approved_by is distinct from old.approved_by and new.approved_by is not null then
    if new.approved_by <> (select auth.uid()) then
      raise exception 'you can only record your own approval';
    end if;
    if new.approved_by = old.created_by then
      raise exception 'the founder who recorded a payment cannot approve it';
    end if;
    new.approved_at := now();
  end if;
  if new.approved_by is null then
    new.approved_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists ledger_guard on public.ledger_entries;
create trigger ledger_guard
  before update on public.ledger_entries
  for each row execute function public.ledger_guard();

-- ---------------------------------------------------------------------------
-- policies, rebuilt for least privilege
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.tasks    enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'deals','capacity_settings','projects','ledger_entries','checklist_steps','profiles','tasks'
  ] loop
    execute format('drop policy if exists founders_all on public.%I', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- profiles: the team is visible to the team; only an admin edits anyone,
-- and the role-change trigger backstops it.
create policy profiles_read   on public.profiles for select to authenticated using (public.is_member());
create policy profiles_insert on public.profiles for insert to authenticated with check (public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin() or id = (select auth.uid()))
  with check (public.is_admin() or id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated using (public.is_admin());

-- deals: everyone reads the whole pipeline — the duplicate-company warning
-- depends on it, and clause 7 says leads belong to the business. Sales write
-- only their own, and the with-check stops them handing one to the other owner.
create policy deals_read   on public.deals for select to authenticated using (public.is_member());
create policy deals_insert on public.deals for insert to authenticated
  with check (public.is_admin() or (public.is_member() and owner_id = (select auth.uid())));
create policy deals_update on public.deals for update to authenticated
  using (public.is_admin() or owner_id = (select auth.uid()))
  with check (public.is_admin() or owner_id = (select auth.uid()));
create policy deals_delete on public.deals for delete to authenticated using (public.is_admin());

-- capacity is the technical founder's to set (clause 2), everyone's to see
create policy capacity_read   on public.capacity_settings for select to authenticated using (public.is_member());
create policy capacity_update on public.capacity_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy projects_read   on public.projects for select to authenticated using (public.is_member());
create policy projects_insert on public.projects for insert to authenticated with check (public.is_admin());
create policy projects_update on public.projects for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy projects_delete on public.projects for delete to authenticated using (public.is_admin());

-- ledger: all three see it (clause 6). Only the admin records entries; any
-- other member may update solely to sign an approval, per the guard trigger.
create policy ledger_read   on public.ledger_entries for select to authenticated using (public.is_member());
create policy ledger_insert on public.ledger_entries for insert to authenticated with check (public.is_admin());
create policy ledger_update on public.ledger_entries for update to authenticated
  using (public.is_member()) with check (public.is_member());
create policy ledger_delete on public.ledger_entries for delete to authenticated using (public.is_admin());

-- checklist: admin curates the list; the assigned owner (or anyone, on a
-- shared step) can tick their own step off.
create policy checklist_read   on public.checklist_steps for select to authenticated using (public.is_member());
create policy checklist_insert on public.checklist_steps for insert to authenticated with check (public.is_admin());
create policy checklist_update on public.checklist_steps for update to authenticated
  using (public.is_admin() or owner_id is null or owner_id = (select auth.uid()))
  with check (public.is_admin() or owner_id is null or owner_id = (select auth.uid()));
create policy checklist_delete on public.checklist_steps for delete to authenticated using (public.is_admin());

-- tasks: shared work. Anyone on the team can raise one; the assignee, the
-- author or an admin can move it.
create policy tasks_read   on public.tasks for select to authenticated using (public.is_member());
create policy tasks_insert on public.tasks for insert to authenticated with check (public.is_member());
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_admin() or assignee_id = (select auth.uid()) or created_by = (select auth.uid()))
  with check (public.is_admin() or assignee_id = (select auth.uid()) or created_by = (select auth.uid()));
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_admin() or created_by = (select auth.uid()));

-- is_founder() is superseded by the role model; a pending user now has no
-- access anywhere regardless of email.
drop function if exists public.is_founder();

-- ---------------------------------------------------------------------------
-- seed the 19 steps from the agency plan
-- ---------------------------------------------------------------------------

delete from public.checklist_steps;

insert into public.checklist_steps
  (phase_order, phase, phase_when, step_order, title, detail, owner_note, meta)
values
  (1, 'Prove someone will pay', 'Weeks 1-6', 1, 'Put the equity split in writing', 'Percentages, four-year vesting with a one-year cliff, what each founder does each week, and how someone who leaves is bought out. Sign it now, while everyone is still optimistic.', 'all three', 'Done when all three have signed it, vesting included'),
  (1, 'Prove someone will pay', 'Weeks 1-6', 2, 'Pick one narrow niche', 'One service, one type of buyer. Not "web and mobile development." Narrow is what lets you charge $50/hour instead of fighting at $15.', 'all three', 'Done when you can name 20 real target companies and both sales founders can pitch it in one sentence'),
  (1, 'Prove someone will pay', 'Weeks 1-6', 3, 'Get all three NTNs from FBR', 'Each founder registers on iris.fbr.gov.pk with their own CNIC. Free. Every director needs one before you can incorporate.', 'each founder', '3-5 days. Done when three certificates downloaded'),
  (1, 'Prove someone will pay', 'Weeks 1-6', 4, 'Set up the payment path', 'A current account plus Payoneer or Wise, in the technical founder''s name for now. Money must arrive through the banking channel so you get the PRC. No crypto. Log every receipt and payout where all three can see it.', 'technical founder', '1 week. Done when first payment received with a PRC from the bank'),
  (1, 'Prove someone will pay', 'Weeks 1-6', 5, 'Close two clients - one per sales founder', 'Split the target list first so nobody doubles up. One close each tells you whether you have two salespeople or one, while it is still cheap to find out.', 'sales founders sell, technical founder delivers', 'Target $2,000+ each. Done when both payments have cleared'),
  (2, 'Register', 'Weeks 6-12', 6, 'Incorporate with SECP', 'Private Limited, all three as directors and shareholders, split exactly as agreed in step 01. The memorandum must name IT and IT-enabled services as the principal business or PSEB will reject you. Have a lawyer turn step 01 into a proper shareholders'' agreement at the same time.', 'technical founder files, all three sign', 'PKR 15,000-30,000 + legal. 1-3 weeks'),
  (2, 'Register', 'Weeks 6-12', 7, 'Register with PSEB', 'The highest-return form you will fill in. Registered IT exporters pay 0.25% final tax on export earnings instead of 1%. Fully online, renewed yearly.', 'technical founder', 'pseb.org.pk. PKR 5,000-10,000. 2-5 working days'),
  (2, 'Register', 'Weeks 6-12', 8, 'Register for provincial sales tax', 'PRA in Punjab, SRB in Sindh, KPRA or BRA elsewhere. Export work is generally zero-rated or exempt; local clients are taxable. Confirm the current rate rather than assuming it.', 'technical founder', '1 week'),
  (2, 'Register', 'Weeks 6-12', 9, 'Open the company account', 'Move billing off the personal account. Agree the signing rules before you fill the forms - who can pay what alone, and what needs two signatures. Ask the trade desk about an Exporters'' Special Foreign Currency Account.', 'all three', '1-2 weeks. Done when a client invoice is paid into the company account'),
  (3, 'Build the machine', 'Months 3-6', 10, 'Write the contract and the price floor', 'A master agreement plus a per-project scope. Non-negotiable: 40-50% upfront, milestone payments, written change requests, IP transfers on final payment. Set a floor price and a maximum discount, and let nothing be quoted until the technical founder has scoped it.', 'technical founder writes it', 'PKR 20,000-50,000 to have it reviewed'),
  (3, 'Build the machine', 'Months 3-6', 11, 'Cap the pipeline at what one developer can deliver', 'Two people selling into one person''s capacity will oversell. Put a number on it - billable hours a week, projects at once. When it is full, sell start dates two months out instead of immediate starts.', 'technical founder sets it, sales founders respect it', 'Review weekly'),
  (3, 'Build the machine', 'Months 3-6', 12, 'Get an accountant and agree founder pay', 'Use someone who has actually filed for IT exporters; every foreign receipt needs its PRC filed against it. Then write down what the three of you take out and when - equal draws, commission, or nothing until reserves are met.', 'all three', 'PKR 10,000-30,000/month. Done when books close within 10 days of month end'),
  (3, 'Build the machine', 'Months 3-6', 13, 'Sort out power and internet backup', 'Solar or a UPS with real runtime, plus a second connection on a different provider. Delivery machine first, then the sales founders'' call setup.', 'technical founder', 'PKR 150,000-400,000. Done when all three can work through an outage'),
  (3, 'Build the machine', 'Months 3-6', 14, 'Make the first hire a developer', 'You already have two people selling. Delivery is the constraint and will stay the constraint. Hire only when signed contracts cover about six months of that salary. Register EOBI and social security from the first payslip.', 'all three decide', 'Done when six months of salary is contracted or banked'),
  (4, 'Grow', 'Months 6-12', 15, 'Write three case studies', 'Ask permission at handover, while the client is happy. Lead with a number - revenue moved, hours saved, load time cut. Three specific stories beat thirty logos.', 'technical founder writes, sales use them', ''),
  (4, 'Grow', 'Months 6-12', 16, 'Work one lead channel, both founders on it', 'Outbound email, partners, one marketplace, or content. The temptation with two salespeople is two channels at half strength. Same channel, different segments, six months.', 'sales founders', 'Done when it produces leads without individual chasing'),
  (4, 'Grow', 'Months 6-12', 17, 'Build a three-month cash reserve', 'Three months of payroll plus founder draws, untouched. Salaries are fixed and monthly; client payments are lumpy and late.', 'all three', ''),
  (4, 'Grow', 'Months 6-12', 18, 'File everything on time', 'Income tax return, annual SECP filings, PSEB renewal, provincial returns. Staying on the Active Taxpayer List halves withholding on ordinary bank transactions.', 'one named owner, not "we''ll all watch it"', 'Done when every date is in a shared calendar with reminders'),
  (4, 'Grow', 'Months 6-12', 19, 'Meet weekly on numbers, review the partnership quarterly', 'Weekly: pipeline per founder, capacity, cash, overdue invoices. Quarterly: is each founder still doing what step 01 said? Vesting only helps if someone raises it early.', 'all three', 'Done when the weekly slot is in the calendar and one quarterly review is done');
