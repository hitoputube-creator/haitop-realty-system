alter table public.listings
  add column if not exists is_public boolean not null default false,
  add column if not exists image_urls text[] not null default '{}'::text[];

insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do update set public = excluded.public;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read listing images'
  ) then
    create policy "Public read listing images"
    on storage.objects for select
    using (bucket_id = 'listing-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Anon upload listing images'
  ) then
    create policy "Anon upload listing images"
    on storage.objects for insert to anon
    with check (bucket_id = 'listing-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Anon update listing images'
  ) then
    create policy "Anon update listing images"
    on storage.objects for update to anon
    using (bucket_id = 'listing-images')
    with check (bucket_id = 'listing-images');
  end if;
end $$;
