CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

INSERT INTO public.app_settings (key, value)
SELECT 'worker_pin_hash', encode(extensions.digest(value, 'sha256'), 'hex')
FROM public.app_settings
WHERE key = 'worker_pin'
  AND NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'worker_pin_hash');

DELETE FROM public.app_settings WHERE key = 'worker_pin';