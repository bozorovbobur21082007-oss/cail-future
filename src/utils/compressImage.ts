// Rasmni yuklashdan oldin siqish: max 800px, WebP, ~0.75 sifat
export async function compressImage(
  file: File,
  maxSize = 800,
  quality = 0.75
): Promise<{ blob: Blob; ext: string; contentType: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no ctx');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality)
    );
    if (!blob) throw new Error('no blob');
    // Agar siqilgan variant kattaroq bo'lsa — originalni qoldiramiz
    if (blob.size >= file.size) throw new Error('not smaller');
    return { blob, ext: 'webp', contentType: 'image/webp' };
  } catch {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    return { blob: file, ext, contentType: file.type || 'image/jpeg' };
  }
}
