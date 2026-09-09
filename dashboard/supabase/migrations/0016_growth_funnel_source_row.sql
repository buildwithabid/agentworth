-- build_workbook.py keeps the FIRST of two rows that share a phone or domain, so
-- which twin survives depends on the order of verified.csv, and that in turn
-- shifts the alternating A/B deal. Without the original position, a workbook
-- rebuilt from the database silently produced a different split (A 197 / B 196).
alter table public.targets add column source_row int;

comment on column public.targets.source_row is
  'Row position in verified.csv / misses.csv as crawled. Deduplication keeps the first occurrence, so this ordering is load-bearing: export_workbook must replay it to reproduce the shipped lists.';

create index targets_source_row_idx on public.targets (source_row);
