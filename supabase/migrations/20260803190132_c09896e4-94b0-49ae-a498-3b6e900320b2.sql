UPDATE public.app_settings SET value='cail.reserve111@gmail.com', updated_at=now() WHERE key='backup_email';
UPDATE public.app_settings SET value='true', updated_at=now() WHERE key='backup_enabled';