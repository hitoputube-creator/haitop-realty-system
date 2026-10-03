-- Shared snapshot for both location maps; save is atomic and version checked.
create table public.unjeong_map_state (
  id boolean primary key default true check (id),
  apartments jsonb not null default '[]'::jsonb check (jsonb_typeof(apartments) = 'array'),
  version bigint not null default 1 check (version > 0),
  saved_at timestamptz not null default now(),
  saved_by uuid not null references auth.users(id)
);
alter table public.unjeong_map_state enable row level security;
grant select, insert, update on public.unjeong_map_state to authenticated;
create policy unjeong_map_admin on public.unjeong_map_state for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create function public.save_unjeong_map(p_expected_version bigint, p_apartments jsonb)
returns public.unjeong_map_state language plpgsql security invoker set search_path = '' as $$
declare r public.unjeong_map_state; a jsonb;
begin
  if not public.is_admin() then raise exception '관리자 권한이 필요합니다.'; end if;
  if jsonb_typeof(p_apartments) is distinct from 'array' or jsonb_array_length(p_apartments) > 500 then
    raise exception '올바른 단지 목록이 아닙니다.';
  end if;
  if (select count(*) <> count(distinct v->>'id') from jsonb_array_elements(p_apartments) v) then
    raise exception '중복 단지가 있습니다.';
  end if;
  for a in select value from jsonb_array_elements(p_apartments) loop
    if nullif(a->>'id', '') is null or length(a->>'id') > 100
      or nullif(btrim(a->>'name'), '') is null or length(a->>'name') > 150
      or coalesce(a->>'households', '') !~ '^[0-9]+$'
      or (a->>'households')::numeric not between 1 and 100000
      or coalesce(a->>'status', '') not in ('확인 필요','입주완료','공사중','입주예정')
      or jsonb_typeof(a->'x') is distinct from 'number' or jsonb_typeof(a->'y') is distinct from 'number'
      or (a->>'x')::numeric not between 0 and 1 or (a->>'y')::numeric not between 0 and 1
      or coalesce(a->>'source_url', '') !~ '^https?://'
      or coalesce(a->>'checked_on', '') !~ '^\d{4}-\d{2}-\d{2}$'
      or (a->>'checked_on')::date > current_date then
      raise exception '단지명·세대수·상태·위치·출처·확인일을 확인해주세요.';
    end if;
  end loop;
  if p_expected_version = 0 then
    insert into public.unjeong_map_state (id, apartments, saved_by)
    values (true, p_apartments, auth.uid()) on conflict do nothing returning * into r;
  else
    update public.unjeong_map_state set apartments=p_apartments, version=version+1,
      saved_at=now(), saved_by=auth.uid()
      where id=true and version=p_expected_version returning * into r;
  end if;
  if r.id is null then raise exception '다른 화면에서 먼저 저장했습니다. 닫고 다시 열어주세요.'; end if;
  return r;
end;
$$;
revoke all on function public.save_unjeong_map(bigint,jsonb) from public, anon;
grant execute on function public.save_unjeong_map(bigint,jsonb) to authenticated;
