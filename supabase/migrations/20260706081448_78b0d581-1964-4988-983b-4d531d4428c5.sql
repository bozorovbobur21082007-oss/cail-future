
-- Products: admin-only writes (workers now write via the worker-action edge function using the service role)
DROP POLICY IF EXISTS "Anyone can update products" ON public.products;
DROP POLICY IF EXISTS "Anyone can insert products" ON public.products;

CREATE POLICY "Admins can insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update products" ON public.products
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Operations: admin-only inserts (worker inserts now go through the worker-action edge function)
DROP POLICY IF EXISTS "Anyone can insert operations" ON public.operations;

CREATE POLICY "Admins can insert operations" ON public.operations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles: explicit admin-only delete policy (previously no policy = fail-closed, but scanner asked for one)
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- has_role: switch to SECURITY INVOKER so it no longer bypasses RLS.
-- RLS on user_roles already lets a user see their own row, which is all
-- has_role(auth.uid(), ...) needs. Service role callers still bypass RLS.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;
