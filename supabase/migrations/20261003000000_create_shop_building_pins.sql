-- 상가 위치도: 지도 위 건물 표시 위치 (기존 테이블은 건드리지 않는 신규 테이블)
CREATE TABLE IF NOT EXISTS public.shop_building_pins (
  building_id text PRIMARY KEY,           -- drive_resources.id
  x           numeric NOT NULL CHECK (x >= 0 AND x <= 100),
  y           numeric NOT NULL CHECK (y >= 0 AND y <= 100),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_building_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.shop_building_pins
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
