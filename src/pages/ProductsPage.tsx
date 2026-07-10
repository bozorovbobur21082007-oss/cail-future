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
import { Plus, MoreHorizontal, Pencil, Trash2, QrCode, Search, Loader2, Download, Printer, Barcode as BarcodeIcon, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorMessages';
import { QRCodeCanvas } from 'qrcode.react';
import Barcode from '@/components/Barcode';
import QrScanner from '@/components/QrScanner';
import { useScannerMode } from '@/hooks/useScannerMode';
import BulkPrintA4Dialog from '@/components/BulkPrintA4Dialog';
import { checkSectorCapacity } from '@/utils/sectorCapacity';
import { escapeHtml, printLabel } from '@/utils/printLabel';

interface Sector { id: string; name: string; code: string; }

interface Product {
  id: string;
  product_code: string;
  name: string;
  quantity: number;
  low_stock_threshold: number;
  created_at: string;
  sector_id: string | null;
  approved: boolean;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', quantity: 1, low_stock_threshold: 10, sector_id: '' });
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [scannerMode] = useScannerMode();
  const [labelSize, setLabelSize] = useState<'xprinter_76x39' | 'thermal_15x40' | 'small' | 'medium' | 'large' | 'custom'>('xprinter_76x39');
  const [compactLabel, setCompactLabel] = useState(false);
  const [codeFormat, setCodeFormat] = useState<'qr' | 'barcode'>('barcode');
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
    xprinter_76x39: { label: 'Xprinter 58×40mm (Barkod asosiy)', layout: 'centered' as const, w: 58, h: 40, qr: 28 },
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
    setForm({ name: '', quantity: 0, low_stock_threshold: 10, sector_id: '' });
    setUseCustomCode(false);
    setCustomCode('');
    setShowQrScanner(false);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, quantity: p.quantity, low_stock_threshold: p.low_stock_threshold, sector_id: p.sector_id || '' });
    setUseCustomCode(false);
    setCustomCode('');
    setShowQrScanner(false);
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
    const trimmedName = form.name.trim();

    // Maxsus QR kod (mahsulot bilan kelgan) — tekshirish
    const customCodeVal = customCode.trim().toUpperCase();
    if (useCustomCode && !customCodeVal) {
      toast.error("Mahsulot QR/Barkodini kiriting yoki skanerlang.");
      return;
    }

    setSubmitting(true);

    // Maxsus mahsulot kodi takrorlanmasligini tekshirish
    if (useCustomCode && customCodeVal) {
      const { data: existingCode, error: codeErr } = await supabase
        .from('products')
        .select('id, name')
        .eq('product_code', customCodeVal)
        .maybeSingle();
      if (codeErr) {
        toast.error("Kodni tekshirishda xatolik: " + codeErr.message);
        setSubmitting(false);
        return;
      }
      if (existingCode && existingCode.id !== editing?.id) {
        toast.error(
          `Bu kod allaqachon "${existingCode.name}" mahsulotiga biriktirilgan. Boshqa kod ishlatishingiz kerak.`
        );
        setSubmitting(false);
        return;
      }
    }

    const payload: any = {
      name: trimmedName,
      quantity: editing ? form.quantity : (form.quantity || 0),
      low_stock_threshold: form.low_stock_threshold,
      sector_id: form.sector_id || null,
    };
    if (useCustomCode && customCodeVal) {
      payload.product_code = customCodeVal;
    }

    // Sektor sig'imini tekshirish — qo'shilayotgan delta (yangi mahsulot bo'lsa to'liq qty)
    if (payload.sector_id) {
      const delta = editing
        ? Math.max(0, payload.quantity - editing.quantity)
        : payload.quantity;
      if (delta > 0) {
        const cap = await checkSectorCapacity(payload.sector_id, delta, editing?.id);
        if (!cap.ok) {
          toast.error(cap.message || "Sektorda joy qolmagan");
          setSubmitting(false);
          return;
        }
      }
    }

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
        // Faqat admin boshlang'ich miqdor kiritgan bo'lsa, IN sifatida qaydlaymiz
        if (inserted && (inserted.quantity || 0) > 0) {
          await logOperation(inserted.id, inserted.name, 'IN', inserted.quantity);
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

  const handleApprove = async (p: Product) => {
    try {
      const { error } = await supabase.from('products').update({ approved: true }).eq('id', p.id);
      if (error) throw error;
      toast.success(`"${p.name}" tasdiqlandi`);
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
    const cfg = labelSizeConfig[labelSize];
    const sectorCode = sectors.find(s => s.id === qrProduct.sector_id)?.code || '';
    printLabel({
      productCode: qrProduct.product_code,
      productName: qrProduct.name || '',
      sectorCode,
      codeImageDataUrl: dataUrl,
      format: codeFormat,
      size: { w: cfg.w, h: cfg.h, qr: cfg.qr, layout: cfg.layout, label: cfg.label },
      compact: compactLabel,
    });
  };

  const pendingCount = products.filter(p => !p.approved).length;

  const filtered = products.filter(p => {
    if (statusFilter === 'pending' && p.approved) return false;
    if (statusFilter === 'approved' && !p.approved) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.product_code.toLowerCase().includes(q)
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkPrintOpen(true)} disabled={products.length === 0}>
            <Printer className="w-4 h-4 mr-2" />
            A4 ga chop etish
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Yangi mahsulot
          </Button>
        </div>
      </div>

      <BulkPrintA4Dialog
        open={bulkPrintOpen}
        onOpenChange={setBulkPrintOpen}
        products={products.map(p => ({ id: p.id, product_code: p.product_code, name: p.name }))}
        initialSelectedIds={filtered.map(p => p.id)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Qidirish (nomi yoki kod)..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
          >
            Hammasi
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">{products.length}</Badge>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('pending')}
            className={statusFilter === 'pending' ? 'bg-warning text-warning-foreground hover:bg-warning/90' : pendingCount > 0 ? 'border-warning/40 text-warning hover:bg-warning/10' : ''}
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Tasdiq kutilmoqda
            {pendingCount > 0 && (
              <Badge
                className={`ml-2 h-5 px-1.5 text-[10px] ${statusFilter === 'pending' ? 'bg-warning-foreground/20 text-warning-foreground' : 'bg-warning text-warning-foreground'}`}
              >
                {pendingCount}
              </Badge>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'approved' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('approved')}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            Tasdiqlangan
          </Button>
        </div>
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
                    {search
                      ? "Natija topilmadi"
                      : statusFilter === 'pending'
                        ? "Tasdiq kutayotgan mahsulot yo'q"
                        : statusFilter === 'approved'
                          ? "Tasdiqlangan mahsulot yo'q"
                          : "Hali mahsulot mavjud emas"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => {
                  const isLow = p.quantity <= p.low_stock_threshold;
                  return (
                    <TableRow key={p.id} className={isLow ? 'bg-destructive/5' : ''}>
                      <TableCell className="py-2">
                        <span
                          title="QR / Barkod"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-muted text-muted-foreground"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </span>
                      </TableCell>
                      <TableCell className={`font-medium ${isLow ? 'text-destructive' : ''}`}>{p.name}</TableCell>
                       <TableCell className="font-mono text-xs text-muted-foreground">
                         <button
                           type="button"
                           title="Nusxa olish"
                           onClick={async () => {
                             try {
                               await navigator.clipboard.writeText(p.product_code);
                               toast.success('Nusxa olindi');
                             } catch {
                               toast.error("Nusxa olib bo'lmadi");
                             }
                           }}
                           className="hover:text-foreground hover:underline underline-offset-2 transition-colors cursor-pointer"
                         >
                           {p.product_code}
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
                        {!p.approved ? (
                          <Badge className="bg-warning/10 text-warning border-warning/20 text-xs gap-1">
                            <Clock className="w-3 h-3" /> Tasdiq kutilmoqda
                          </Badge>
                        ) : isLow ? (
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
                            {!p.approved && (
                              <DropdownMenuItem onClick={() => handleApprove(p)} className="text-success focus:text-success">
                                <CheckCircle2 className="w-4 h-4 mr-2" /> Tasdiqlash
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => { setQrProduct(p); setQrDialogOpen(true); }}>
                              <QrCode className="w-4 h-4 mr-2" /> QR / Barkod yorliq
                            </DropdownMenuItem>
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
            {editing ? (
              <div className="space-y-2">
                <Label>Soni (faqat o'qish uchun)</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  readOnly
                  disabled
                  className="bg-muted/50 cursor-not-allowed"
                />
                <p className="text-[11px] text-muted-foreground">
                  Mahsulot soni faqat <span className="font-medium text-foreground">Kirim/Chiqim</span> sahifasida IN/OUT operatsiyalar orqali o'zgaradi. Bu omborxona tarixini to'g'ri saqlash uchun.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Boshlang'ich miqdor (ixtiyoriy)</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
                  min={0}
                />
                <p className="text-[11px] text-muted-foreground">
                  Default 0 — ishchilar Kirim/Chiqim sahifasida IN orqali to'ldiradi. Agar omborda allaqachon mavjud tovar bo'lsa, boshlang'ich miqdorni shu yerda kiritishingiz mumkin (IN log sifatida yoziladi).
                </p>
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

            {idMethod === 'code' && (
              <div className="space-y-2 rounded-md border border-dashed border-border p-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomCode}
                    onChange={(e) => {
                      setUseCustomCode(e.target.checked);
                      if (!e.target.checked) { setCustomCode(''); setShowQrScanner(false); }
                    }}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    Mahsulot o'z QR/Barkodi bilan kelgan
                    <span className="block text-[11px] text-muted-foreground leading-tight">
                      Tayyor kodini ro'yxatdan o'tkazing — avtomatik kod o'rniga shu kod ishlatiladi.
                    </span>
                  </span>
                </label>

                {useCustomCode && (
                  <>
                    {showQrScanner ? (
                      <QrScanner
                        onScan={(code) => {
                          setCustomCode(code.trim().toUpperCase());
                          setShowQrScanner(false);
                          toast.success(`Kod o'qildi: ${code}`);
                        }}
                        onClose={() => setShowQrScanner(false)}
                      />
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          value={customCode}
                          onChange={(e) => setCustomCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && customCode.trim()) {
                              e.preventDefault();
                              toast.success(`Kod qabul qilindi: ${customCode.trim().toUpperCase()}`);
                            }
                          }}
                          placeholder="QR/Barkodni skanerlang yoki kiriting..."
                          className="font-mono uppercase"
                          autoFocus
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowQrScanner(true)}
                          title="Kamera orqali skanerlash"
                        >
                          <QrCode className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      USB QR/Barkod o'quvchi avtomatik kiritadi. Kamera uchun yondagi tugmani bosing. Kod takrorlanmasligi tekshiriladi.
                    </p>
                  </>
                )}
              </div>
            )}

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
                  displayValue={false}
                  margin={0}
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
                  <SelectItem value="xprinter_76x39">{labelSizeConfig.xprinter_76x39.label}</SelectItem>
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
