-- Pin search_path on the trigger functions (Supabase security lint 0011).
-- Folded into 0001 as well, so a fresh project is correct from the start;
-- this file exists because 0001 was already applied when the lint was found.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.deals_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;
  return new;
end;
$$;
