import { supabase } from '@/integrations/supabase/client';

/** R2 (Cloudflare) ga rasm yuklash — edge function orqali, faqat admin. */
export async function uploadToR2(blob: Blob, ext: string, contentType: string): Promise<string> {
  const form = new FormData();
  form.append('file', new File([blob], `image.${ext}`, { type: contentType }));

  const { data, error } = await supabase.functions.invoke('r2-upload', { body: form });
  if (error) throw new Error(await readFnError(error));
  if (!data?.url) throw new Error('R2 public URL sozlanmagan');
  return data.url as string;
}

export async function deleteFromR2(imageUrl: string): Promise<void> {
  const key = r2KeyFromUrl(imageUrl);
  if (!key) return;
  await supabase.functions.invoke('r2-upload?action=delete', { body: { key } });
}

export function isR2Url(v: string | null | undefined): boolean {
  return !!v && /^https?:\/\//.test(v);
}

function r2KeyFromUrl(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/^\/+/, '');
  } catch {
    return null;
  }
}

async function readFnError(error: unknown): Promise<string> {
  const anyErr = error as { context?: { text?: () => Promise<string> }; message?: string };
  try {
    if (anyErr?.context?.text) {
      const t = await anyErr.context.text();
      try {
        const j = JSON.parse(t);
        return j.error || j.details || t;
      } catch {
        return t;
      }
    }
  } catch { /* ignore */ }
  return anyErr?.message || 'Nomaʼlum xatolik';
}
