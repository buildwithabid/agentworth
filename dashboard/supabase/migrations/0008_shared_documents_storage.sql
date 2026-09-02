-- A shared, private file store for the three founders: the signed agreement,
-- SECP and PSEB paperwork, PRCs, contracts, case studies.
--
-- The bucket is private. Nothing is reachable by URL; the app mints a
-- short-lived signed link on demand, so a forwarded link expires by itself.

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400)   -- 25 MB per file
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists documents_read   on storage.objects;
drop policy if exists documents_insert on storage.objects;
drop policy if exists documents_update on storage.objects;
drop policy if exists documents_delete on storage.objects;

-- Everyone on the team reads everything: the point is that all three can see
-- the paperwork, exactly as clause 6 asks for the money.
create policy documents_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_member());

create policy documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_member());

create policy documents_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.is_member())
  with check (bucket_id = 'documents' and public.is_member());

-- Deleting is narrower: your own uploads, or an admin. A shared drive where
-- anyone can delete anything is how the signed agreement goes missing.
create policy documents_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (public.is_admin() or owner_id = (select auth.uid())::text)
  );

-- A view so the app can list files with sizes and uploader ids in one query.
-- security_invoker keeps the storage policies above in force for the caller.
drop view if exists public.documents;
create view public.documents with (security_invoker = true) as
select
  o.id,
  o.name,
  o.created_at,
  o.updated_at,
  nullif(o.metadata ->> 'size', '')::bigint as size_bytes,
  o.metadata ->> 'mimetype'                 as mime_type,
  nullif(o.owner_id, '')::uuid              as uploaded_by
from storage.objects o
where o.bucket_id = 'documents';

grant select on public.documents to authenticated;
