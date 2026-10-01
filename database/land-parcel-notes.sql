-- Private dated notes and photos for office land parcels. Applied 2026-10-01.
create table public.land_parcel_notes (
 id uuid primary key default gen_random_uuid(),
 block_id text not null check(length(block_id) between 1 and 100),
 subblock text not null check(length(subblock) between 1 and 30),
 parcel text not null check(length(parcel) between 1 and 30),
 body text not null default '' check(length(body)<=10000),
 photos jsonb not null default '[]'::jsonb check(jsonb_typeof(photos)='array' and jsonb_array_length(photos)<=10),
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index land_parcel_notes_lookup on public.land_parcel_notes(block_id,subblock,parcel,created_at desc);
alter table public.land_parcel_notes enable row level security;
grant select,insert,update,delete on public.land_parcel_notes to authenticated;
revoke all on public.land_parcel_notes from anon;
create policy land_parcel_notes_admin on public.land_parcel_notes for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('land-parcel-photos','land-parcel-photos',false,10485760,array['image/jpeg','image/png','image/webp','image/gif']);
create policy land_parcel_photos_select on storage.objects for select to authenticated using (bucket_id='land-parcel-photos' and (select public.is_admin()));
create policy land_parcel_photos_insert on storage.objects for insert to authenticated with check (bucket_id='land-parcel-photos' and (select public.is_admin()));
create policy land_parcel_photos_delete on storage.objects for delete to authenticated using (bucket_id='land-parcel-photos' and (select public.is_admin()));
