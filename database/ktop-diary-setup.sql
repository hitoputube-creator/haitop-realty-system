begin;
create table if not exists public.work_board_notes (
 id uuid primary key default gen_random_uuid(),content text not null default '',color text not null default 'yellow',checked boolean not null default false,
 pos_x double precision not null default 6,pos_y double precision not null default 6,z_index integer not null default 1,writer text not null default '케이탑',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),diary_id uuid references public.work_diary(id) on delete set null,
 category text not null default 'etc',order_index bigint not null default 0
);
alter table public.work_board_notes enable row level security;
create policy ktop_board_member_access on public.work_board_notes for all to authenticated
 using ((select auth.uid()) is not null and exists(select 1 from public.office_members where email=(select auth.jwt()->>'email') and active))
 with check ((select auth.uid()) is not null and exists(select 1 from public.office_members where email=(select auth.jwt()->>'email') and active));
revoke all on public.work_board_notes from anon;
grant select,insert,update,delete on public.work_board_notes to authenticated;
create index if not exists work_board_notes_diary_id_idx on public.work_board_notes(diary_id);
create function public.ktop_board_timestamp() returns trigger language plpgsql security invoker set search_path='' as $$begin new.updated_at=now();return new;end;$$;
revoke all on function public.ktop_board_timestamp() from public,anon,authenticated;
create trigger ktop_board_updated before update on public.work_board_notes for each row execute function public.ktop_board_timestamp();
insert into storage.buckets(id,name,public,file_size_limit) values ('crm-attachments','crm-attachments',false,52428800) on conflict(id) do nothing;
create policy ktop_crm_storage_read on storage.objects for select to authenticated
 using (bucket_id='crm-attachments' and (select auth.uid()) is not null and exists(select 1 from public.office_members where email=(select auth.jwt()->>'email') and active));
create policy ktop_crm_storage_insert on storage.objects for insert to authenticated
 with check (bucket_id='crm-attachments' and (select auth.uid()) is not null and exists(select 1 from public.office_members where email=(select auth.jwt()->>'email') and active));
create policy ktop_crm_storage_update on storage.objects for update to authenticated
 using (bucket_id='crm-attachments' and (select auth.uid()) is not null and exists(select 1 from public.office_members where email=(select auth.jwt()->>'email') and active))
 with check (bucket_id='crm-attachments' and (select auth.uid()) is not null and exists(select 1 from public.office_members where email=(select auth.jwt()->>'email') and active));
create policy ktop_crm_storage_delete on storage.objects for delete to authenticated
 using (bucket_id='crm-attachments' and (select auth.uid()) is not null and exists(select 1 from public.office_members where email=(select auth.jwt()->>'email') and active));
create function public.ktop_diary_storage_usage() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if (select auth.uid()) is null or not exists(select 1 from public.office_members where email=(select auth.jwt()->>'email') and active) then raise exception 'Office access denied' using errcode='42501';end if;
 return jsonb_build_object('attachments',(select count(*) from public.crm_attachments),'bytes',(select coalesce(sum(file_size),0) from public.crm_attachments),'diaries',(select count(*) from public.work_diary),'customers',(select count(*) from public.customers),'private_notes',(select count(*) from public.private_notes),'board_notes',(select count(*) from public.work_board_notes));
end;$$;
revoke all on function public.ktop_diary_storage_usage() from public,anon;
grant execute on function public.ktop_diary_storage_usage() to authenticated;
commit;
