
CREATE TABLE public.product_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  level integer NOT NULL CHECK (level >= 1),
  column_idx integer NOT NULL CHECK (column_idx >= 1),
  row_idx integer NOT NULL CHECK (row_idx >= 1),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sector_id, level, column_idx, row_idx)
);

CREATE INDEX idx_product_placements_sector ON public.product_placements(sector_id);
CREATE INDEX idx_product_placements_product ON public.product_placements(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_placements TO authenticated;
GRANT ALL ON public.product_placements TO service_role;

ALTER TABLE public.product_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view placements"
  ON public.product_placements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert placements"
  ON public.product_placements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update placements"
  ON public.product_placements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete placements"
  ON public.product_placements FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_product_placements_updated_at
  BEFORE UPDATE ON public.product_placements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
