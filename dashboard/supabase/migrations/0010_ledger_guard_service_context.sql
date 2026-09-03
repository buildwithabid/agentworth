-- The guard must not fire for callers without a JWT.
--
-- Found by trying to delete a user: removing a profile cascades
-- `on delete set null` onto ledger_entries.created_by / approved_by, and that
-- UPDATE runs with no auth.uid(). The guard therefore treated the database
-- itself as a non-admin and aborted the delete, so a founder who had recorded
-- any ledger entry could not be removed at all.
--
-- Same exemption as guard_profile_role(): a caller holding database
-- credentials is already trusted, and every API request carries a JWT, so the
-- rules that matter — admin-only edits, and nobody approving their own
-- payment — still apply to every real user.
create or replace function public.ledger_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

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

revoke all on function public.ledger_guard() from public, anon, authenticated;
