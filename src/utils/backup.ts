import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';

// Tables included in backup/restore (skip auth-linked ones)
export const BACKUP_TABLES = [
  'sectors',
  'shelves',
  'products',
  'product_placements',
  'workers',
  'operations',
  'app_settings',
] as const;

export type BackupTable = typeof BACKUP_TABLES[number];

export interface BackupData {
  version: number;
  created_at: string;
  tables: Record<string, any[]>;
}

export async function exportBackup(): Promise<Blob> {
  const tables: Record<string, any[]> = {};
  for (const t of BACKUP_TABLES) {
    const { data, error } = await supabase.from(t).select('*');
    if (error) throw new Error(`${t}: ${error.message}`);
    tables[t] = data || [];
  }

  const payload: BackupData = {
    version: 1,
    created_at: new Date().toISOString(),
    tables,
  };

  const zip = new JSZip();
  zip.file('backup.json', JSON.stringify(payload, null, 2));
  for (const [name, rows] of Object.entries(tables)) {
    zip.file(`tables/${name}.json`, JSON.stringify(rows, null, 2));
  }
  return await zip.generateAsync({ type: 'blob' });
}

export async function readBackupZip(file: File): Promise<BackupData> {
  const zip = await JSZip.loadAsync(file);
  const main = zip.file('backup.json');
  if (!main) throw new Error("Bu ZIP faylda 'backup.json' topilmadi");
  const text = await main.async('string');
  const parsed = JSON.parse(text) as BackupData;
  if (!parsed.tables || typeof parsed.tables !== 'object') {
    throw new Error("ZIP fayl noto'g'ri formatda");
  }
  return parsed;
}

// Restore order — parents first so FKs resolve
const RESTORE_ORDER: BackupTable[] = [
  'sectors',
  'shelves',
  'products',
  'workers',
  'product_placements',
  'operations',
  'app_settings',
];

export interface RestoreProgress {
  table: string;
  count: number;
  status: 'ok' | 'error';
  message?: string;
}

export async function restoreBackup(
  data: BackupData,
  onProgress?: (p: RestoreProgress) => void
): Promise<void> {
  // Delete in reverse order
  for (const t of [...RESTORE_ORDER].reverse()) {
    // Skip app_settings deletion (keep current keys stable) — we'll upsert instead
    if (t === 'app_settings') continue;
    const { error } = await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      onProgress?.({ table: t, count: 0, status: 'error', message: `Tozalash xatosi: ${error.message}` });
      throw new Error(`${t} tozalashda xatolik: ${error.message}`);
    }
  }

  // Insert in forward order
  for (const t of RESTORE_ORDER) {
    const rows = data.tables[t] || [];
    if (rows.length === 0) {
      onProgress?.({ table: t, count: 0, status: 'ok' });
      continue;
    }
    // Chunk inserts to avoid payload limits
    const chunkSize = 200;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const query = t === 'app_settings'
        ? supabase.from(t).upsert(chunk, { onConflict: 'key' })
        : supabase.from(t).insert(chunk);
      const { error } = await query;
      if (error) {
        onProgress?.({ table: t, count: inserted, status: 'error', message: error.message });
        throw new Error(`${t}: ${error.message}`);
      }
      inserted += chunk.length;
    }
    onProgress?.({ table: t, count: inserted, status: 'ok' });
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
