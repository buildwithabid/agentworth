-- Sign-up becomes invite-only, enforced in the database rather than by a
-- dashboard toggle. Stronger than the toggle: it holds even if the toggle is
-- switched back on, and it puts the decision in the admin's hands inside the
-- app instead of in the Supabase console.
--
-- Nobody gets an account unless an admin has put their address on this list
-- first. That includes accounts created from the Supabase dashboard.

create table if not exists public.allowed_signups (
  email       text primary key,
  note        text,
  invited_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.allowed_signups enable row level security;

drop policy if exists allowed_read   on public.allowed_signups;
drop policy if exists allowed_write  on public.allowed_signups;
drop policy if exists allowed_delete on public.allowed_signups;

create policy allowed_read on public.allowed_signups for select to authenticated
  using (public.is_member());
create policy allowed_write on public.allowed_signups for insert to authenticated
  with check (public.is_admin());
create policy allowed_delete on public.allowed_signups for delete to authenticated
  using (public.is_admin());

grant select, insert, delete on public.allowed_signups to authenticated;

insert into public.allowed_signups (email, note)
select lower(u.email), 'founding member'
from auth.users u
on conflict (email) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare invited boolean;
begin
  select exists (
    select 1 from public.allowed_signups a where a.email = lower(new.email)
  ) into invited;

  if not invited then
    raise exception
      'This address has not been invited to the Agentworth dashboard. Ask Abid to add it on the Team screen first.'
      using errcode = 'check_violation';
  end if;

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

revoke all on function public.handle_new_user() from public, anon, authenticated;
