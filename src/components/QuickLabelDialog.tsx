import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Printer, QrCode, Barcode as BarcodeIcon, Camera, Radio } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import Barcode from '@/components/Barcode';
import NfcScanner from '@/components/NfcScanner';
import QrScanner from '@/components/QrScanner';
import { toast } from 'sonner';
import { printLabel, THERMAL_15X40 } from '@/utils/printLabel';
import { useScannerMode } from '@/hooks/useScannerMode';
import { useAuth } from '@/contexts/AuthContext';

interface QuickLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** approved=false (ishchi yaratganida tasdiq kutsin), true (admin) */
  approved?: boolean;
  /** Mahsulot yaratilgandan keyin chaqiriladi */
  onCreated?: () => void;
}

type IdMethod = 'auto' | 'manual' | 'nfc';

export default function QuickLabelDialog({ open, onOpenChange, approved = false, onCreated }: QuickLabelDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [idMethod, setIdMethod] = useState<IdMethod>('auto');
  const [manualCode, setManualCode] = useState('');
  const [nfcId, setNfcId] = useState('');
  const [showNfcScanner, setShowNfcScanner] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [format, setFormat] = useState<'qr' | 'barcode'>('qr');
  const [submitting, setSubmitting] = useState(false);
  const [createdProduct, setCreatedProduct] = useState<{ code: string; name: string } | null>(null);
  const [scannerMode] = useScannerMode();

  const qrRef = useRef<HTMLCanvasElement>(null);
  const barcodeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setName('');
      setIdMethod('auto');
      setManualCode('');
      setNfcId('');
      setShowNfcScanner(false);
      setShowQrScanner(false);
      setFormat('qr');
      setCreatedProduct(null);
    }
  }, [open]);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Mahsulot nomini kiriting');
      return;
    }

    setSubmitting(true);
    try {
      // Bir xil nomdagi mahsulot bor-yo'qligini tekshirish
      const { data: existing } = await supabase
        .from('products')
        .select('id, name')
        .ilike('name', trimmedName)
        .limit(1)
        .maybeSingle();
      if (existing) {
        toast.error(`"${trimmedName}" nomli mahsulot allaqachon mavjud. Boshqa nom tanlang.`);
        setSubmitting(false);
        return;
      }

      const payload: any = {
        name: trimmedName,
        quantity: 0,
        low_stock_threshold: 10,
        approved,
      };
      if (idMethod === 'manual' && manualCode.trim()) {
        payload.product_code = manualCode.trim().toUpperCase();
      }
      if (idMethod === 'nfc' && nfcId.trim()) {
        payload.nfc_id = nfcId.trim().toUpperCase();
      }

      const { data, error } = await supabase
        .from('products')
        .insert(payload)
        .select('product_code, name')
        .single();

      if (error) throw error;
      setCreatedProduct({ code: data.product_code, name: data.name });
      onCreated?.();
      setStep(2);
      toast.success(approved ? "Mahsulot yaratildi" : "Mahsulot yaratildi — admin tasdig'i kutilmoqda");
    } catch (err: any) {
      toast.error(err.message || 'Xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (!createdProduct) return;
    const canvas = format === 'qr' ? qrRef.current : barcodeRef.current;
    if (!canvas) {
      toast.error('Kod hali yuklanmagan, biroz kuting');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    printLabel({
      productCode: createdProduct.code,
      productName: createdProduct.name,
      codeImageDataUrl: dataUrl,
      format,
      size: THERMAL_15X40,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Yangi mahsulot + yorliq' : 'Yorliqni chop etish'}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Mahsulot nomini kiriting va kod turini tanlang. Tizim avtomatik kod generatsiya qiladi."
              : `"${createdProduct?.name}" uchun yorliq tayyor. Printerga chiqaring va mahsulotga yopishtiring.`}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ql-name">Mahsulot nomi</Label>
              <Input
                id="ql-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan: Sement 50kg"
              />
            </div>

            <div className="space-y-2">
              <Label>Identifikator turi</Label>
              <RadioGroup value={idMethod} onValueChange={(v) => setIdMethod(v as IdMethod)}>
                <div className="flex items-start gap-2 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer" onClick={() => setIdMethod('auto')}>
                  <RadioGroupItem value="auto" id="auto" className="mt-0.5" />
                  <Label htmlFor="auto" className="flex-1 cursor-pointer font-normal">
                    <span className="font-medium block">Avtomatik kod</span>
                    <span className="text-xs text-muted-foreground">Tizim 8 belgili noyob kod yaratadi (eng oson)</span>
                  </Label>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer" onClick={() => setIdMethod('manual')}>
                  <RadioGroupItem value="manual" id="manual" className="mt-0.5" />
                  <Label htmlFor="manual" className="flex-1 cursor-pointer font-normal">
                    <span className="font-medium block">Mavjud QR/Barkod</span>
                    <span className="text-xs text-muted-foreground">Mahsulotda zavod barkod bo'lsa, skanerlang yoki kiriting</span>
                  </Label>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer" onClick={() => setIdMethod('nfc')}>
                  <RadioGroupItem value="nfc" id="nfc" className="mt-0.5" />
                  <Label htmlFor="nfc" className="flex-1 cursor-pointer font-normal">
                    <span className="font-medium block">NFC teg</span>
                    <span className="text-xs text-muted-foreground">Mahsulotga NFC nakleyka yopishtirilgan bo'lsa</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {idMethod === 'manual' && (
              <div className="space-y-2">
                <Label>QR/Barkod qiymati</Label>
                <div className="flex gap-2">
                  <Input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Skanerlang yoki qo'lda kiriting..."
                    autoFocus={scannerMode}
                  />
                  {!scannerMode && (
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowQrScanner(true)}>
                      <Camera className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {idMethod === 'nfc' && (
              <div className="space-y-2">
                <Label>NFC ID</Label>
                <div className="flex gap-2">
                  <Input
                    value={nfcId}
                    onChange={(e) => setNfcId(e.target.value)}
                    placeholder="USB RFID o'quvchi yoki qo'lda..."
                    autoFocus={scannerMode}
                  />
                  {!scannerMode && (
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowNfcScanner(true)}>
                      <Radio className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {showQrScanner && (
              <QrScanner
                onScan={(v) => { setShowQrScanner(false); setManualCode(v); }}
                onClose={() => setShowQrScanner(false)}
              />
            )}
            {showNfcScanner && (
              <NfcScanner
                onScan={(v) => { setShowNfcScanner(false); setNfcId(v); }}
                onClose={() => setShowNfcScanner(false)}
                title="NFC tegni skanerlang"
              />
            )}
          </div>
        )}

        {step === 2 && createdProduct && (
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
                  value={createdProduct.code}
                  size={180}
                  level="M"
                  includeMargin
                />
              ) : (
                <Barcode
                  ref={barcodeRef}
                  value={createdProduct.code}
                  format="CODE128"
                  width={2}
                  height={60}
                  fontSize={14}
                />
              )}
              <div className="text-center">
                <p className="font-medium text-sm">{createdProduct.name}</p>
                <p className="text-xs font-mono text-muted-foreground mt-1">{createdProduct.code}</p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
              Termal printer (15×40mm) uchun tayyor. Chop etib mahsulotga yopishtiring.
              {!approved && <span className="block mt-1 text-warning">⚠ Admin tasdig'i kutilmoqda — Kirim/Chiqim hozircha ishlaydi.</span>}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
              <Button onClick={handleCreate} disabled={submitting || !name.trim()}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Yarat va davom et
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Yopish</Button>
              <Button onClick={handlePrint} className="gap-2">
                <Printer className="w-4 h-4" />
                Chop etish
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
