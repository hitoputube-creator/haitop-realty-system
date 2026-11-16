BEGIN;
CREATE TABLE IF NOT EXISTS public.unit_row_highlights (
 building_key text NOT NULL CHECK(length(building_key)>0 AND length(building_key)<=300),
 unit_key text NOT NULL CHECK(length(unit_key)>0 AND length(unit_key)<=500),
 color text NOT NULL CHECK(color IN ('yellow','pink','mint')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (building_key,unit_key)
);
ALTER TABLE public.unit_row_highlights ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unit_row_highlights FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.unit_row_highlights TO authenticated;
DO $policy$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='unit_row_highlights' AND policyname='unit_row_highlights_office_access') THEN CREATE POLICY unit_row_highlights_office_access ON public.unit_row_highlights FOR ALL TO authenticated USING(true) WITH CHECK(true); END IF; END $policy$;
NOTIFY pgrst, 'reload schema';
COMMIT;
