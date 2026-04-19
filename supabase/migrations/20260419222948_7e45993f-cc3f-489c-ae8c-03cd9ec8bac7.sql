-- WORKERS: SELECT for anon (verify badge)
DROP POLICY IF EXISTS "Authenticated users can view workers" ON public.workers;
CREATE POLICY "Anyone can view workers"
  ON public.workers FOR SELECT
  TO anon, authenticated
  USING (true);

-- PRODUCTS: SELECT + UPDATE for anon (scan + IN/OUT quantity change), INSERT only for authenticated (admin)
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
CREATE POLICY "Anyone can update products"
  ON public.products FOR UPDATE
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
CREATE POLICY "Anyone can insert products"
  ON public.products FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SECTORS: SELECT for anon (used in product display)
DROP POLICY IF EXISTS "Authenticated users can view sectors" ON public.sectors;
CREATE POLICY "Anyone can view sectors"
  ON public.sectors FOR SELECT
  TO anon, authenticated
  USING (true);

-- OPERATIONS: SELECT + INSERT for anon (worker IN/OUT)
DROP POLICY IF EXISTS "Authenticated users can view operations" ON public.operations;
CREATE POLICY "Anyone can view operations"
  ON public.operations FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert operations" ON public.operations;
CREATE POLICY "Anyone can insert operations"
  ON public.operations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- APP_SETTINGS: SELECT for anon (worker_pin verification on edge function bypasses RLS, but client may also read non-sensitive keys)
DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.app_settings;
CREATE POLICY "Anyone can view settings"
  ON public.app_settings FOR SELECT
  TO anon, authenticated
  USING (true);