ALTER TABLE public.products ADD COLUMN nfc_id TEXT UNIQUE;
CREATE INDEX idx_products_nfc_id ON public.products(nfc_id);