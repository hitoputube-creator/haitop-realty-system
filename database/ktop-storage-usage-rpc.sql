-- ============================================================
-- 케이탑 저장관리페이지(하이탑 Control Center) 연동용 용량 조회 RPC
--
-- 배경: 하이탑 Control Center의 "DB·파일 분석" 화면에 케이탑 탭을 추가하면서,
--   케이탑 Supabase의 Storage 버킷 용량과 public 스키마 테이블 용량을
--   서버에서 조회할 방법이 필요했다. 하이탑 프로젝트의 get_storage_usage() /
--   get_db_table_sizes()(haitop-realestate-diary 012번 마이그레이션)와 같은
--   역할이지만, 이름을 ktop_ 접두사로 분리해 두 프로젝트의 함수가 섞이지 않게 했다.
--
-- 보안: 케이탑은 anon/authenticated에 공개 RPC를 두지 않는 방식(office_members
--   allowlist 기반)을 쓰고 있으므로, 이 RPC도 같은 원칙을 따라 anon/authenticated
--   모두에게서 권한을 회수하고 service_role에만 EXECUTE를 부여한다. Control Center
--   서버는 케이탑 Supabase의 service_role 키로만 이 함수를 호출하며, 그 키는
--   브라우저에 노출되지 않는다(서버 환경변수에만 보관).
-- ============================================================

begin;

create or replace function public.ktop_get_storage_usage()
returns table (
  bucket_id   text,
  file_count  bigint,
  total_bytes bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    b.id as bucket_id,
    count(o.id) as file_count,
    coalesce(
      sum(
        case
          when o.metadata->>'size' ~ '^[0-9]+$'
            then (o.metadata->>'size')::numeric
          else 0::numeric
        end
      ),
      0::numeric
    )::bigint as total_bytes
  from storage.buckets b
  left join storage.objects o on o.bucket_id = b.id
  group by b.id
  order by b.id;
end;
$$;

create or replace function public.ktop_get_db_table_sizes()
returns table (
  table_name  text,
  total_bytes bigint,
  pretty_size text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    c.relname::text as table_name,
    pg_catalog.pg_total_relation_size(c.oid) as total_bytes,
    pg_catalog.pg_size_pretty(pg_catalog.pg_total_relation_size(c.oid)) as pretty_size
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'  -- 일반 테이블만. 인덱스/뷰/구체화뷰/시퀀스/파티션부모('p') 등은 제외
  order by total_bytes desc;
end;
$$;

revoke all on function public.ktop_get_storage_usage() from public, anon, authenticated;
revoke all on function public.ktop_get_db_table_sizes() from public, anon, authenticated;

grant execute on function public.ktop_get_storage_usage() to service_role;
grant execute on function public.ktop_get_db_table_sizes() to service_role;

commit;
