import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Printer, QrCode, Barcode as BarcodeIcon, Minus, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { QRCodeCanvas } from 'qrcode.react';
import Barcode from '@/components/Barcode';
import { toast } from 'sonner';
import { printLabel, THERMAL_76X39 } from '@/utils/printLabel';

interface PrintLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productCode: string;
  productName: string;
  /** Qo'shimcha kontekst — masalan "+1 dona qo'shildi" */
  contextHint?: string;
  /** Boshlang'ich nusxa soni (masalan IN miqdori). Default: 1 */
  defaultCopies?: number;
}

const MIN_COPIES = 1;
const MAX_COPIES = 10;
const clampCopies = (n: number) => Math.max(MIN_COPIES, Math.min(MAX_COPIES, Math.floor(n) || MIN_COPIES));

/**
 * Mavjud mahsulot uchun yorliq chop etish dialogi.
 * IN operatsiyasidan keyin avtomatik chiqariladi: ishchi qutiga yopishtirsin.
 */
export default function PrintLabelDialog({
  open,
  onOpenChange,
  productCode,
  productName,
  contextHint,
  defaultCopies = 1,
}: PrintLabelDialogProps) {
  const [format, setFormat] = useState<'qr' | 'barcode'>('barcode');
  const [copies, setCopies] = useState(() => clampCopies(defaultCopies));
  const qrRef = useRef<HTMLCanvasElement>(null);
  const barcodeRef = useRef<HTMLCanvasElement>(null);

  // Dialog har ochilganda nusxa sonini default qiymatga qaytaramiz
  useEffect(() => {
    if (open) setCopies(clampCopies(defaultCopies));
  }, [open, defaultCopies]);

  const handlePrint = () => {
    const canvas = format === 'qr' ? qrRef.current : barcodeRef.current;
    if (!canvas) {
      toast.error('Kod hali yuklanmagan, biroz kuting');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    printLabel({
      productCode,
      productName,
      codeImageDataUrl: dataUrl,
      format,
      size: THERMAL_76X39,
      copies,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yorliqni chop etish</DialogTitle>
          <DialogDescription>
            {contextHint
              ? `${contextHint}. Yangi qutiga yorliq yopishtirish uchun chop eting.`
              : `"${productName}" uchun yorliqni printerga chiqaring va mahsulotga yopishtiring.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
                <QrCode className="w-4 h-4" />
                QR kod
              </Button>
              <Button
                type="button"
                variant={format === 'barcode' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormat('barcode')}
                className="gap-2"
              >
                <BarcodeIcon className="w-4 h-4" />
                Barkod
              </Button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 py-4 px-4 bg-card border border-border rounded-lg">
            {format === 'qr' ? (
              <QRCodeCanvas
                ref={qrRef as any}
                value={productCode}
                size={180}
                level="M"
                includeMargin
              />
            ) : (
              <Barcode
                ref={barcodeRef}
                value={productCode}
                format="CODE128"
                width={2}
                height={60}
                fontSize={14}
              />
            )}
            <div className="text-center">
              <p className="font-medium text-sm">{productName}</p>
              <p className="text-xs font-mono text-muted-foreground mt-1">{productCode}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="copies-input" className="text-xs text-muted-foreground">Nusxa soni (1-{MAX_COPIES})</Label>
              <span className="text-xs text-muted-foreground">Har bir quti uchun bittadan</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setCopies((c) => clampCopies(c - 1))}
                disabled={copies <= MIN_COPIES}
                aria-label="Kamaytirish"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                id="copies-input"
                type="number"
                min={MIN_COPIES}
                max={MAX_COPIES}
                value={copies}
                onChange={(e) => setCopies(clampCopies(parseInt(e.target.value, 10)))}
                className="text-center font-medium"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setCopies((c) => clampCopies(c + 1))}
                disabled={copies >= MAX_COPIES}
                aria-label="Oshirish"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
            Termal printer (15×40mm) uchun tayyor. Chop etib qutiga yopishtiring.
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>O'tkazib yuborish</Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            {copies > 1 ? `Chop etish (${copies} nusxa)` : 'Chop etish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
