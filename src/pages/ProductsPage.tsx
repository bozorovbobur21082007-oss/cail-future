import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Pencil, Trash2, QrCode, Search, Loader2, Download, Radio, Printer, Barcode as BarcodeIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorMessages';
import { QRCodeCanvas } from 'qrcode.react';
import Barcode from '@/components/Barcode';
import NfcScanner from '@/components/NfcScanner';
import { useScannerMode } from '@/hooks/useScannerMode';

interface Sector { id: string; name: string; code: string; }

interface Product {
  id: string;
  product_code: string;
  name: string;
  quantity: number;
  low_stock_threshold: number;
  created_at: string;
  sector_id: string | null;
  nfc_id: string | null;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', quantity: 1, low_stock_threshold: 10, sector_id: '', nfc_id: '' });
  const [idMethod, setIdMethod] = useState<'code' | 'nfc'>('code');
  const [showNfcScanner, setShowNfcScanner] = useState(false);
  const [scannerMode] = useScannerMode();
  const [labelSize, setLabelSize] = useState<'thermal_15x40' | 'small' | 'medium' | 'large' | 'custom'>('thermal_15x40');
  const [compactLabel, setCompactLabel] = useState(false);
  const [codeFormat, setCodeFormat] = useState<'qr' | 'barcode'>('qr');
  const [customW, setCustomW] = useState(50);
  const [customH, setCustomH] = useState(30);
  const qrRef = useRef<HTMLCanvasElement>(null);

  // Maxsus o'lcham: kenglik balandlikdan ≥1.5× katta bo'lsa yonma-yon, aks holda vertical.
  const customConfig = (() => {
    const w = Math.max(15, Math.min(200, customW || 0));
    const h = Math.max(10, Math.min(200, customH || 0));
    const layout: 'horizontal' | 'vertical' = w >= h * 1.5 ? 'horizontal' : 'vertical';
    const qr = layout === 'horizontal'
      ? Math.max(8, Math.min(h - 2, w * 0.35))
      : Math.max(10, Math.min(w - 4, h * 0.6));
    return { label: `Maxsus ${w}×${h}mm`, layout, w, h, qr: Math.round(qr) };
  })();

  const labelSizeConfig = {
    thermal_15x40: { label: 'Termal 15×40mm (yonma-yon)', layout: 'horizontal' as const, w: 40, h: 15, qr: 12 },
    small: { label: 'Kichik 40×40mm', layout: 'vertical' as const, w: 40, h: 40, qr: 32 },
    medium: { label: "O'rta 60×60mm", layout: 'vertical' as const, w: 60, h: 60, qr: 50 },
    large: { label: 'Katta 80×80mm', layout: 'vertical' as const, w: 80, h: 80, qr: 70 },
    custom: customConfig,
  } as const;

  const fetchProducts = useCallback(async () => {
    const [prodRes, secRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('sectors').select('id, name, code'),
    ]);
    if (prodRes.error) {
      toast.error('Mahsulotlarni yuklashda xatolik');
    } else {
      setProducts(prodRes.data || []);
    }
    setSectors(secRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', quantity: 1, low_stock_threshold: 10, sector_id: '', nfc_id: '' });
    setIdMethod('code');
    setShowNfcScanner(false);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, quantity: p.quantity, low_stock_threshold: p.low_stock_threshold, sector_id: p.sector_id || '', nfc_id: p.nfc_id || '' });
    setIdMethod(p.nfc_id ? 'nfc' : 'code');
    setShowNfcScanner(false);
    setDialogOpen(true);
  };

  const logOperation = async (
    productId: string,
    productName: string,
    actionType: 'IN' | 'OUT',
    qty: number,
  ) => {
    if (qty <= 0) return;
    const { error } = await supabase.from('operations').insert({
      product_id: productId,
      product_name: productName,
      worker_id: null,
      worker_name: 'Admin (Mahsulotlar)',
      action_type: actionType,
      quantity: qty,
    });
    if (error) console.error('Operation log xatolik:', error);
  };

  const performMerge = async () => {
    if (!mergeTarget) return;
    setSubmitting(true);
    try {
      const newQty = mergeTarget.quantity + 1;
      const { error } = await supabase
        .from('products')
        .update({ quantity: newQty })
        .eq('id', mergeTarget.id);
      if (error) throw error;
      // Kirim logini yozamiz
      await logOperation(mergeTarget.id, mergeTarget.name, 'IN', 1);
      toast.success(`"${mergeTarget.name}" soni 1 taga oshirildi (${newQty} ta)`);
      setMergeDialogOpen(false);
      setDialogOpen(false);
      setMergeTarget(null);
      fetchProducts();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nfc = form.nfc_id.trim().toUpperCase();
    const trimmedName = form.name.trim();

    // Identifikatsiya turini tekshirish
    if (idMethod === 'nfc' && !nfc) {
      toast.error("NFC ID kiritilmagan. NFC tegni skanerlang yoki QR/Barkod usulini tanlang.");
      return;
    }

    setSubmitting(true);

    // NFC ID takrorlanmasligini oldindan tekshirish (do'stona xato xabari uchun)
    if (idMethod === 'nfc' && nfc) {
      const { data: existingNfc, error: checkErr } = await supabase
        .from('products')
        .select('id, name, product_code')
        .eq('nfc_id', nfc)
        .maybeSingle();
      if (checkErr) {
        toast.error("NFC ID ni tekshirishda xatolik: " + checkErr.message);
        setSubmitting(false);
        return;
      }
      if (existingNfc && existingNfc.id !== editing?.id) {
        toast.error(
          `Bu NFC ID allaqachon "${existingNfc.name}" (${existingNfc.product_code}) mahsulotiga biriktirilgan. Boshqa teg ishlatishingiz kerak.`
        );
        setSubmitting(false);
        return;
      }
    }

    const payload = {
      name: trimmedName,
      quantity: editing ? form.quantity : 1,
      low_stock_threshold: form.low_stock_threshold,
      sector_id: form.sector_id || null,
      nfc_id: idMethod === 'nfc' ? nfc : null,
    };
    try {
      if (editing) {
        const oldQty = editing.quantity;
        const newQty = form.quantity;
        const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
        if (error) throw error;
        // Miqdor o'zgarsa — tegishli IN/OUT log yozamiz (admin qo'lda tahrir)
        if (newQty > oldQty) {
          await logOperation(editing.id, trimmedName, 'IN', newQty - oldQty);
        } else if (newQty < oldQty) {
          await logOperation(editing.id, trimmedName, 'OUT', oldQty - newQty);
        }
        toast.success("Mahsulot yangilandi");
        setDialogOpen(false);
        fetchProducts();
      } else {
        // Bir xil nomdagi mahsulot bor-yo'qligini tekshirish
        const existing = products.find(
          p => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
        );
        if (existing) {
          setMergeTarget(existing);
          setMergeDialogOpen(true);
          setSubmitting(false);
          return;
        }
        const { data: inserted, error } = await supabase
          .from('products')
          .insert(payload)
          .select('id, name, quantity')
          .single();
        if (error) throw error;
        // Yangi mahsulot uchun kirim logini yozamiz
        if (inserted) {
          await logOperation(inserted.id, inserted.name, 'IN', inserted.quantity || 1);
        }
        toast.success("Mahsulot qo'shildi");
        setDialogOpen(false);
        fetchProducts();
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', deleting.id);
      if (error) throw error;
      toast.success("Mahsulot o'chirildi");
      setDeleteDialogOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const getCodeCanvas = (): HTMLCanvasElement | null => {
    return document.querySelector('#qr-canvas canvas') as HTMLCanvasElement | null;
  };

  const downloadQrPng = () => {
    const canvas = getCodeCanvas();
    if (!canvas || !qrProduct) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${codeFormat === 'qr' ? 'qr' : 'barcode'}_${qrProduct.product_code}.png`;
    a.click();
    toast.success(codeFormat === 'qr' ? "QR kod yuklab olindi" : "Barkod yuklab olindi");
  };

  const printQr = () => {
    const canvas = getCodeCanvas();
    if (!canvas || !qrProduct) {
      toast.error("Kod topilmadi");
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank', 'width=400,height=500');
    if (!printWindow) {
      toast.error("Brauzer chop etish oynasini bloklab qo'ydi. Pop-up ruxsatini bering.");
      return;
    }
    const safeName = (qrProduct.name || '').replace(/</g, '&lt;');
    const code = qrProduct.product_code;
    const sectorCode = sectors.find(s => s.id === qrProduct.sector_id)?.code || '';
    const cfg = labelSizeConfig[labelSize];
    const isHorizontal = cfg.layout === 'horizontal';
    const useCompact = compactLabel && isHorizontal;
    const isBarcode = codeFormat === 'barcode';

    // Barkod o'lchamlari: yonma-yon — kenglikning ~60%, balandlikning ~70%; vertikal — to'liq kenglik
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
      ? `<div class="label"><img class="code-img" src="${dataUrl}" alt="${altLabel}" />${useCompact ? compactInner : fullInner}</div>`
      : `<div class="label"><img class="code-img" src="${dataUrl}" alt="${altLabel}" /><div class="name">${safeName}</div><div class="code">${code}</div></div>`;

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
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.product_code.toLowerCase().includes(q) ||
      (p.nfc_id ? p.nfc_id.toLowerCase().includes(q) : false)
    );
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mahsulotlar</h1>
          <p className="text-sm text-muted-foreground mt-1">Barcha omborxona mahsulotlari</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Yangi mahsulot
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Qidirish (nomi, kod yoki NFC ID)..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
               <TableRow className="bg-muted/50">
                 <TableHead className="text-xs uppercase text-muted-foreground w-10"></TableHead>
                 <TableHead className="text-xs uppercase text-muted-foreground">Nomi</TableHead>
                 <TableHead className="text-xs uppercase text-muted-foreground">ID</TableHead>
                 <TableHead className="text-xs uppercase text-muted-foreground">Sektor</TableHead>
                 <TableHead className="text-xs uppercase text-muted-foreground">Soni</TableHead>
                 <TableHead className="text-xs uppercase text-muted-foreground">Limit</TableHead>
                 <TableHead className="text-xs uppercase text-muted-foreground">Holat</TableHead>
                 <TableHead className="text-xs uppercase text-muted-foreground">Yaratilgan</TableHead>
                 <TableHead className="text-xs uppercase text-muted-foreground text-right">Amallar</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {search ? "Natija topilmadi" : "Hali mahsulot mavjud emas"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => {
                  const isLow = p.quantity <= p.low_stock_threshold;
                  const hasNfc = !!p.nfc_id;
                  return (
                    <TableRow key={p.id} className={isLow ? 'bg-destructive/5' : ''}>
                      <TableCell className="py-2">
                        {hasNfc ? (
                          <span
                            title={`NFC: ${p.nfc_id}`}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary"
                          >
                            <Radio className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span
                            title="QR / Barkod"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-muted text-muted-foreground"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={`font-medium ${isLow ? 'text-destructive' : ''}`}>{p.name}</TableCell>
                       <TableCell className="font-mono text-xs text-muted-foreground">
                         <button
                           type="button"
                           title="Nusxa olish"
                           onClick={async () => {
                             const value = hasNfc ? (p.nfc_id || '') : p.product_code;
                             try {
                               await navigator.clipboard.writeText(value);
                               toast.success('Nusxa olindi');
                             } catch {
                               toast.error("Nusxa olib bo'lmadi");
                             }
                           }}
                           className="hover:text-foreground hover:underline underline-offset-2 transition-colors cursor-pointer"
                         >
                           {hasNfc ? p.nfc_id : p.product_code}
                         </button>
                       </TableCell>
                       <TableCell className="text-xs">
                         {p.sector_id ? (
                           <Badge variant="outline" className="text-[10px]">
                             {sectors.find(s => s.id === p.sector_id)?.name || '—'}
                           </Badge>
                         ) : (
                           <span className="text-muted-foreground">—</span>
                         )}
                       </TableCell>
                      <TableCell className={`font-semibold ${isLow ? 'text-destructive' : ''}`}>{p.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">{p.low_stock_threshold}</TableCell>
                      <TableCell>
                        {isLow ? (
                          <Badge variant="destructive" className="text-xs">Kam</Badge>
                        ) : (
                          <Badge className="bg-success/10 text-success border-success/20 text-xs">Yetarli</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.created_at?.slice(0, 10)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!hasNfc && (
                              <DropdownMenuItem onClick={() => { setQrProduct(p); setQrDialogOpen(true); }}>
                                <QrCode className="w-4 h-4 mr-2" /> QR / Barkod
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openEdit(p)}>
                              <Pencil className="w-4 h-4 mr-2" /> Tahrirlash
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setDeleting(p); setDeleteDialogOpen(true); }} className="text-destructive focus:text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> O'chirish
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Mahsulotni tahrirlash" : "Yangi mahsulot qo'shish"}</DialogTitle>
            <DialogDescription>Mahsulot ma'lumotlarini kiriting</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nomi</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="masalan: Kompyuter" />
              {!editing && (
                <p className="text-[11px] text-muted-foreground">
                  Agar shu nomdagi mahsulot mavjud bo'lsa, soni avtomatik 1 taga oshiriladi.
                </p>
              )}
            </div>
            {editing && (
              <div className="space-y-2">
                <Label>Soni</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} min={0} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Kam qolish chegarasi</Label>
               <Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: parseInt(e.target.value) || 10 })} min={1} />
               <p className="text-[11px] text-muted-foreground">Soni shu chegaradan past tushsa, "Kam" deb belgilanadi.</p>
            </div>
            <div className="space-y-2">
              <Label>Sektor</Label>
              <Select value={form.sector_id} onValueChange={(v) => setForm({ ...form, sector_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Sektorsiz" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sektorsiz</SelectItem>
                  {sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Identifikatsiya turi</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setIdMethod('code'); setShowNfcScanner(false); }}
                  className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition ${
                    idMethod === 'code'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <QrCode className="w-4 h-4 text-primary" /> QR / Barkod
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    Avtomatik kod yaratiladi, yorliqni chop etib mahsulotga yopishtirasiz.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIdMethod('nfc')}
                  className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition ${
                    idMethod === 'nfc'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Radio className="w-4 h-4 text-primary" /> NFC nakleyka
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    Mahsulotda NFC teg bor — uni skanerlab biriktirasiz.
                  </span>
                </button>
              </div>
            </div>

            {idMethod === 'nfc' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-primary" />
                  NFC ID <span className="text-destructive text-xs font-normal">*majburiy</span>
                </Label>
                {!scannerMode && showNfcScanner ? (
                  <NfcScanner
                    onScan={(uid) => {
                      setForm({ ...form, nfc_id: uid });
                      setShowNfcScanner(false);
                      toast.success(`NFC ID o'qildi: ${uid}`);
                    }}
                    onClose={() => setShowNfcScanner(false)}
                  />
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        value={form.nfc_id}
                        onChange={(e) => setForm({ ...form, nfc_id: e.target.value })}
                        onKeyDown={(e) => {
                          // USB RFID o'quvchi UID + Enter yuboradi.
                          // Enter formni jo'natmasin — faqat UID qabul qilinganini tasdiqlaymiz.
                          if (e.key === 'Enter' && form.nfc_id.trim()) {
                            e.preventDefault();
                            toast.success(`NFC ID qabul qilindi: ${form.nfc_id.trim().toUpperCase()}`);
                          }
                        }}
                        placeholder="NFC tegni telefon, USB RFID o'quvchi yoki klaviatura orqali kiriting..."
                        className="font-mono"
                        autoFocus
                      />
                      {!scannerMode && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowNfcScanner(true)}
                          title="Telefon NFC orqali skanerlash"
                        >
                          <Radio className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      USB RFID o'quvchiga kartani tekkizing — UID avtomatik kiritiladi. Telefon NFC uchun yondagi tugmani bosing.
                    </p>
                  </>
                )}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Bekor qilish</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editing ? "Saqlash" : "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Merge Confirmation Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mavjud mahsulot topildi</DialogTitle>
            <DialogDescription>
              <strong>"{mergeTarget?.name}"</strong> nomli mahsulot allaqachon mavjud (hozir {mergeTarget?.quantity} ta).
              Uning soniga +1 qo'shilsinmi?
              <br /><br />
              <span className="text-xs text-muted-foreground">
                Eslatma: NFC ID birlashtirilmaydi — har bir nakleyka alohida bo'lgani uchun, agar har bir mahsulotning o'z NFC tegi bo'lishini xohlasangiz, "Yangi alohida saqlash" ni tanlang.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => { setMergeDialogOpen(false); setMergeTarget(null); }}>
              Bekor qilish
            </Button>
            <Button onClick={performMerge} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Sonini oshirish (+1)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mahsulotni o'chirish</DialogTitle>
            <DialogDescription>
              <strong>{deleting?.name}</strong> mahsulotini o'chirishni tasdiqlaysizmi?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Bekor qilish</Button>
            <Button variant="destructive" onClick={handleDelete}>O'chirish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {codeFormat === 'qr' ? <QrCode className="w-5 h-5 text-primary" /> : <BarcodeIcon className="w-5 h-5 text-primary" />}
              {codeFormat === 'qr' ? 'QR Kod' : 'Barkod (Code 128)'}
            </DialogTitle>
            <DialogDescription>
              {qrProduct?.name} — {qrProduct?.product_code}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div id="qr-canvas" className="p-4 bg-card border border-border rounded-lg flex items-center justify-center min-h-[200px]">
              {qrProduct && codeFormat === 'qr' && (
                <QRCodeCanvas
                  value={qrProduct.product_code}
                  size={200}
                  level="M"
                  includeMargin
                />
              )}
              {qrProduct && codeFormat === 'barcode' && (
                <Barcode
                  value={qrProduct.product_code}
                  format="CODE128"
                  width={2}
                  height={80}
                  fontSize={16}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground font-mono">{qrProduct?.product_code}</p>
            <div className="w-full space-y-2">
              <Label className="text-xs text-muted-foreground">Kod formati</Label>
              <Select value={codeFormat} onValueChange={(v) => setCodeFormat(v as 'qr' | 'barcode')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="qr">QR kod (kvadrat, 2D)</SelectItem>
                  <SelectItem value="barcode">Barkod — Code 128 (yotiq, 1D)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {codeFormat === 'qr'
                  ? "Telefon va 2D imager skanerlar uchun. Kichik joyga ham sig'adi."
                  : "Lazer skanerlar uchun ideal. 15×40mm kabi yotiq yorliqlarga juda mos keladi."}
              </p>
            </div>
            <div className="w-full space-y-2">
              <Label className="text-xs text-muted-foreground">Yorliq o'lchami (chop etish uchun)</Label>
              <Select value={labelSize} onValueChange={(v) => setLabelSize(v as typeof labelSize)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="thermal_15x40">{labelSizeConfig.thermal_15x40.label}</SelectItem>
                  <SelectItem value="small">{labelSizeConfig.small.label}</SelectItem>
                  <SelectItem value="medium">{labelSizeConfig.medium.label}</SelectItem>
                  <SelectItem value="large">{labelSizeConfig.large.label}</SelectItem>
                  <SelectItem value="custom">Maxsus o'lcham…</SelectItem>
                </SelectContent>
              </Select>
              {labelSize === 'custom' && (
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Kenglik (mm)</Label>
                      <Input
                        type="number"
                        min={15}
                        max={200}
                        value={customW}
                        onChange={(e) => setCustomW(parseInt(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Balandlik (mm)</Label>
                      <Input
                        type="number"
                        min={10}
                        max={200}
                        value={customH}
                        onChange={(e) => setCustomH(parseInt(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Joylashuv: <span className="font-medium text-foreground">{customConfig.layout === 'horizontal' ? 'Yonma-yon (QR chapda)' : 'Tepa-pastdan (QR yuqorida)'}</span> · QR ≈ {customConfig.qr}mm
                  </p>
                </div>
              )}
              {(labelSizeConfig[labelSize].layout === 'horizontal') && (
                <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={compactLabel}
                    onChange={(e) => setCompactLabel(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                  />
                  <span className="text-xs leading-tight">
                    <span className="font-medium">Kompakt rejim</span>
                    <span className="block text-muted-foreground">
                      Nom o'rniga sektor kodi va mahsulot ID ko'rsatiladi (uzun nomlar uchun qulay)
                    </span>
                  </span>
                </label>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setQrDialogOpen(false)}>Yopish</Button>
            <Button variant="outline" onClick={downloadQrPng}>
              <Download className="w-4 h-4 mr-2" />
              PNG
            </Button>
            <Button onClick={printQr}>
              <Printer className="w-4 h-4 mr-2" />
              Chop etish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
