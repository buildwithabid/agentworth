-- build_workbook.py drops 5 verified firms because another company shares their
-- phone or domain — the same practice trading under two registrations. Dropping
-- them loses the fact that they exist; linking them keeps it, and lets
-- suppression reach the practice through either company number.
alter table public.targets
  add column duplicate_of text references public.targets(company_number) on delete set null;

alter table public.targets drop constraint targets_verified_has_list;
alter table public.targets add constraint targets_verified_has_list
  check (crawl_result <> 'verified' or list_name is not null or duplicate_of is not null);

comment on column public.targets.duplicate_of is
  'Set when this company was excluded from the A/B split because another target already carries its phone or domain. Such a row has no list_name and is never contacted directly.';
