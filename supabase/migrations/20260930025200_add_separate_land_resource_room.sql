alter table public.drive_resource_categories drop constraint drive_resource_categories_room_check;
alter table public.drive_resource_categories add constraint drive_resource_categories_room_check check(room in ('commercial','residential','land'));
insert into public.drive_resource_categories(name,room) values ('점포택지','land'),('주거전용 택지','land') on conflict(name) do nothing;
