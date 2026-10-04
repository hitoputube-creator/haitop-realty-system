-- 상가 카카오맵: 건물 핀 위치를 직접 옮겨 저장한 값 (기존 테이블은 건드리지 않는 신규 테이블)
CREATE TABLE IF NOT EXISTS public.shop_building_geo (
  building_id text PRIMARY KEY,           -- drive_resources.id
  lat         double precision NOT NULL CHECK (lat >= -90 AND lat <= 90),
  lng         double precision NOT NULL CHECK (lng >= -180 AND lng <= 180),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_building_geo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.shop_building_geo
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
