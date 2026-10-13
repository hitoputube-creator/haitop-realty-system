CREATE OR REPLACE FUNCTION public.commercial_unit_presale_status(u jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$ declare v text; begin if u->>'분양상태' in ('분양중','분양완료') then return u->>'분양상태';end if;v:=coalesce(nullif(u->>'현_매매가격',''),nullif(u->>'매매가격',''),'0');if v ~ '^[0-9]+([.][0-9]+)?$' then if v::numeric>0 then return '분양완료';end if;end if;v:=coalesce(u->>'분양금액','0');if v ~ '^[0-9]+([.][0-9]+)?$' then if v::numeric>0 then return '분양중';end if;end if;return '분양완료';end $function$

CREATE OR REPLACE FUNCTION public.commercial_won_to_man(v text)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$ begin v:=replace(coalesce(v,''),',','');if v ~ '^[0-9]+([.][0-9]+)?$' then return v::numeric/10000;end if;return null;end $function$

CREATE OR REPLACE FUNCTION public.sync_commercial_listing_to_unit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$ declare b public.buildings%rowtype; u jsonb; ix int; patch jsonb; begin if pg_trigger_depth()>1 or new.category1 is distinct from '상가사무실' then return new;end if;select * into b from public.buildings bb where bb.name=new.data->>'complexName' and exists(select 1 from jsonb_array_elements(bb.units) x where x->>'listing_id'=new.id) limit 1 for update;if not found then return new;end if;select value,(ordinality-1)::int into u,ix from jsonb_array_elements(b.units) with ordinality where value->>'listing_id'=new.id limit 1;patch:=jsonb_build_object('분양상태',coalesce(new.data->>'presaleStatus',public.commercial_unit_presale_status(u)),'현_매매가격',case when new.data->'salePrice' is distinct from old.data->'salePrice' then to_jsonb(public.commercial_won_to_man(new.data->>'salePrice')) else u->'현_매매가격' end,'分양금액',u->'분양금액','현_보증금',case when new.data->'deposit' is distinct from old.data->'deposit' then to_jsonb(public.commercial_won_to_man(new.data->>'deposit')) else u->'현_보증금' end,'현_월세',case when new.data->'monthlyRent' is distinct from old.data->'monthlyRent' then to_jsonb(public.commercial_won_to_man(new.data->>'monthlyRent')) else u->'현_월세' end);patch:=patch-'分양금액';if new.data->'presalePrice' is distinct from old.data->'presalePrice' then patch:=patch||jsonb_build_object('분양금액',public.commercial_won_to_man(new.data->>'presalePrice'));end if;if new.data->>'occupancy' in ('공실','임차중') then patch:=patch||jsonb_build_object('공실여부',new.data->>'occupancy');end if;update public.buildings set units=jsonb_set(b.units,array[ix::text],u||patch),updated_at=now() where id=b.id;return new;end $function$

revoke all on function public.commercial_unit_presale_status(jsonb),public.commercial_won_to_man(text),public.sync_commercial_listing_to_unit() from public,anon;
grant execute on function public.commercial_unit_presale_status(jsonb),public.commercial_won_to_man(text) to authenticated;
drop trigger if exists sync_commercial_listing_to_unit on public.listings;
create trigger sync_commercial_listing_to_unit after update of data on public.listings for each row when (old.data is distinct from new.data) execute function public.sync_commercial_listing_to_unit();
