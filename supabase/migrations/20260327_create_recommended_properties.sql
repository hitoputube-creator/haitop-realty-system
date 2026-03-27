-- 추천매물장 테이블 생성
CREATE TABLE recommended_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  drive_url text,
  received_date date,
  memo text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE recommended_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON recommended_properties
FOR ALL USING (true) WITH CHECK (true);
