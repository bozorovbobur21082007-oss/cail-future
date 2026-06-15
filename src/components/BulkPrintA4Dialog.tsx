import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Printer, QrCode, Barcode as BarcodeIcon, Search } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import Barcode from '@/components/Barcode';
import { toast } from 'sonner';

interface ProductItem {
  id: string;
  product_code: string;
  name: string;
}

interface BulkPrintA4DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductItem[];
  /** Boshlang'ich tanlangan ID lar (masalan filterlangan ro'yxat) */
  initialSelectedIds?: string[];
}

type CodeFormat = 'qr' | 'barcode';
type Cols = 2 | 3 | 4 | 5;

/**
 * Bir nechta mahsulotning QR yoki Barkodini bitta A4 listga chop etish.
 * Har bir katak ostida mahsulot nomi va kodi yoziladi.
 */
export default function BulkPrintA4Dialog({
  open,
  onOpenChange,
  products,
  initialSelectedIds,
}: BulkPrintA4DialogProps) {
  const [format, setFormat] = useState<CodeFormat>('qr');
  const [cols, setCols] = useState<Cols>(4);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelectedIds && initialSelectedIds.length > 0 ? initialSelectedIds : products.map(p => p.id)));
      setSearch('');
    }
  }, [open, initialSelectedIds, products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q));
  }, [products, search]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => setSelected(new Set([...selected, ...filtered.map(p => p.id)]));
  const clearAll = () => setSelected(new Set());

  const selectedProducts = useMemo(
    () => products.filter(p => selected.has(p.id)),
    [products, selected],
  );

  const handlePrint = () => {
    if (selectedProducts.length === 0) {
      toast.error('Kamida bitta mahsulotni tanlang');
      return;
    }

    // Har bir tanlangan mahsulot uchun canvas dan PNG olamiz
    const items = selectedProducts.map(p => {
      const canvas = canvasRefs.current[p.id];
      const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
      return { ...p, dataUrl };
    });

    if (items.some(i => !i.dataUrl)) {
      toast.error('Kodlar hali tayyor emas, biroz kuting va qayta urinib ko\'ring');
      return;
    }

    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) {
      toast.error("Brauzer chop etish oynasini bloklab qo'ydi. Pop-up ruxsatini bering.");
      return;
    }

    // A4 = 210×297mm. Sahifa margin 10mm. Grid kataklari uchun gap 4mm.
    // Har bir katak: kod tasviri + nomi + product_code.
    const cellsHtml = items
      .map(it => {
        const safeName = (it.name || '').replace(/</g, '&lt;');
        return `
          <div class="cell">
            <div class="code-wrap">
              <img class="code-img" src="${it.dataUrl}" alt="${format === 'qr' ? 'QR' : 'Barkod'}" />
            </div>
            <div class="name">${safeName}</div>
            <div class="code">${it.product_code}</div>
          </div>
        `;
      })
      .join('\n');

    // Kod tasviri balandligi ustun soniga qarab moslashadi
    const imgMaxH = format === 'qr' ? `${Math.round(140 / cols + 20)}mm` : `${Math.round(80 / cols + 14)}mm`;
    const nameFs = cols >= 4 ? '8pt' : cols === 3 ? '10pt' : '11pt';
    const codeFs = cols >= 4 ? '7pt' : '8pt';

    win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>A4 yorliqlar — ${items.length} ta mahsulot</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 10mm;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
        color: #111;
        background: #fff;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(${cols}, 1fr);
        gap: 4mm;
      }
      .cell {
        border: 1px dashed #bbb;
        border-radius: 4px;
        padding: 3mm 2mm;
        text-align: center;
        page-break-inside: avoid;
        break-inside: avoid;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        gap: 1.5mm;
      }
      .code-wrap {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .code-img {
        max-width: 100%;
        max-height: ${imgMaxH};
        height: auto;
        display: block;
        object-fit: contain;
      }
      .name {
        font-size: ${nameFs};
        font-weight: 600;
        line-height: 1.15;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: ${codeFs};
        color: #555;
        word-break: break-all;
      }
      @media print {
        body { padding: 8mm; }
        .cell { border: 1px solid #ddd; }
        @page { size: A4; margin: 8mm; }
      }
    </style>
  </head>
  <body>
    <div class="grid">${cellsHtml}</div>
    <script>
      window.onload = function() {
        setTimeout(function() {
          window.focus();
          window.print();
          window.onafterprint = function() { window.close(); };
        }, 300);
      };
    </script>
  </body>
</html>`);
    win.document.close();
    toast.success(`A4 chop etish oynasi ochildi (${items.length} ta yorliq)`);
  };

  // QR uchun pixel hajmi — sifat uchun yetarli, lekin og'ir bo'lmasin
  const qrSize = 256;
  const barcodeWidth = 2;
  const barcodeHeight = 60;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>A4 listga yorliqlarni chop etish</DialogTitle>
          <DialogDescription>
            Tanlangan mahsulotlar uchun QR yoki Barkod bitta A4 listga joylashtiriladi. Har bir katak ostida mahsulot nomi va kodi yoziladi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format va ustunlar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Kod formati</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={format === 'qr' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormat('qr')}
                  className="gap-2"
                >
                  <QrCode className="w-4 h-4" /> QR kod
                </Button>
                <Button
                  type="button"
                  variant={format === 'barcode' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormat('barcode')}
                  className="gap-2"
                >
                  <BarcodeIcon className="w-4 h-4" /> Barkod
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Bir qatordagi yorliqlar soni</Label>
              <div className="grid grid-cols-4 gap-2">
                {([2, 3, 4, 5] as Cols[]).map(c => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={cols === c ? 'default' : 'outline'}
                    onClick={() => setCols(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Tanlash paneli */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-xs text-muted-foreground">
                Mahsulotlar ({selected.size} / {products.length} tanlandi)
              </Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
                  Hammasini tanlash
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                  Tozalash
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Qidirish (nomi yoki kod)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Natija topilmadi</div>
              ) : (
                filtered.map(p => {
                  const checked = selected.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 p-2.5 hover:bg-muted/40 cursor-pointer"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(p.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-[11px] font-mono text-muted-foreground truncate">{p.product_code}</div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-md">
            Tavsiya: QR uchun 4 ustun, Barkod uchun 2-3 ustun yaxshiroq chiqadi.
          </div>
        </div>

        {/* Yashirin renderer — har bir tanlangan mahsulot uchun canvas tayyorlaymiz */}
        <div className="sr-only" aria-hidden="true">
          {selectedProducts.map(p => (
            <div key={p.id}>
              {format === 'qr' ? (
                <QRCodeCanvas
                  ref={(el: any) => {
                    canvasRefs.current[p.id] = el as HTMLCanvasElement | null;
                  }}
                  value={p.product_code}
                  size={qrSize}
                  level="M"
                  includeMargin
                />
              ) : (
                <Barcode
                  ref={(el) => {
                    canvasRefs.current[p.id] = el;
                  }}
                  value={p.product_code}
                  format="CODE128"
                  width={barcodeWidth}
                  height={barcodeHeight}
                  fontSize={14}
                />
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button onClick={handlePrint} className="gap-2" disabled={selected.size === 0}>
            <Printer className="w-4 h-4" />
            A4 ga chop etish ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
