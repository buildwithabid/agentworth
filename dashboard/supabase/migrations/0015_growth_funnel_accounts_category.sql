-- build_workbook.py derives the pretty size band from the raw Companies House
-- accounts category: SIZE.get(accounts, accounts.title()). Storing only the
-- pretty band meant a database-built workbook fed the band back into that
-- mapper and got 'Small (Up To £10.2M)' instead of 'Small (up to £10.2m)'.
-- Keep the raw category so the round trip is lossless.
alter table public.targets add column accounts_category text;

comment on column public.targets.accounts_category is
  'Raw Companies House Accounts.AccountCategory. size_band is derived from it by build_workbook.py; keep both so an exported workbook is byte-identical to a file-built one.';
