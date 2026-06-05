-- 건물 상세 페이지: 층별 평면도 테이블
CREATE TABLE IF NOT EXISTS building_floors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id  uuid NOT NULL,
  floor_number text NOT NULL,
  file_name    text NOT NULL,
  cloudinary_url text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE building_floors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_building_floors" ON building_floors
  FOR ALL USING (true) WITH CHECK (true);

-- 건물 상세 페이지: 기타 자료 테이블
CREATE TABLE IF NOT EXISTS building_files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id    uuid NOT NULL,
  file_name      text NOT NULL,
  cloudinary_url text,
  drive_link     text,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE building_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_building_files" ON building_files
  FOR ALL USING (true) WITH CHECK (true);
