-- Categories are shared by the same authenticated office users as drive_resources.
create table public.drive_resource_categories (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check (length(btrim(name)) > 0),
 room text not null check (room in ('commercial', 'residential')),
 created_at timestamptz not null default now()
);
alter table public.drive_resource_categories enable row level security;
revoke all on public.drive_resource_categories from anon;
grant select, insert, update on public.drive_resource_categories to authenticated;
grant all on public.drive_resource_categories to service_role;
create policy category_read on public.drive_resource_categories for select to authenticated using (true);
create policy category_create on public.drive_resource_categories for insert to authenticated with check (true);
create policy category_edit on public.drive_resource_categories for update to authenticated using (true) with check (true);
insert into public.drive_resource_categories(name, room)
select category, case when regexp_replace(category, '\s+', '', 'g') in ('오피스텔','힐스테이트더운정') then 'residential' else 'commercial' end
from public.drive_resources where category is not null and btrim(category) <> ''
group by category order by min(created_at);

create function public.ensure_drive_resource_category() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if new.category is not null and btrim(new.category) <> '' then
  insert into public.drive_resource_categories(name,room)
  values(new.category, case when regexp_replace(new.category, '\s+', '', 'g') in ('오피스텔','힐스테이트더운정') then 'residential' else 'commercial' end)
  on conflict(name) do nothing;
 end if;
 return new;
end; $$;
create trigger ensure_drive_resource_category before insert or update of category on public.drive_resources
for each row execute function public.ensure_drive_resource_category();

create function public.rename_drive_resource_category() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if new.name is distinct from old.name then
  update public.drive_resources set category = new.name where category = old.name;
 end if;
 return new;
end; $$;
create trigger rename_drive_resource_category after update of name on public.drive_resource_categories
for each row execute function public.rename_drive_resource_category();
revoke all on function public.ensure_drive_resource_category() from public, anon;
revoke all on function public.rename_drive_resource_category() from public, anon;
grant execute on function public.ensure_drive_resource_category() to authenticated, service_role;
grant execute on function public.rename_drive_resource_category() to authenticated, service_role;
