-- Review findings, all confirmed against production.
--
-- 1. is_suppressed did not follow duplicate_of, so a practice trading under two
--    company numbers stayed reachable through its twin — defeating the point of
--    suppressing by identifier rather than by row.
-- 2. screening_ok ignored WHICH number was screened, so a Clear result for an
--    old number authorised calls to a number corrected afterwards.
-- 3. A screening dated in the future would extend callability indefinitely.
-- 4. The 5 linked duplicate practices were contactable through target_state.
-- 5. A tool cannot `set local`, so the test suite could not erase its own
--    fixture and left a fake firm in the funnel — which would have shipped
--    inside a founder's workbook.
create or replace function public.is_suppressed(p_company_number text)
returns boolean language sql stable as $$
  with family as (
    select company_number, domain, phone_e164, email from public.targets
     where company_number = p_company_number
        or company_number = (select duplicate_of from public.targets
                              where company_number = p_company_number)
        or duplicate_of = p_company_number
        or duplicate_of = (select duplicate_of from public.targets
                            where company_number = p_company_number)
  )
  select exists (
    select 1 from family t
    join public.suppressions s
      on (s.kind = 'company_number' and s.value = t.company_number)
      or (s.kind = 'domain'         and s.value = t.domain)
      or (s.kind = 'phone'          and s.value = t.phone_e164)
      or (s.kind = 'email'          and s.value = lower(t.email))
  );
$$;

create or replace function public.screening_ok(p_company_number text)
returns boolean language sql stable as $$
  select exists (
    select 1
      from public.screenings s
      join public.targets t on t.company_number = s.company_number
     where s.company_number = p_company_number
       and s.result = 'clear'
       and s.expires_on >= current_date
       and s.phone_e164 = t.phone_e164
  );
$$;

alter table public.screenings add constraint screenings_not_future
  check (screened_on is null or screened_on <= current_date + 1);

create or replace view public.target_state
with (security_invoker = on) as
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
where t.crawl_result = 'verified'
  and t.duplicate_of is null;

comment on view public.target_state is
  'security_invoker = on. Never create a view over the funnel tables without it: a definer-rights view bypasses RLS and exposes the whole lead list to the publishable key that ships in the public dashboard bundle. Excludes duplicate_of rows, which are never contacted directly.';

create or replace function public.purge_target(p_company_number text)
returns int language plpgsql security definer set search_path = public as $$
declare removed int;
begin
  if p_company_number is null or btrim(p_company_number) = '' then
    raise exception 'purge_target needs a company_number';
  end if;
  perform set_config('app.purge', 'on', true);
  delete from public.targets where company_number = p_company_number;
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.purge_target(text) from public, anon, authenticated;

comment on function public.purge_target(text) is
  'Erase a firm and its cascade. Service role only. This is the erasure path for a GDPR request, and the cleanup path for tests.';
