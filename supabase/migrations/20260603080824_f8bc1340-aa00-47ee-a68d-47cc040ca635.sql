-- Recompute capacity for all existing sectors based on physical structure
UPDATE public.sectors
SET capacity = GREATEST(1, rows * columns * levels);

-- Trigger to keep capacity in sync automatically
CREATE OR REPLACE FUNCTION public.sync_sector_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.capacity := GREATEST(1, COALESCE(NEW.rows, 1) * COALESCE(NEW.columns, 1) * COALESCE(NEW.levels, 1));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sectors_sync_capacity ON public.sectors;
CREATE TRIGGER sectors_sync_capacity
BEFORE INSERT OR UPDATE OF rows, columns, levels ON public.sectors
FOR EACH ROW
EXECUTE FUNCTION public.sync_sector_capacity();