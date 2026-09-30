create sequence public.drive_resource_category_sort_seq;
alter table public.drive_resource_categories add column sort_order bigint not null default nextval('public.drive_resource_category_sort_seq'::regclass);
alter sequence public.drive_resource_category_sort_seq owned by public.drive_resource_categories.sort_order;
with ordered as (select id,row_number() over(order by created_at,name,id)-1 as position from public.drive_resource_categories)
update public.drive_resource_categories c set sort_order=o.position from ordered o where c.id=o.id;
select setval('public.drive_resource_category_sort_seq', coalesce((select max(sort_order)+1 from public.drive_resource_categories),0)+1,false);
grant usage on sequence public.drive_resource_category_sort_seq to authenticated,service_role;
revoke all on sequence public.drive_resource_category_sort_seq from anon;

create function public.reorder_drive_categories(category_ids uuid[], resource_scope text)
returns void language plpgsql security invoker set search_path='' as $$
declare slots bigint[]; expected_count integer;
begin
 if resource_scope is null or resource_scope not in ('commercial','residential','land','all') then raise exception 'Invalid resource room'; end if;
 -- Serialize reorders; ordinary category create/edit keeps its existing permissions.
 perform id from public.drive_resource_categories order by id for update;
 select array_agg(sort_order order by sort_order,created_at,name,id),count(*) into slots,expected_count
 from public.drive_resource_categories where resource_scope='all' or room=resource_scope;
 if category_ids is null or cardinality(category_ids) <> expected_count
 or (select count(distinct id) from unnest(category_ids) as x(id)) <> expected_count
 or (select count(*) from public.drive_resource_categories where id=any(category_ids) and (resource_scope='all' or room=resource_scope)) <> expected_count then
  raise exception 'Categories changed; reload and try again';
 end if;
 update public.drive_resource_categories c set sort_order=slots[requested.position::integer]
 from unnest(category_ids) with ordinality as requested(id,position) where c.id=requested.id;
end; $$;
revoke all on function public.reorder_drive_categories(uuid[],text) from public,anon;
grant execute on function public.reorder_drive_categories(uuid[],text) to authenticated,service_role;
