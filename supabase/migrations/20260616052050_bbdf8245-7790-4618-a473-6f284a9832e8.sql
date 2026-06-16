DROP POLICY IF EXISTS "Authenticated users can view placements" ON public.product_placements;
CREATE POLICY "Anyone can view placements" ON public.product_placements FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.product_placements TO anon;