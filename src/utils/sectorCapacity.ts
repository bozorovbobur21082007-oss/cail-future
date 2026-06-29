import { supabase } from '@/integrations/supabase/client';

export interface CapacityCheck {
  ok: boolean;
  sectorName?: string;
  sectorCode?: string;
  capacity?: number;
  used?: number;
  remaining?: number;
  message?: string;
}

/**
 * Xona (sektor) sig'imi — ichidagi barcha shkaflarning yig'indisi.
 * Tekshiradi: qo'shilayotgan miqdor sig'adimi.
 */
export async function checkSectorCapacity(
  sectorId: string | null | undefined,
  addingQty: number,
  excludeProductId?: string,
): Promise<CapacityCheck> {
  if (!sectorId) return { ok: true };
  if (addingQty <= 0) return { ok: true };

  const { data: sector, error: sErr } = await supabase
    .from('sectors')
    .select('id, name, code')
    .eq('id', sectorId)
    .maybeSingle();
  if (sErr || !sector) return { ok: true };

  // Xonadagi barcha shkaflarning sig'imi yig'indisi
  const { data: shelves } = await supabase
    .from('shelves')
    .select('capacity')
    .eq('sector_id', sectorId);
  const capacity = (shelves || []).reduce((s, sh: any) => s + (sh.capacity || 0), 0);

  const { data: items } = await supabase
    .from('products')
    .select('id, quantity')
    .eq('sector_id', sectorId);

  const used = (items || []).reduce(
    (sum, p) => sum + (p.id === excludeProductId ? 0 : (p.quantity || 0)),
    0,
  );
  const remaining = Math.max(0, capacity - used);

  if (capacity === 0) {
    return {
      ok: false,
      sectorName: sector.name,
      sectorCode: sector.code,
      capacity: 0,
      used,
      remaining: 0,
      message:
        `Xonada hali shkaf yo'q: "${sector.name}" (${sector.code}). ` +
        `Avval kamida bitta shkaf yarating yoki mahsulotni boshqa xonaga biriktiring.`,
    };
  }

  if (addingQty > remaining) {
    return {
      ok: false,
      sectorName: sector.name,
      sectorCode: sector.code,
      capacity,
      used,
      remaining,
      message:
        `Xonada joy qolmagan: "${sector.name}" (${sector.code}) — sig'imi ${capacity}, ` +
        `band ${used}, bo'sh ${remaining}. Siz ${addingQty} dona qo'shmoqchisiz. ` +
        `Iltimos, yangi shkaf qo'shing yoki mahsulotni boshqa xonaga biriktiring.`,
    };
  }
  return { ok: true, sectorName: sector.name, capacity, used, remaining };
}
