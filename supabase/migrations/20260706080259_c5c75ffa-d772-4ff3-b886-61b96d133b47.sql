
-- 1) Restrict app_settings SELECT to admins only (removes anon read of worker_pin)
DROP POLICY IF EXISTS "Anyone can view settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated users can insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON public.app_settings;

CREATE POLICY "Admins can view settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert settings" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete settings" ON public.app_settings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Restrict workers SELECT to admins only (removes anon read of badge_id)
DROP POLICY IF EXISTS "Anyone can view workers" ON public.workers;
DROP POLICY IF EXISTS "Authenticated users can insert workers" ON public.workers;
DROP POLICY IF EXISTS "Authenticated users can update workers" ON public.workers;
DROP POLICY IF EXISTS "Authenticated users can delete workers" ON public.workers;

CREATE POLICY "Admins can view workers" ON public.workers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert workers" ON public.workers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update workers" ON public.workers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete workers" ON public.workers
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) Products — admin-only DELETE (keep public SELECT/INSERT/UPDATE for worker flow)
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;
CREATE POLICY "Admins can delete products" ON public.products
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) Operations — admin-only DELETE (keep INSERT/SELECT for worker flow)
DROP POLICY IF EXISTS "Authenticated users can delete operations" ON public.operations;
CREATE POLICY "Admins can delete operations" ON public.operations
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) Sectors — admin-only INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Authenticated users can insert sectors" ON public.sectors;
DROP POLICY IF EXISTS "Authenticated users can update sectors" ON public.sectors;
DROP POLICY IF EXISTS "Authenticated users can delete sectors" ON public.sectors;

CREATE POLICY "Admins can insert sectors" ON public.sectors
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update sectors" ON public.sectors
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sectors" ON public.sectors
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6) Shelves — admin-only INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Authenticated users can insert shelves" ON public.shelves;
DROP POLICY IF EXISTS "Authenticated users can update shelves" ON public.shelves;
DROP POLICY IF EXISTS "Authenticated users can delete shelves" ON public.shelves;

CREATE POLICY "Admins can insert shelves" ON public.shelves
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update shelves" ON public.shelves
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete shelves" ON public.shelves
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7) Product placements — admin-only INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Authenticated users can insert placements" ON public.product_placements;
DROP POLICY IF EXISTS "Authenticated users can update placements" ON public.product_placements;
DROP POLICY IF EXISTS "Authenticated users can delete placements" ON public.product_placements;

CREATE POLICY "Admins can insert placements" ON public.product_placements
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update placements" ON public.product_placements
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete placements" ON public.product_placements
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
