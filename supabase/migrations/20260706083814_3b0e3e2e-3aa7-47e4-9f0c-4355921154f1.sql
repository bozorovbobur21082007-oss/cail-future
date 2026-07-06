
-- Function: is subscription active (based on app_settings.subscription_expires_at)
CREATE OR REPLACE FUNCTION public.is_subscription_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value::timestamptz > now())
       FROM public.app_settings
       WHERE key = 'subscription_expires_at'
       LIMIT 1),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_subscription_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_subscription_active() TO authenticated, service_role;

-- Add an expiry-gated policy on business tables. Existing policies stay; we
-- add a restrictive layer so ALL access requires an active subscription.
-- app_settings, user_roles, profiles are intentionally excluded so the
-- expiration screen and role/gate logic keep working.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','operations','product_placements','sectors','shelves','workers']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "subscription_required" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "subscription_required" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_subscription_active()) WITH CHECK (public.is_subscription_active())',
      t
    );
  END LOOP;
END $$;
