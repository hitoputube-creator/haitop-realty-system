-- 건물 호실 현황 테이블
-- building-detail.html의 buildingId(drive_resources.id UUID)를 local_id로 연결
-- units 컬럼에 호실 배열(JSON)을 저장

CREATE TABLE IF NOT EXISTS public.buildings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id   text        UNIQUE NOT NULL,     -- drive_resources.id (UUID 문자열)
  name       text        NOT NULL DEFAULT '',
  units      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_full_access" ON public.buildings
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- updated_at 자동 갱신 함수 (이미 존재하면 무시)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER buildings_updated_at
  BEFORE UPDATE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
