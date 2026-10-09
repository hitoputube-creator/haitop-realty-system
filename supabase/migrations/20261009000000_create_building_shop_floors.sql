-- 건물별 상가 층 설정: 오피스텔처럼 일부 층만 상가인 건물의 후보 보기 범위 (기존 테이블은 건드리지 않는 신규 테이블)
CREATE TABLE IF NOT EXISTS public.building_shop_floors (
  local_id    text PRIMARY KEY,                                   -- buildings.local_id
  max_floor   smallint NOT NULL DEFAULT 1 CHECK (max_floor BETWEEN 1 AND 10),  -- 1층부터 이 층까지가 상가
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.building_shop_floors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.building_shop_floors
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "hitop_approved_staff_gate" ON public.building_shop_floors
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING ((SELECT public.is_hitop_approved_staff()))
  WITH CHECK ((SELECT public.is_hitop_approved_staff()));

-- 남광하우스토리: 오피스텔 건물, 상가는 3층까지
INSERT INTO public.building_shop_floors (local_id, max_floor)
VALUES ('남광하우스토리', 3)
ON CONFLICT (local_id) DO NOTHING;
