-- Restrict every table to the three founders by email.
--
-- Why: the anon key ships inside the JS bundle, so "any authenticated user"
-- means "anyone who can reach /auth/v1/signup". This pins access to a named
-- list instead, so a stray sign-up sees nothing even if the sign-up toggle is
-- left on.
--
-- TO ADD OR CHANGE A FOUNDER: edit the list in this one function and re-run it.
-- The email must match the one on their Supabase auth user exactly.

create or replace function public.is_founder()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'email', '') in (
    'aitechpro1987@gmail.com'   -- Abid
    -- , 'ikhtisham@example.com'  -- Ikhtisham
    -- , 'rehbar@example.com'     -- Rehbar
  );
$$;

grant execute on function public.is_founder() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'deals','capacity_settings','projects','ledger_entries','checklist_steps'
  ] loop
    execute format('drop policy if exists founders_all on public.%I', t);
    execute format(
      'create policy founders_all on public.%I for all to authenticated '
      'using (public.is_founder()) with check (public.is_founder())', t);
  end loop;
end;
$$;
