alter table public.buildings add column if not exists sales_agent_name text;
alter table public.buildings add column if not exists sales_agent_phone text;

create or replace function public.register_profit_recommendations(p_name text,p_resource_id uuid,p_address text,p_expected jsonb,p_reason text default '')
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare b public.buildings%rowtype; l public.listings%rowtype; u jsonb; expected jsonb; next_units jsonb; d jsonb; stamp text; lid text; room text; idx int; matches int; total int:=0; tags text[]; sale text; dep text; rent text;
begin
 if auth.uid() is null or not public.is_admin() then raise exception '관리자 로그인이 필요합니다.'; end if;
 if jsonb_typeof(p_expected) is distinct from 'array' or jsonb_array_length(p_expected) not between 1 and 300 then raise exception '추천할 호실을 선택하세요.'; end if;
 select * into b from public.buildings where local_id=p_name or name=p_name order by (local_id=p_name) desc limit 1 for update;
 if not found then raise exception '건물 호실자료가 없습니다.'; end if;
 if not exists(select 1 from public.drive_resources where id=p_resource_id and name=b.name) then raise exception '건물 연결정보를 확인해주세요.'; end if;
 if length(coalesce(p_reason,''))>500 then raise exception '추천 사유는 500자까지 입력하세요.'; end if;
 next_units:=coalesce(b.units,'[]'::jsonb);
 if (select count(distinct regexp_replace(value->>'호수','[[:space:]호]','','g')) from jsonb_array_elements(p_expected)) <> jsonb_array_length(p_expected) then raise exception '중복 호실을 선택할 수 없습니다.'; end if;
 for expected in select value from jsonb_array_elements(p_expected) loop
  room:=regexp_replace(expected->>'호수','[[:space:]호]','','g');
  select count(*) into matches from jsonb_array_elements(next_units) x where regexp_replace(x->>'호수','[[:space:]호]','','g')=room;
  if matches<>1 then raise exception '호실을 정확히 찾을 수 없습니다: %',room; end if;
  select value,(ordinality-1)::int into u,idx from jsonb_array_elements(next_units) with ordinality where regexp_replace(value->>'호수','[[:space:]호]','','g')=room;
  if u is distinct from expected then raise exception '호실자료가 변경되었습니다. 새로고침 후 다시 선택해주세요: %',room; end if;
  lid:=coalesce(nullif(u->>'listing_id',''),nullif(u->>'pending_listing_id',''),gen_random_uuid()::text);
  select * into l from public.listings where id=lid for update;
  stamp:=coalesce(nullif(u->>'추천등록일',''),nullif(l.data#>>'{profitRecommendation,registered_at}',''),to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  u:=(u-'pending_listing_id')||jsonb_build_object('listing_id',lid,'추천매물',true,'수익성매물',true,'추천등록일',stamp,'추천사유',coalesce(nullif(btrim(p_reason),''),u->>'추천사유',''));
  sale:=coalesce(nullif(u->>'현_매매가격',''),nullif(u->>'매매가격',''));
  dep:=coalesce(nullif(u->>'현_보증금',''),nullif(u->>'보증금',''));
  rent:=coalesce(nullif(u->>'현_월세',''),nullif(u->>'월차임',''));
  if coalesce(sale,'') ~ '^[0-9]+([.][0-9]+)?$' then sale:=(sale::numeric*10000)::text; else sale:=''; end if;
  if coalesce(dep,'') ~ '^[0-9]+([.][0-9]+)?$' then dep:=(dep::numeric*10000)::text; else dep:=''; end if;
  if coalesce(rent,'') ~ '^[0-9]+([.][0-9]+)?$' then rent:=(rent::numeric*10000)::text; else rent:=''; end if;
  select array_agg(distinct t) into tags from (select jsonb_array_elements_text(case when jsonb_typeof(l.data->'stickers')='array' then l.data->'stickers' else '[]'::jsonb end) t union all select unnest(coalesce(l.stickers,'{}'::text[])) union all select '추천매물' union all select '수익형') s;
  d:=coalesce(l.data,'{}'::jsonb)||jsonb_build_object('category1','상가사무실','category2','상가','complexName',b.name,'ho',u->>'호수','listingKind','매물','dealType',coalesce(nullif(l.data->>'dealType',''),'매매'),'salePrice',sale,'deposit',dep,'monthlyRent',rent,'stickers',to_jsonb(tags),'exclusiveAreaPy',u->'전용_평','supplyAreaPy',u->'분양_평','owner_name',coalesce(u->>'소유주',''),'owner_phone1',coalesce(u->>'연락처',''),'owner_memo',coalesce(u->>'비고',''),'현업종',u->'현업종','import_unit_snapshot',u,'profitRecommendation',jsonb_build_object('registered_at',stamp,'building_record_id',b.id,'resource_id',p_resource_id,'room',u->>'호수'));
  insert into public.listings(id,type,title,address,status,resource_id,category1,category2,is_public,data,stickers)
  values(lid,coalesce(l.type,'shop'),coalesce(l.title,b.name||' '||(u->>'호수')||'호 상가'),coalesce(nullif(l.address,''),p_address,''),coalesce(l.status,'진행중'),coalesce(l.resource_id,p_resource_id),'상가사무실','상가',coalesce(l.is_public,false),d,tags)
  on conflict(id) do update set data=excluded.data,stickers=excluded.stickers,category1=excluded.category1,category2=excluded.category2,resource_id=excluded.resource_id;
  next_units:=jsonb_set(next_units,array[idx::text],u);total:=total+1;
 end loop;
 update public.buildings set units=next_units,updated_at=now() where id=b.id;
 return jsonb_build_object('count',total);
end $$;
revoke all on function public.register_profit_recommendations(text,uuid,text,jsonb,text) from public,anon;
grant execute on function public.register_profit_recommendations(text,uuid,text,jsonb,text) to authenticated;

create or replace function public.save_building_sales_contact(p_resource_id uuid,p_name text,p_contact jsonb,p_expected jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare b public.buildings%rowtype; n text:=btrim(coalesce(p_contact->>'name','')); ph text:=btrim(coalesce(p_contact->>'phone',''));
begin
 if auth.uid() is null or not public.is_admin() then raise exception '관리자 로그인이 필요합니다.'; end if;
 if length(n)>100 or length(ph)>50 then raise exception '이름 또는 연락처가 너무 깁니다.'; end if;
 if not exists(select 1 from public.drive_resources where id=p_resource_id and name=p_name) then raise exception '건물 연결정보를 확인해주세요.'; end if;
 perform pg_advisory_xact_lock(hashtext('sales-contact:'||p_name));
 select * into b from public.buildings where local_id=p_name or name=p_name order by (local_id=p_name) desc limit 1 for update;
 if found then
  if jsonb_build_object('name',coalesce(b.sales_agent_name,''),'phone',coalesce(b.sales_agent_phone,'')) is distinct from p_expected then raise exception '담당자 정보가 변경되었습니다. 새로고침 후 다시 입력해주세요.'; end if;
  update public.buildings set sales_agent_name=n,sales_agent_phone=ph,updated_at=now() where id=b.id;
 else
  insert into public.buildings(local_id,name,units,sales_agent_name,sales_agent_phone) values(p_name,p_name,'[]'::jsonb,n,ph);
 end if;
 return jsonb_build_object('name',n,'phone',ph);
end $$;
revoke all on function public.save_building_sales_contact(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.save_building_sales_contact(uuid,text,jsonb,jsonb) to authenticated;
