import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ScanLine, CheckCircle2, XCircle, ArrowUpCircle,
  Loader2, UserCheck, Package, AlertTriangle, Info, Camera, Radio
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorMessages';
import QrScanner from '@/components/QrScanner';
import NfcScanner from '@/components/NfcScanner';
import { useScannerMode } from '@/hooks/useScannerMode';
import { useSoundFeedback } from '@/hooks/useSoundFeedback';

interface Worker {
  id: string;
  full_name: string;
  badge_id: string;
  role: string;
}

interface Product {
  id: string;
  product_code: string;
  name: string;
  quantity: number;
  nfc_id: string | null;
}

interface BatchLog {
  id: string;
  action_type: string;
  product_name: string;
  quantity: number;
  created_at: string;
}

export default function OperationsPage() {
  const [step, setStep] = useState(1);
  const [workerBadge, setWorkerBadge] = useState('');
  const [verifiedWorker, setVerifiedWorker] = useState<Worker | null>(null);
  const [productCode, setProductCode] = useState('');
  const [verifiedProduct, setVerifiedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState<{ title: string; detail: string; hint?: string } | null>(null);
  const [batchLogs, setBatchLogs] = useState<BatchLog[]>([]);
  
  const [showProductScanner, setShowProductScanner] = useState(false);
  const [showNfcScanner, setShowNfcScanner] = useState(false);
  const [scannerMode] = useScannerMode();
  const sound = useSoundFeedback();

  const workerInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === 1) workerInputRef.current?.focus();
      if (step === 2) productInputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => { setScanError(null); }, [step]);

  const verifyWorker = useCallback(async (badgeValue?: string) => {
    const badge = (badgeValue || workerBadge).trim();
    if (!badge || loading) return;
    setScanError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.from('workers').select('*').eq('badge_id', badge).single();
      if (error || !data) {
        setScanError({
          title: "Ishchi topilmadi",
          detail: `"${badge}" badge ID bilan ishchi tizimda mavjud emas.`,
          hint: "Badge kartasini qayta skanerlang yoki admin tomonidan ishchi qo'shilganini tekshiring."
        });
        setWorkerBadge('');
      } else {
        setVerifiedWorker(data);
        toast.success(`Ishchi tasdiqlandi: ${data.full_name}`);
        setStep(2);
      }
    } catch {
      setScanError({ title: "Xatolik", detail: "Server bilan aloqa uzildi" });
    } finally {
      setLoading(false);
    }
  }, [workerBadge, loading]);

  const scanProduct = useCallback(async (codeValue?: string) => {
    const code = (codeValue || productCode).trim().toUpperCase();
    if (!code || loading) return;
    setScanError(null);
    setLoading(true);
    try {
      // Ham product_code, ham nfc_id bo'yicha qidiramiz —
      // shunda USB barkod skaner ham, USB RFID o'quvchi ham bir xil maydonga ishlay oladi.
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`product_code.eq.${code},nfc_id.eq.${code}`)
        .maybeSingle();
      if (error || !data) {
        setScanError({
          title: "Mahsulot topilmadi",
          detail: `"${code}" ID bilan mahsulot bazada mavjud emas.`,
          hint: "Kod yoki NFC teg eskirgan, yoki mahsulot hali ombor tizimiga kiritilmagan."
        });
        setProductCode('');
      } else {
        setVerifiedProduct(data);
        if (data.quantity <= 0) {
          setScanError({
            title: "Mahsulot tugagan",
            detail: `"${data.name}" omborda qolmagan (0 dona).`,
            hint: "Mahsulotlar bo'limidan miqdorni yangilang yoki yangi mahsulot qo'shing."
          });
        }
        const via = data.nfc_id && data.nfc_id.toUpperCase() === code ? 'NFC' : 'kod';
        toast.success(`Mahsulot topildi (${via}): ${data.name} (${data.quantity} dona)`);
        setStep(3);
      }
    } catch {
      setScanError({ title: "Server xatosi", detail: "Ma'lumotlar bazasiga ulanishda xatolik." });
    } finally {
      setLoading(false);
    }
  }, [productCode, loading]);

  const scanByNfc = useCallback(async (nfcId: string) => {
    const id = nfcId.trim().toUpperCase();
    if (!id || loading) return;
    setShowNfcScanner(false);
    setScanError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.from('products').select('*').eq('nfc_id', id).single();
      if (error || !data) {
        setScanError({
          title: "NFC teg ro'yxatdan o'tmagan",
          detail: `"${id}" NFC ID bilan mahsulot topilmadi.`,
          hint: "Bu nakleyka biror mahsulotga biriktirilmagan. Avval Mahsulotlar bo'limida ro'yxatdan o'tkazing."
        });
      } else {
        setVerifiedProduct(data);
        if (data.quantity <= 0) {
          setScanError({
            title: "Mahsulot tugagan",
            detail: `"${data.name}" omborda qolmagan (0 dona).`,
            hint: "Mahsulotlar bo'limidan miqdorni yangilang yoki yangi mahsulot qo'shing."
          });
        }
        toast.success(`NFC orqali topildi: ${data.name} (${data.quantity} dona)`);
        setStep(3);
      }
    } catch {
      setScanError({ title: "Server xatosi", detail: "Ma'lumotlar bazasiga ulanishda xatolik." });
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const executeOperation = async () => {
    if (!verifiedWorker || !verifiedProduct) return;
    setScanError(null);
    setLoading(true);
    try {
      const newQty = verifiedProduct.quantity - quantity;

      if (newQty < 0) {
        setScanError({ title: "Yetarli emas", detail: `Omborda faqat ${verifiedProduct.quantity} dona mavjud.` });
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.from('products').update({ quantity: newQty }).eq('id', verifiedProduct.id);
      if (updateError) throw updateError;

      const { data: opData, error: opError } = await supabase.from('operations').insert({
        worker_id: verifiedWorker.id,
        product_id: verifiedProduct.id,
        worker_name: verifiedWorker.full_name,
        product_name: verifiedProduct.name,
        action_type: 'OUT',
        quantity,
      }).select().single();
      if (opError) throw opError;

      toast.success(`Chiqim muvaffaqiyatli: ${verifiedProduct.name} x${quantity}`);
      setBatchLogs(prev => [opData, ...prev].slice(0, 20));

      // Reset for next product scan
      setProductCode('');
      setVerifiedProduct(null);
      setQuantity(1);
      setScanError(null);
      setStep(2);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setStep(1);
    setWorkerBadge('');
    setVerifiedWorker(null);
    setProductCode('');
    setVerifiedProduct(null);
    setQuantity(1);
    setScanError(null);
    setBatchLogs([]);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Chiqim operatsiyalari</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mahsulotni ombordan chiqarish. Kirim uchun Mahsulotlar bo'limidan yangi mahsulot qo'shing.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex items-center gap-2 ${s <= step ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              s < step ? 'bg-primary text-primary-foreground' :
              s === step ? 'bg-primary/10 text-primary border-2 border-primary' :
              'bg-muted text-muted-foreground'
            }`}>{s}</div>
            <span className="text-sm font-medium hidden sm:inline">
              {s === 1 ? 'Ishchi' : s === 2 ? 'Mahsulot' : 'Tasdiqlash'}
            </span>
            {s < 3 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
        {step > 1 && (
          <Button variant="ghost" size="sm" onClick={resetAll} className="ml-auto text-muted-foreground">
            Qayta boshlash
          </Button>
        )}
      </div>

      {/* Scan Error */}
      {scanError && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">{scanError.title}</p>
            <p className="text-xs text-destructive/80 mt-0.5">{scanError.detail}</p>
            {scanError.hint && (
              <p className="text-xs text-destructive/60 mt-1 flex items-center gap-1">
                <Info className="w-3 h-3" /> {scanError.hint}
              </p>
            )}
          </div>
          <button onClick={() => setScanError(null)} className="text-destructive/40 hover:text-destructive">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1: Worker verification */}
      {step === 1 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              1-bosqich: Ishchini tasdiqlash
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Badge ID</Label>
              <div className="flex gap-2">
                <Input
                  ref={workerInputRef}
                  value={workerBadge}
                  onChange={(e) => setWorkerBadge(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && verifyWorker()}
                  placeholder="Badge ID ni kiriting..."
                />
                <Button onClick={() => verifyWorker()} disabled={loading || !workerBadge.trim()}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ishchining Badge ID sini qo'lda kiriting va Enter bosing.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Product scan */}
      {step === 2 && verifiedWorker && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              2-bosqich: Chiqariladigan mahsulotni skanerlash
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Ishchi: <span className="font-medium text-foreground">{verifiedWorker.full_name}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!scannerMode && showNfcScanner ? (
              <NfcScanner
                onScan={(uid) => scanByNfc(uid)}
                onClose={() => setShowNfcScanner(false)}
                title="Mahsulot NFC tegini skanerlang"
              />
            ) : !scannerMode && showProductScanner ? (
              <QrScanner
                onScan={(result) => {
                  setShowProductScanner(false);
                  setProductCode(result);
                  scanProduct(result);
                }}
                onClose={() => setShowProductScanner(false)}
              />
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Mahsulot ID</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={productInputRef}
                      value={productCode}
                      onChange={(e) => setProductCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && scanProduct()}
                      placeholder={scannerMode ? "Skaner gun yoki RFID bilan skanerlang..." : "QR/Barkod yoki NFC ID..."}
                      autoFocus={scannerMode}
                    />
                    <Button onClick={() => scanProduct()} disabled={loading || !productCode.trim()}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {!scannerMode && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setShowProductScanner(true)}>
                      <Camera className="w-4 h-4" />
                      Kamera (QR)
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => setShowNfcScanner(true)}>
                      <Radio className="w-4 h-4" />
                      NFC skaner
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && verifiedWorker && verifiedProduct && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              3-bosqich: Chiqimni tasdiqlash
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Ishchi</p>
                <p className="font-medium">{verifiedWorker.full_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Mahsulot</p>
                <p className="font-medium">{verifiedProduct.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Omborda</p>
                <p className="font-medium">{verifiedProduct.quantity} dona</p>
              </div>
              <div>
                <p className="text-muted-foreground">Amal turi</p>
                <Badge className="bg-warning/10 text-warning border-warning/20 gap-1">
                  <ArrowUpCircle className="w-3 h-3" /> Chiqim
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Miqdor (chiqariladigan)</Label>
              <Input
                type="number"
                min={1}
                max={verifiedProduct.quantity}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep(2); setVerifiedProduct(null); setProductCode(''); }}>
                Ortga
              </Button>
              <Button
                onClick={executeOperation}
                disabled={loading || verifiedProduct.quantity <= 0 || quantity > verifiedProduct.quantity}
                className="flex-1"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Chiqim qilish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch logs */}
      {batchLogs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Sessiya logi ({batchLogs.length})</h3>
          {batchLogs.map(log => (
            <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg border border-success/20 bg-success/5">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <div className="flex-1 flex items-center gap-2 text-sm">
                <Badge className="bg-warning/10 text-warning border-warning/20 text-xs">
                  Chiqim
                </Badge>
                <span className="font-medium truncate">{log.product_name}</span>
                <span className="text-muted-foreground">x{log.quantity}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(log.created_at).toLocaleTimeString('uz-UZ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
