CREATE TABLE IF NOT EXISTS recommended_files (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommended_id   uuid NOT NULL,
  file_name        text NOT NULL,
  cloudinary_url   text NOT NULL,
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE recommended_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_recommended_files" ON recommended_files
  FOR ALL USING (true) WITH CHECK (true);
