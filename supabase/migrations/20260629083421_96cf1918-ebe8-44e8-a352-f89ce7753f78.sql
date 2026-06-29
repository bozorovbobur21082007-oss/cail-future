
DROP TRIGGER IF EXISTS sectors_sync_capacity ON public.sectors;
DROP TRIGGER IF EXISTS trg_sync_sector_capacity ON public.sectors;
DROP TRIGGER IF EXISTS sync_sector_capacity_trigger ON public.sectors;
DROP FUNCTION IF EXISTS public.sync_sector_capacity() CASCADE;

ALTER TABLE public.sectors
  DROP COLUMN IF EXISTS rows,
  DROP COLUMN IF EXISTS columns,
  DROP COLUMN IF EXISTS levels,
  DROP COLUMN IF EXISTS capacity,
  DROP COLUMN IF EXISTS width_cm,
  DROP COLUMN IF EXISTS depth_cm,
  DROP COLUMN IF EXISTS height_cm;
