-- Create sectors table
CREATE TABLE public.sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT upper(SUBSTRING((gen_random_uuid())::text FROM 1 FOR 4)),
  description TEXT DEFAULT '',
  capacity INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint on code
ALTER TABLE public.sectors ADD CONSTRAINT sectors_code_unique UNIQUE (code);

-- Enable RLS
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view sectors"
ON public.sectors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sectors"
ON public.sectors FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update sectors"
ON public.sectors FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete sectors"
ON public.sectors FOR DELETE TO authenticated USING (true);

-- Add sector_id to products
ALTER TABLE public.products ADD COLUMN sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL;

-- Trigger for updated_at
CREATE TRIGGER update_sectors_updated_at
BEFORE UPDATE ON public.sectors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();