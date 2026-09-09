-- The outreach funnel: the 393 verified firms, every touch, the TPS/CTPS
-- screening lifecycle, and the suppression list.
--
-- Two rules are enforced here in Postgres rather than in the tool layer,
-- because a tool can be bypassed and a trigger cannot:
--   1. no outbound touch against a suppressed firm;
--   2. no call touch without a screening that is Clear and unexpired.
-- Screening expiry is a generated column, not a stored flag, because a stored
-- status silently rots at 28 days and that is how a PECR reg. 21 breach gets
-- built out of a dropdown.

create table public.targets (
  company_number      text primary key,
  name                text not null,
  display             text not null,
  firm_type           text not null default 'accountancy',
  region              text,
  town                text,
  postcode            text,
  phone               text,
  phone_e164          text,
  phone_type          text,
  website             text,
  domain              text,
  email               text,
  size_band           text,
  incorporated_year   int,
  -- crawl outcome, not contact state: contact state is derived from touches.
  crawl_result        text not null default 'verified'
                        check (crawl_result in ('verified','miss')),
  miss_reason         text check (miss_reason in
                        ('no_candidate_resolved','fetch_error','no_confirmation','unknown_legacy')),
  list_name           text check (list_name in ('A','B')),
  owner_id            uuid references public.profiles(id) on delete set null,
  opening_line        text,
  opening_line_basis  text,
  site_text           text,
  verified_by         text,
  source_url          text,
  checked_on          date,
  deal_id             uuid references public.deals(id) on delete set null,
  source_sha256       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint targets_miss_has_reason
    check (crawl_result <> 'miss' or miss_reason is not null),
  constraint targets_verified_has_list
    check (crawl_result <> 'verified' or list_name is not null)
);
create index targets_list_idx   on public.targets (list_name, region);
create index targets_domain_idx on public.targets (domain) where domain is not null;
create index targets_phone_idx  on public.targets (phone_e164) where phone_e164 is not null;
create index targets_result_idx on public.targets (crawl_result);

create trigger targets_touch before update on public.targets
  for each row execute function public.set_updated_at();

-- "Never contacted again, on any list, by anyone" — by identifier, not by row,
-- so a firm trading under two companies cannot be reached through the other.
create table public.suppressions (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('company_number','domain','phone','email')),
  value      text not null,
  reason     text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, value)
);

create or replace function public.is_suppressed(p_company_number text)
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.targets t
    join public.suppressions s
      on (s.kind = 'company_number' and s.value = t.company_number)
      or (s.kind = 'domain'         and s.value = t.domain)
      or (s.kind = 'phone'          and s.value = t.phone_e164)
      or (s.kind = 'email'          and s.value = lower(t.email))
    where t.company_number = p_company_number
  );
$$;

-- TPS/CTPS. Append-only: a correction is a new row, never an edit.
create table public.screenings (
  id             uuid primary key default gen_random_uuid(),
  company_number text not null references public.targets(company_number) on delete cascade,
  phone_e164     text not null,
  bureau         text,
  file_ref       text,
  submitted_on   date,
  screened_on    date,
  result         text check (result in ('clear','registered','unknown')),
  expires_on     date generated always as (screened_on + 28) stored,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint screenings_result_needs_date
    check (result is null or screened_on is not null)
);
create index screenings_lookup_idx on public.screenings (company_number, screened_on desc);

create or replace function public.screening_ok(p_company_number text)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.screenings
    where company_number = p_company_number
      and result = 'clear'
      and expires_on >= current_date
  );
$$;

create table public.batches (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  owner_id          uuid references public.profiles(id) on delete set null,
  planned_send_date date,
  target_count      int not null default 0,
  approved_by       uuid references public.profiles(id) on delete set null,
  approved_at       timestamptz,
  released_at       timestamptz,
  created_at        timestamptz not null default now(),
  constraint batches_release_needs_approval
    check (released_at is null or approved_by is not null)
);

create table public.drafts (
  id               uuid primary key default gen_random_uuid(),
  company_number   text not null references public.targets(company_number) on delete cascade,
  batch_id         uuid references public.batches(id) on delete set null,
  step             text not null check (step in ('day0_email','day2_linkedin','day4_call','day9_followup')),
  channel          text not null check (channel in ('email','linkedin','call')),
  subject          text,
  body             text not null,
  template_version text not null default 'sequence-v1',
  blockers         text[] not null default '{}',
  rendered_at      timestamptz not null default now(),
  released_at      timestamptz
);
create index drafts_pending_idx on public.drafts (batch_id) where released_at is null;

-- Every real-world event, in either direction. Append-only.
create table public.touches (
  id             uuid primary key default gen_random_uuid(),
  company_number text not null references public.targets(company_number) on delete cascade,
  batch_id       uuid references public.batches(id) on delete set null,
  step           text check (step in ('day0_email','day2_linkedin','day4_call','day9_followup')),
  channel        text not null check (channel in ('email','linkedin','call','note')),
  direction      text not null check (direction in ('out','in')),
  outcome        text check (outcome in
                   ('sent','delivered','bounced','no_answer','gatekeeper','spoke',
                    'callback','meeting_booked','not_interested','wrong_number','replied')),
  occurred_at    timestamptz not null default now(),
  actor_id       uuid references public.profiles(id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now()
);
create index touches_target_idx on public.touches (company_number, occurred_at desc);

-- The two gates. A trigger, not a tool check, so nothing can route around it.
create or replace function public.touches_guard()
returns trigger language plpgsql as $$
begin
  if new.direction = 'out' then
    if public.is_suppressed(new.company_number) then
      raise exception 'refused: % is suppressed and may not be contacted again', new.company_number
        using errcode = 'check_violation';
    end if;
    if new.channel = 'call' and not public.screening_ok(new.company_number) then
      raise exception 'refused: % has no Clear, unexpired TPS/CTPS screening; calling it would be unlawful', new.company_number
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger touches_guard_ins before insert on public.touches
  for each row execute function public.touches_guard();

create or replace function public.refuse_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only; record a new row instead of editing history', tg_table_name
    using errcode = 'check_violation';
end;
$$;
create trigger touches_no_update before update or delete on public.touches
  for each row execute function public.refuse_mutation();
create trigger screenings_no_update before update or delete on public.screenings
  for each row execute function public.refuse_mutation();

-- Every ingested file, fingerprinted, so any row traces back to its source.
create table public.artifacts (
  id          uuid primary key default gen_random_uuid(),
  path        text not null,
  sha256      text not null,
  kind        text not null,
  row_count   int,
  imported_at timestamptz not null default now(),
  unique (sha256, kind)
);

create or replace view public.target_state as
select
  t.company_number, t.display, t.list_name, t.owner_id, t.region, t.phone_e164, t.email,
  t.opening_line is not null and length(btrim(t.opening_line)) > 0 as has_opening_line,
  public.is_suppressed(t.company_number)                          as suppressed,
  public.screening_ok(t.company_number)                           as callable,
  (select max(s.expires_on) from public.screenings s
    where s.company_number = t.company_number and s.result = 'clear') as screening_expires_on,
  (select count(*) from public.touches x
    where x.company_number = t.company_number and x.direction = 'out') as touches_out,
  (select max(x.occurred_at) from public.touches x
    where x.company_number = t.company_number)                        as last_touch_at,
  (select x.outcome from public.touches x
    where x.company_number = t.company_number
    order by x.occurred_at desc limit 1)                              as last_outcome
from public.targets t
where t.crawl_result = 'verified';

alter table public.targets      enable row level security;
alter table public.touches      enable row level security;
alter table public.screenings   enable row level security;
alter table public.suppressions enable row level security;
alter table public.drafts       enable row level security;
alter table public.batches      enable row level security;
alter table public.artifacts    enable row level security;

-- Everyone signed in reads the whole funnel: clause 7 says the leads belong to
-- the business, and the duplicate check cannot work on a partial view.
create policy targets_read      on public.targets      for select using (public.is_member());
create policy touches_read      on public.touches      for select using (public.is_member());
create policy screenings_read   on public.screenings   for select using (public.is_member());
create policy suppressions_read on public.suppressions for select using (public.is_member());
create policy drafts_read       on public.drafts       for select using (public.is_member());
create policy batches_read      on public.batches      for select using (public.is_member());
create policy artifacts_read    on public.artifacts    for select using (public.is_member());

create policy targets_write on public.targets for all
  using (public.is_admin()) with check (public.is_admin());
create policy touches_insert on public.touches for insert
  with check (
    public.is_admin() or exists (
      select 1 from public.targets t
      where t.company_number = touches.company_number and t.owner_id = auth.uid()
    )
  );
create policy suppressions_insert on public.suppressions for insert
  with check (public.is_member());
create policy screenings_write on public.screenings for insert
  with check (public.is_admin());
create policy batches_write on public.batches for all
  using (public.is_admin()) with check (public.is_admin());
create policy drafts_write on public.drafts for all
  using (public.is_admin()) with check (public.is_admin());
create policy artifacts_write on public.artifacts for all
  using (public.is_admin()) with check (public.is_admin());
