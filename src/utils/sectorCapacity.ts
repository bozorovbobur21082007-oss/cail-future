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
 * Sektorda yangi miqdor sig'adimi tekshiradi.
 * @param sectorId — mahsulot biriktirilgan sektor id
 * @param addingQty — qo'shilayotgan dona soni (musbat)
 * @param excludeProductId — mavjud mahsulotning eski miqdorini hisobdan chiqarish uchun
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
    .select('id, name, code, capacity')
    .eq('id', sectorId)
    .maybeSingle();
  if (sErr || !sector) return { ok: true };

  const { data: items } = await supabase
    .from('products')
    .select('id, quantity')
    .eq('sector_id', sectorId);

  const used = (items || []).reduce(
    (sum, p) => sum + (p.id === excludeProductId ? 0 : (p.quantity || 0)),
    0,
  );
  const capacity = sector.capacity || 0;
  const remaining = Math.max(0, capacity - used);

  if (addingQty > remaining) {
    return {
      ok: false,
      sectorName: sector.name,
      sectorCode: sector.code,
      capacity,
      used,
      remaining,
      message:
        `Javonda joy qolmagan: "${sector.name}" (${sector.code}) — sig'imi ${capacity}, ` +
        `band ${used}, bo'sh ${remaining}. Siz ${addingQty} dona qo'shmoqchisiz. ` +
        `Iltimos, yangi javon yarating yoki mahsulotni boshqa sektorga biriktiring.`,
    };
  }
  return { ok: true, sectorName: sector.name, capacity, used, remaining };
}
