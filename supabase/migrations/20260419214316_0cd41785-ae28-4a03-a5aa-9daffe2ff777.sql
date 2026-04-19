ALTER TABLE public.products
ADD COLUMN approved BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX idx_products_approved ON public.products(approved);