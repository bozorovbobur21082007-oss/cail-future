import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Printer, QrCode, Barcode as BarcodeIcon, Camera, ImagePlus, X } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import Barcode from '@/components/Barcode';
import QrScanner from '@/components/QrScanner';
import { toast } from 'sonner';
import { printLabel, THERMAL_76X39 } from '@/utils/printLabel';
import { useScannerMode } from '@/hooks/useScannerMode';
import { useAuth } from '@/contexts/AuthContext';
import { compressImage } from '@/utils/compressImage';
import { uploadToR2 } from '@/utils/r2';


interface QuickLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** approved=false (ishchi yaratganida tasdiq kutsin), true (admin) */
  approved?: boolean;
  /** Mahsulot yaratilgandan keyin chaqiriladi */
  onCreated?: () => void;
}

type IdMethod = 'auto' | 'manual';

export default function QuickLabelDialog({ open, onOpenChange, approved = false, onCreated }: QuickLabelDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [idMethod, setIdMethod] = useState<IdMethod>('auto');
  const [manualCode, setManualCode] = useState('');
  const [price, setPrice] = useState(0);
  const [lowStock, setLowStock] = useState(10);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [format, setFormat] = useState<'qr' | 'barcode'>('barcode');
  const [submitting, setSubmitting] = useState(false);
  const [createdProduct, setCreatedProduct] = useState<{ code: string; name: string } | null>(null);
  const [scannerMode] = useScannerMode();
  const { role, getWorkerToken } = useAuth();
  const isAdmin = role !== 'worker';

  const qrRef = useRef<HTMLCanvasElement>(null);
  const barcodeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setName('');
      setIdMethod('auto');
      setManualCode('');
      setPrice(0);
      setLowStock(10);
      setImageFile(null);
      setImagePreview(null);
      setCapturedFile(null);
      setCapturedPreview(null);
      setShowQrScanner(false);
      setFormat('barcode');
      setCreatedProduct(null);
    }
  }, [open]);

  const pickImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Faqat rasm fayli tanlang');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleCameraCapture = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Faqat rasm fayli tanlang');
      return;
    }
    setCapturedFile(file);
    setCapturedPreview(URL.createObjectURL(file));
  };

  const confirmCapture = () => {
    if (!capturedFile || !capturedPreview) return;
    setImageFile(capturedFile);
    setImagePreview(capturedPreview);
    setCapturedFile(null);
    setCapturedPreview(null);
  };

  const retakeCapture = () => {
    setCapturedFile(null);
    setCapturedPreview(null);
  };



  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Mahsulot nomini kiriting');
      return;
    }

    setSubmitting(true);
    try {
      if (role === 'worker') {
        const token = getWorkerToken();
        if (!token) {
          toast.error('Ishchi sessiyasi topilmadi. Qayta kiring.');
          setSubmitting(false);
          return;
        }
        const payload: Record<string, unknown> = { name: trimmedName };
        if (idMethod === 'manual' && manualCode.trim()) payload.product_code = manualCode.trim();
        const { data: resp, error } = await supabase.functions.invoke('worker-action', {
          body: { token, action: 'create_product', payload },
        });
        if (error || !resp?.ok) {
          if (resp?.error === 'Duplicate name') {
            toast.error(`"${trimmedName}" nomli mahsulot allaqachon mavjud. Boshqa nom tanlang.`);
          } else {
            toast.error(resp?.error || 'Xatolik');
          }
          setSubmitting(false);
          return;
        }
        setCreatedProduct({ code: resp.product.product_code, name: resp.product.name });
        onCreated?.();
        setStep(2);
        toast.success("Mahsulot yaratildi — admin tasdig'i kutilmoqda");
        return;
      }

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
        low_stock_threshold: lowStock || 10,
        price: Number(price) || 0,
        approved,
      };
      if (idMethod === 'manual' && manualCode.trim()) {
        payload.product_code = manualCode.trim().toUpperCase();
      }
      // Agar foydalanuvchi rasmga olib "Tasdiqlash"ni bosmagan bo'lsa ham, rasm yo'qolmasin
      const fileToUpload = imageFile ?? capturedFile;
      if (fileToUpload) {
        try {
          const { blob, ext, contentType } = await compressImage(fileToUpload);
          payload.image_url = await uploadToR2(blob, ext, contentType);
        } catch (e: any) {
          toast.error('Rasm yuklanmadi: ' + (e?.message || 'xatolik'));
          setSubmitting(false);
          return;
        }
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
      size: THERMAL_76X39,
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

            {isAdmin && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="ql-price">Narxi (birlik, so'm)</Label>
                    <Input
                      id="ql-price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ql-low">Kam qolish chegarasi</Label>
                    <Input
                      id="ql-low"
                      type="number"
                      min={1}
                      value={lowStock}
                      onChange={(e) => setLowStock(parseInt(e.target.value) || 10)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Mahsulot rasmi</Label>
                  {capturedPreview ? (
                    <div className="space-y-3">
                      <div className="relative w-full max-w-xs aspect-video">
                        <img src={capturedPreview} alt="Tasdiqlash uchun rasm" className="w-full h-full object-cover rounded-md border border-border" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={confirmCapture}>
                          Tasdiqlash
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={retakeCapture}>
                          Qayta olish
                        </Button>
                      </div>
                    </div>
                  ) : imagePreview ? (
                    <div className="relative w-24 h-24">
                      <img src={imagePreview} alt="Mahsulot rasmi" className="w-24 h-24 object-cover rounded-md border border-border" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 w-6 h-6"
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border cursor-pointer hover:bg-muted/30 text-sm text-muted-foreground">
                        <ImagePlus className="w-4 h-4" />
                        Rasm tanlash
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border cursor-pointer hover:bg-muted/30 text-sm text-muted-foreground">
                        <Camera className="w-4 h-4" />
                        Rasmga olish
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => handleCameraCapture(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground">Rasm avtomatik siqiladi (WebP, ~100KB).</p>
                </div>
              </>
            )}



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

            {showQrScanner && (
              <QrScanner
                onScan={(v) => { setShowQrScanner(false); setManualCode(v); }}
                onClose={() => setShowQrScanner(false)}
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
                  displayValue={false}
                  margin={0}
                />
              )}
              <div className="text-center">
                <p className="font-medium text-sm">{createdProduct.name}</p>
                <p className="text-xs font-mono text-muted-foreground mt-1">{createdProduct.code}</p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
              Termal printer uchun tayyor. Chop etib mahsulotga yopishtiring.
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
