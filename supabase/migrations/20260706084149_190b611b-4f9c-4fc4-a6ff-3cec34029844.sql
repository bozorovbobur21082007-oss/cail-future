
CREATE OR REPLACE FUNCTION public.is_subscription_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN COALESCE(
        (SELECT value FROM public.app_settings WHERE key = 'subscription_enabled' LIMIT 1),
        'false'
      ) <> 'true' THEN true
      ELSE COALESCE(
        (SELECT (value::timestamptz > now())
           FROM public.app_settings
           WHERE key = 'subscription_expires_at'
           LIMIT 1),
        false
      )
    END;
$$;
