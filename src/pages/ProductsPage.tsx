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
import { Plus, MoreHorizontal, Pencil, Trash2, QrCode, Search, Loader2, Download, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorMessages';
import { QRCodeCanvas } from 'qrcode.react';
import NfcScanner from '@/components/NfcScanner';

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
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', quantity: 0, low_stock_threshold: 10, sector_id: '' });
  const qrRef = useRef<HTMLCanvasElement>(null);

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
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, quantity: p.quantity, low_stock_threshold: p.low_stock_threshold, sector_id: p.sector_id || '' });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      name: form.name,
      quantity: form.quantity,
      low_stock_threshold: form.low_stock_threshold,
      sector_id: form.sector_id || null,
    };
    try {
      if (editing) {
        const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success("Mahsulot yangilandi");
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
        toast.success("Mahsulot qo'shildi");
      }
      setDialogOpen(false);
      fetchProducts();
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

  const downloadQrPng = () => {
    const canvas = document.querySelector('#qr-canvas canvas') as HTMLCanvasElement | null;
    if (!canvas || !qrProduct) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr_${qrProduct.product_code}.png`;
    a.click();
    toast.success("QR kod yuklab olindi");
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.product_code.toLowerCase().includes(search.toLowerCase())
  );

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
        <Input placeholder="Qidirish (nomi yoki ID)..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
               <TableRow className="bg-muted/50">
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
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {search ? "Natija topilmadi" : "Hali mahsulot mavjud emas"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => {
                  const isLow = p.quantity <= p.low_stock_threshold;
                  return (
                    <TableRow key={p.id} className={isLow ? 'bg-destructive/5' : ''}>
                      <TableCell className={`font-medium ${isLow ? 'text-destructive' : ''}`}>{p.name}</TableCell>
                       <TableCell className="font-mono text-xs text-muted-foreground">{p.product_code}</TableCell>
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
                            <DropdownMenuItem onClick={() => { setQrProduct(p); setQrDialogOpen(true); }}>
                              <QrCode className="w-4 h-4 mr-2" /> QR kodni ko'rish
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
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Soni</Label>
              <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Kam qolish chegarasi</Label>
               <Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: parseInt(e.target.value) || 10 })} />
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

      {/* Delete Dialog */}
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
              <QrCode className="w-5 h-5 text-primary" />
              QR Kod
            </DialogTitle>
            <DialogDescription>
              {qrProduct?.name} — {qrProduct?.product_code}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div id="qr-canvas" className="p-4 bg-card border border-border rounded-lg">
              {qrProduct && (
                <QRCodeCanvas
                  value={qrProduct.product_code}
                  size={200}
                  level="M"
                  includeMargin
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground font-mono">{qrProduct?.product_code}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrDialogOpen(false)}>Yopish</Button>
            <Button onClick={downloadQrPng}>
              <Download className="w-4 h-4 mr-2" />
              PNG yuklash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
