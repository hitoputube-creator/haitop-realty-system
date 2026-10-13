create or replace function public.import_building_price_rows(p_name text, p_rows jsonb, p_source text default '', p_overwrite boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  rec public.buildings%rowtype;
  all_units jsonb;
  row_data jsonb;
  patch jsonb;
  old_unit jsonb;
  room text;
  field text;
  idx integer;
  matches integer;
  seen text[] := array[]::text[];
  added integer := 0;
  changed integer := 0;
  allowed text[] := array['층','전용_평','분양_평','평당가','분양금액','현_매매가격','보증금','월차임','분양_VAT','현업종','가격표비고'];
begin
  if auth.uid() is null or not public.is_admin() then raise exception '관리자 로그인이 필요합니다.'; end if;
  if length(trim(p_name))=0 or length(p_name)>200 then raise exception '건물명을 확인하세요.'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>300 then raise exception '1~300개 호실을 선택하세요.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('price-import:'||p_name,0));
  select * into rec from public.buildings where local_id=p_name or name=p_name order by (local_id=p_name) desc limit 1 for update;
  if not found then
    insert into public.buildings(local_id,name,units) values(p_name,p_name,'[]'::jsonb) returning * into rec;
  end if;
  all_units:=coalesce(rec.units,'[]'::jsonb);
  if jsonb_typeof(all_units)<>'array' then raise exception '기존 호실자료 형식을 확인하세요.'; end if;
  for row_data in select value from jsonb_array_elements(p_rows) loop
    room:=regexp_replace(trim(coalesce(row_data->>'호수','')),'[[:space:]호]','','g');
    if room='' or length(room)>40 then raise exception '호수를 확인하세요.'; end if;
    if room=any(seen) then raise exception '가격표에 중복 호실이 있습니다: %',room; end if;
    seen:=array_append(seen,room);
    select count(*),min(ord::integer-1) into matches,idx from jsonb_array_elements(all_units) with ordinality as t(u,ord)
      where regexp_replace(trim(coalesce(u->>'호수','')),'[[:space:]호]','','g')=room;
    if matches>1 then raise exception '기존 자료에 중복 호실이 있습니다: %',room; end if;
    old_unit:=case when matches=1 then all_units->idx else jsonb_build_object('호수',room) end;
    patch:='{}'::jsonb;
    foreach field in array allowed loop
      if row_data ? field and row_data->field<>'null'::jsonb and trim(row_data->>field)<>'' then
        if field not in ('층','분양_VAT','현업종','가격표비고') and (jsonb_typeof(row_data->field)<>'number' or (row_data->>field)::numeric<0 or (row_data->>field)::numeric>1000000000) then raise exception '%호 % 값을 확인하세요.',room,field; end if;
        if field in ('층','분양_VAT','현업종','가격표비고') and length(row_data->>field)>500 then raise exception '항목이 너무 깁니다.'; end if;
        if p_overwrite and row_data ? '_expected' and (old_unit->field is distinct from row_data->'_expected'->field) and not (old_unit->field is null and row_data->'_expected'->field='null'::jsonb) then raise exception '%호 % 값이 다른 화면에서 변경되었습니다. 다시 비교해주세요.',room,field; end if;
        if (old_unit->field is distinct from row_data->field) and (matches=0 or p_overwrite or not (old_unit ? field) or old_unit->field='null'::jsonb or old_unit->>field='') then patch:=patch||jsonb_build_object(field,row_data->field); end if;
      end if;
    end loop;
    if coalesce((coalesce(patch->>'분양_평',old_unit->>'분양_평'))::numeric,0)>0 and coalesce((coalesce(patch->>'전용_평',old_unit->>'전용_평'))::numeric,0)>coalesce((coalesce(patch->>'분양_평',old_unit->>'분양_평'))::numeric,0) then raise exception '%호 전용면적이 분양면적보다 큽니다.',room; end if;
    if matches=0 or patch<>'{}'::jsonb then
      patch:=patch||jsonb_build_object('가격변경이력',coalesce(old_unit->'가격변경이력','[]'::jsonb)||jsonb_build_array(jsonb_build_object('date',now(),'source',left(p_source,300),'before',(select coalesce(jsonb_object_agg(k,old_unit->k),'{}'::jsonb) from jsonb_object_keys(patch) k),'after',patch)));
      patch:=patch||jsonb_build_object('가격표출처',left(p_source,300),'가격표반영일',now(),'updated_at',now());
      if matches=1 then all_units:=jsonb_set(all_units,array[idx::text],old_unit||patch);changed:=changed+1;
      else all_units:=all_units||jsonb_build_array(old_unit||patch);added:=added+1; end if;
    end if;
  end loop;
  update public.buildings set units=all_units,updated_at=now() where id=rec.id;
  return jsonb_build_object('added',added,'updated',changed,'unchanged',jsonb_array_length(p_rows)-added-changed);
end $$;
revoke all on function public.import_building_price_rows(text,jsonb,text,boolean) from public,anon;
grant execute on function public.import_building_price_rows(text,jsonb,text,boolean) to authenticated;
