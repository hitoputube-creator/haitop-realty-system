create table public.land_parcels (
id uuid primary key default gen_random_uuid(),
block_id text not null check (block_id ~ '^(third|second-shop|second-multi)-C[0-9]+$'),
subblock text not null check (length(trim(subblock)) between 1 and 30),
parcel text not null check (length(trim(parcel)) between 1 and 30),
x numeric not null check(x between 0 and 100),
y numeric not null check(y between 0 and 100),
data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
created_by uuid default auth.uid() references auth.users(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
unique(block_id, subblock, parcel)
);
alter table public.land_parcels enable row level security;
revoke all on public.land_parcels from anon;
grant select,insert,update,delete on public.land_parcels to authenticated;
grant all on public.land_parcels to service_role;
create policy land_parcels_admin on public.land_parcels for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
