-- The append-only guard from 0012 also blocked ON DELETE CASCADE, which made a
-- target undeletable once it had been screened or touched. That is the wrong
-- trade: history should be un-editable, not un-erasable — these rows are
-- personal data about real UK firms and an erasure request has to be honourable.
--
-- UPDATE is now refused unconditionally. DELETE is refused unless the caller has
-- deliberately opted in for the transaction with
--   set local app.purge = 'on';
-- which is explicit, auditable, and cannot happen by accident.
create or replace function public.refuse_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('app.purge', true), '') = 'on' then
    return old;
  end if;
  if tg_op = 'DELETE' then
    raise exception '% is append-only; to erase a firm set local app.purge = ''on'' first', tg_table_name
      using errcode = 'check_violation';
  end if;
  raise exception '% is append-only; record a new row instead of editing history', tg_table_name
    using errcode = 'check_violation';
end;
$$;
