-- NFC ID takrorlanmasligini ta'minlash uchun unique partial index
-- (NULL qiymatlar cheklamaydi — NFC siz mahsulotlar bemalol ko'p bo'lishi mumkin)
CREATE UNIQUE INDEX IF NOT EXISTS products_nfc_id_unique
ON public.products (nfc_id)
WHERE nfc_id IS NOT NULL;