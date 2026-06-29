
CREATE TABLE public.shelves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL DEFAULT upper(SUBSTRING((gen_random_uuid())::text FROM 1 FOR 4)),
  rows integer NOT NULL DEFAULT 3,
  columns integer NOT NULL DEFAULT 5,
  levels integer NOT NULL DEFAULT 2,
  capacity integer NOT NULL DEFAULT 30,
  width_cm integer NOT NULL DEFAULT 200,
  depth_cm integer NOT NULL DEFAULT 60,
  height_cm integer NOT NULL DEFAULT 180,
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  orientation integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector_id, code)
);

GRANT SELECT ON public.shelves TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shelves TO authenticated;
GRANT ALL ON public.shelves TO service_role;

ALTER TABLE public.shelves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shelves" ON public.shelves
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated users can insert shelves" ON public.shelves
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update shelves" ON public.shelves
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete shelves" ON public.shelves
  FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.sync_shelf_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.capacity := GREATEST(1, COALESCE(NEW.rows, 1) * COALESCE(NEW.columns, 1) * COALESCE(NEW.levels, 1));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_shelf_capacity
  BEFORE INSERT OR UPDATE ON public.shelves
  FOR EACH ROW EXECUTE FUNCTION public.sync_shelf_capacity();

CREATE TRIGGER trg_shelves_updated_at
  BEFORE UPDATE ON public.shelves
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create one default shelf per existing sector
INSERT INTO public.shelves (sector_id, name, code)
SELECT s.id, 'Asosiy shkaf', 'A1' FROM public.sectors s;

-- Add shelf_id to placements and migrate
ALTER TABLE public.product_placements
  ADD COLUMN shelf_id uuid REFERENCES public.shelves(id) ON DELETE CASCADE;

UPDATE public.product_placements pp
SET shelf_id = sh.id
FROM public.shelves sh
WHERE sh.sector_id = pp.sector_id
  AND pp.shelf_id IS NULL;

ALTER TABLE public.product_placements
  ALTER COLUMN shelf_id SET NOT NULL;

CREATE INDEX idx_product_placements_shelf ON public.product_placements(shelf_id);
