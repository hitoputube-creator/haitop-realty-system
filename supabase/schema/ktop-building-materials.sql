-- KTOP only. Private documents; service-side uploads check office membership and resource access.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('building-materials','building-materials',false,20971520,array['image/jpeg','image/png','image/webp','image/gif','application/pdf']) on conflict(id) do nothing;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='ktop_building_material_read') then
  create policy ktop_building_material_read on storage.objects for select to authenticated using (bucket_id='building-materials' and exists (select 1 from public.office_members m where m.email=(select auth.jwt()->>'email') and m.active) and exists (select 1 from public.drive_resources r where r.id::text=split_part(storage.objects.name,'/',1)));
 end if;
end $$;
