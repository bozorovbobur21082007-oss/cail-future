/**
 * Yorliq chop etish utiliti — QR yoki Barkod bilan termal yorliq.
 * ProductsPage va OperationsPage da qayta ishlatiladi.
 */

import { toast } from 'sonner';

export interface PrintLabelOptions {
  productCode: string;
  productName: string;
  sectorCode?: string;
  /** PNG data URL (canvas.toDataURL('image/png')) */
  codeImageDataUrl: string;
  format: 'qr' | 'barcode';
  /** Yorliq o'lchami konfiguratsiyasi */
  size: { w: number; h: number; qr: number; layout: 'horizontal' | 'vertical'; label: string };
  compact?: boolean;
}

export function printLabel(opts: PrintLabelOptions): boolean {
  const { productCode, productName, sectorCode, codeImageDataUrl, format, size, compact } = opts;
  const printWindow = window.open('', '_blank', 'width=400,height=500');
  if (!printWindow) {
    toast.error("Brauzer chop etish oynasini bloklab qo'ydi. Pop-up ruxsatini bering.");
    return false;
  }

  const safeName = (productName || '').replace(/</g, '&lt;');
  const code = productCode;
  const cfg = size;
  const isHorizontal = cfg.layout === 'horizontal';
  const useCompact = !!compact && isHorizontal;
  const isBarcode = format === 'barcode';

  const bcW = isHorizontal ? Math.round(cfg.w * 0.6) : Math.round(cfg.w * 0.85);
  const bcH = isHorizontal ? Math.max(6, cfg.h - 4) : Math.max(8, Math.round(cfg.h * 0.45));

  const horizontalCss = `
    .label { display: flex; align-items: center; gap: 1.5mm; width: ${cfg.w}mm; height: ${cfg.h}mm; padding: 1mm; border: 1px dashed #999; border-radius: 1mm; }
    .label img.code-img { ${isBarcode ? `width: ${bcW}mm; height: ${bcH}mm;` : `width: ${cfg.qr}mm; height: ${cfg.qr}mm;`} flex-shrink: 0; display: block; object-fit: contain; }
    .text { flex: 1; min-width: 0; overflow: hidden; }
    .name { font-size: 7pt; font-weight: 700; line-height: 1.1; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .sector { font-family: monospace; font-size: 9pt; font-weight: 700; line-height: 1.1; letter-spacing: 0.5px; }
    .code { font-family: monospace; font-size: 6pt; color: #333; margin-top: 0.5mm; word-break: break-all; }
    .code-big { font-family: monospace; font-size: 8pt; font-weight: 600; color: #111; margin-top: 1mm; word-break: break-all; }
    @media print {
      body { padding: 0; min-height: auto; display: block; }
      .label { border: none; padding: 0.5mm; border-radius: 0; }
      @page { size: ${cfg.w}mm ${cfg.h}mm; margin: 0; }
    }
  `;

  const verticalCss = `
    .label { border: 1px dashed #999; padding: 4mm; text-align: center; border-radius: 8px; width: ${cfg.w}mm; }
    .label img.code-img { display: block; margin: 0 auto; ${isBarcode ? `width: ${bcW}mm; height: ${bcH}mm;` : `width: ${cfg.qr}mm; height: ${cfg.qr}mm;`} object-fit: contain; }
    .name { font-size: ${Math.max(8, Math.round(cfg.w / 6))}pt; font-weight: 600; margin-top: 2mm; word-break: break-word; line-height: 1.2; }
    .code { font-family: monospace; font-size: ${Math.max(6, Math.round(cfg.w / 8))}pt; color: #555; margin-top: 1mm; }
    @media print {
      body { padding: 0; min-height: auto; display: block; }
      .label { border: none; padding: 2mm; border-radius: 0; }
      @page { size: ${cfg.w + 4}mm ${cfg.h + 14}mm; margin: 2mm; }
    }
  `;

  const compactInner = `<div class="text">${sectorCode ? `<div class="sector">${sectorCode}</div>` : ''}<div class="${sectorCode ? 'code-big' : 'sector'}">${code}</div></div>`;
  const fullInner = `<div class="text"><div class="name">${safeName}</div><div class="code">${code}</div></div>`;

  const altLabel = isBarcode ? 'Barkod' : 'QR';
  const labelHtml = isHorizontal
    ? `<div class="label"><img class="code-img" src="${codeImageDataUrl}" alt="${altLabel}" />${useCompact ? compactInner : fullInner}</div>`
    : `<div class="label"><img class="code-img" src="${codeImageDataUrl}" alt="${altLabel}" /><div class="name">${safeName}</div><div class="code">${code}</div></div>`;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${altLabel} — ${code}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
          ${isHorizontal ? horizontalCss : verticalCss}
        </style>
      </head>
      <body>
        ${labelHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
              window.onafterprint = function() { window.close(); };
            }, 200);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
  toast.success(`Chop etish oynasi ochildi (${cfg.label}, ${altLabel})`);
  return true;
}

/** Termal 15×40mm default konfiguratsiyasi */
export const THERMAL_15X40 = {
  w: 40,
  h: 15,
  qr: 12,
  layout: 'horizontal' as const,
  label: 'Termal 15×40mm',
};
