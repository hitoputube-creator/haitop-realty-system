create or replace function public.sync_profit_recommendation_prices()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare u jsonb; sale text; dep text; rent text; presale text;
begin
 if pg_trigger_depth()>1 then return new;end if;
 for u in select value from jsonb_array_elements(coalesce(new.units,'[]'::jsonb)) loop
  if nullif(u->>'listing_id','') is null or nullif(u->>'추천등록일','') is null then continue; end if;
  sale:=coalesce(nullif(u->>'현_매매가격',''),nullif(u->>'매매가격',''));
  dep:=coalesce(nullif(u->>'현_보증금',''),nullif(u->>'보증금',''));
  rent:=coalesce(nullif(u->>'현_월세',''),nullif(u->>'월차임',''));
  if coalesce(sale,'') ~ '^[0-9]+([.][0-9]+)?$' then sale:=(sale::numeric*10000)::text; else sale:=''; end if;
  if coalesce(dep,'') ~ '^[0-9]+([.][0-9]+)?$' then dep:=(dep::numeric*10000)::text; else dep:=''; end if;
  if coalesce(rent,'') ~ '^[0-9]+([.][0-9]+)?$' then rent:=(rent::numeric*10000)::text; else rent:=''; end if;
  presale:=u->>'분양금액';
  if coalesce(presale,'') ~ '^[0-9]+([.][0-9]+)?$' then presale:=(presale::numeric*10000)::text;else presale:='';end if;
  update public.listings set data=coalesce(data,'{}'::jsonb)||jsonb_build_object('salePrice',sale,'presalePrice',presale,'presaleStatus',public.commercial_unit_presale_status(u),'deposit',dep,'monthlyRent',rent,'현업종',u->'현업종','import_unit_snapshot',u)
   where id=u->>'listing_id' and data#>>'{profitRecommendation,building_record_id}'=new.id::text;
 end loop;
 return new;
end $$;
revoke all on function public.sync_profit_recommendation_prices() from public,anon;
drop trigger if exists sync_profit_recommendation_prices on public.buildings;
create trigger sync_profit_recommendation_prices after update of units on public.buildings for each row when (old.units is distinct from new.units) execute function public.sync_profit_recommendation_prices();

