import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Search, ArrowRightLeft, Loader2, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorMessages';

interface Sector {
  id: string;
  name: string;
  code: string;
  capacity: number;
}

interface Product {
  id: string;
  product_code: string;
  name: string;
  quantity: number;
  sector_id: string | null;
  nfc_id: string | null;
}

export default function TransferPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all'); // 'all' | 'none' | sectorId
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetSectorId, setTargetSectorId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [pRes, sRes, shRes] = await Promise.all([
      supabase.from('products')
        .select('id, product_code, name, quantity, sector_id, nfc_id')
        .order('name'),
      supabase.from('sectors')
        .select('id, name, code')
        .order('code'),
      supabase.from('shelves')
        .select('id, sector_id, capacity'),
    ]);
    if (pRes.error) toast.error('Mahsulotlarni yuklashda xatolik');
    else setProducts(pRes.data || []);
    if (sRes.error || shRes.error) toast.error('Xonalarni yuklashda xatolik');
    else {
      // Xona sig'imi = ichidagi barcha shkaflarning sig'imlari yig'indisi
      const capByS = new Map<string, number>();
      (shRes.data || []).forEach((sh: any) => {
        capByS.set(sh.sector_id, (capByS.get(sh.sector_id) || 0) + (sh.capacity || 0));
      });
      setSectors((sRes.data || []).map((s: any) => ({ ...s, capacity: capByS.get(s.id) || 0 })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sectorMap = useMemo(() => {
    const m = new Map<string, Sector>();
    sectors.forEach(s => m.set(s.id, s));
    return m;
  }, [sectors]);

  // Filtrlangan ro'yxat
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (sourceFilter === 'none') {
        if (p.sector_id) return false;
      } else if (sourceFilter !== 'all') {
        if (p.sector_id !== sourceFilter) return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.product_code.toLowerCase().includes(q) ||
        (p.nfc_id ? p.nfc_id.toLowerCase().includes(q) : false)
      );
    });
  }, [products, search, sourceFilter]);

  const selectedProducts = useMemo(
    () => products.filter(p => selectedIds.has(p.id)),
    [products, selectedIds],
  );

  const totalSelectedQty = selectedProducts.reduce((s, p) => s + (p.quantity || 0), 0);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const allSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach(p => next.delete(p.id));
      else filtered.forEach(p => next.add(p.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const removeFromSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const openTransferDialog = () => {
    if (selectedProducts.length === 0) {
      toast.error("Avval ko'chirish uchun mahsulot tanlang");
      return;
    }
    setTargetSectorId('');
    setDialogOpen(true);
  };

  // Tanlangan mahsulotlar uchun maqsadli sektorga sig'imni tekshirish
  const capacityInfo = useMemo(() => {
    if (!targetSectorId) return null;
    const target = sectorMap.get(targetSectorId);
    if (!target) return null;
    // Maqsadli sektordagi mavjud band — tanlangan mahsulotlardan tashqari
    const usedByOthers = products
      .filter(p => p.sector_id === targetSectorId && !selectedIds.has(p.id))
      .reduce((s, p) => s + (p.quantity || 0), 0);
    const remaining = Math.max(0, (target.capacity || 0) - usedByOthers);
    return {
      target,
      usedByOthers,
      remaining,
      needed: totalSelectedQty,
      fits: totalSelectedQty <= remaining,
    };
  }, [targetSectorId, sectorMap, products, selectedIds, totalSelectedQty]);

  const performTransfer = async () => {
    if (!targetSectorId) {
      toast.error("Maqsadli sektorni tanlang");
      return;
    }
    if (!capacityInfo?.fits) {
      toast.error(
        `Sektorda joy yetmaydi: bo'sh ${capacityInfo?.remaining ?? 0}, kerak ${totalSelectedQty}.`,
      );
      return;
    }
    setSubmitting(true);
    const target = sectorMap.get(targetSectorId)!;
    let okCount = 0;
    const opsLog: Array<{
      product_id: string;
      product_name: string;
      worker_id: null;
      worker_name: string;
      action_type: string;
      quantity: number;
    }> = [];

    try {
      for (const p of selectedProducts) {
        if (p.sector_id === targetSectorId) continue; // bir xil sektorga — o'tkazib yuborish
        const fromCode = p.sector_id ? sectorMap.get(p.sector_id)?.code || '—' : '—';
        const { error } = await supabase
          .from('products')
          .update({ sector_id: targetSectorId })
          .eq('id', p.id);
        if (error) {
          toast.error(`"${p.name}" ko'chirilmadi: ${getErrorMessage(error)}`);
          continue;
        }
        // Eski joylashtirish (product_placements) ni tozalaymiz — yangi sektorda qaytadan to'ldiriladi
        await supabase
          .from('product_placements')
          .delete()
          .eq('product_id', p.id);
        okCount++;
        opsLog.push({
          product_id: p.id,
          product_name: `${p.name} (${fromCode} → ${target.code})`,
          worker_id: null,
          worker_name: "Admin (Ko'chirish)",
          action_type: 'MOVE',
          quantity: p.quantity || 0,
        });
      }
      if (opsLog.length > 0) {
        await supabase.from('operations').insert(opsLog);
      }
      toast.success(`${okCount} ta mahsulot "${target.name}" sektoriga ko'chirildi`);
      setDialogOpen(false);
      clearSelection();
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ko'chirish</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mahsulotlarni bir sektordan boshqasiga ko'chirish — bir nechtasini birdaniga tanlash mumkin
          </p>
        </div>
        <Button
          onClick={openTransferDialog}
          disabled={selectedProducts.length === 0}
          size="lg"
          className="gap-2"
        >
          <ArrowRightLeft className="w-4 h-4" />
          Ko'chirish ({selectedProducts.length})
        </Button>
      </div>

      {/* Tanlangan mahsulotlar paneli */}
      {selectedProducts.length > 0 && (
        <Card className="border-primary/40 bg-primary/5 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm font-medium">
                Tanlangan: <span className="text-primary font-bold">{selectedProducts.length}</span> ta mahsulot
                {' · '}jami <span className="font-bold">{totalSelectedQty}</span> dona
              </div>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="w-4 h-4 mr-1" />
                Tozalash
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedProducts.map(p => (
                <Badge
                  key={p.id}
                  variant="secondary"
                  className="gap-1.5 pl-2 pr-1 py-1 text-xs"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">×{p.quantity}</span>
                  <button
                    onClick={() => removeFromSelection(p.id)}
                    className="ml-1 hover:bg-muted rounded p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filterlar */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Nom, kod yoki NFC ID bo'yicha izlash..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="min-w-[220px]">
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Sektor bo'yicha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barcha sektorlar</SelectItem>
                  <SelectItem value="none">Sektorsiz</SelectItem>
                  {sectors.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mahsulotlar jadvali */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleAllVisible}
                    aria-label="Hammasini tanlash"
                  />
                </TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">Nom</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">Kod</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">Hozirgi sektor</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground text-right">Soni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    {search || sourceFilter !== 'all' ? 'Mahsulot topilmadi' : "Hozircha mahsulot yo'q"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(p => {
                  const sec = p.sector_id ? sectorMap.get(p.sector_id) : null;
                  const checked = selectedIds.has(p.id);
                  return (
                    <TableRow
                      key={p.id}
                      className={checked ? 'bg-primary/5' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(p.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {p.product_code}
                      </TableCell>
                      <TableCell>
                        {sec ? (
                          <Badge variant="outline" className="gap-1">
                            <MapPin className="w-3 h-3" />
                            {sec.code} — {sec.name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Sektorsiz
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{p.quantity}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ko'chirish dialogi */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mahsulotlarni ko'chirish</DialogTitle>
            <DialogDescription>
              {selectedProducts.length} ta mahsulot ({totalSelectedQty} dona) tanlangan.
              Maqsadli sektorni tanlang.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Maqsadli sektor</Label>
              <Select value={targetSectorId} onValueChange={setTargetSectorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sektorni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {capacityInfo && (
              <div className={`p-3 rounded-md border text-sm ${
                capacityInfo.fits
                  ? 'bg-success/10 border-success/30 text-success-foreground'
                  : 'bg-destructive/10 border-destructive/30'
              }`}>
                <div className="font-medium mb-1">
                  {capacityInfo.target.code} — {capacityInfo.target.name}
                </div>
                <div className="text-xs space-y-0.5">
                  <div>Sig'im: <strong>{capacityInfo.target.capacity}</strong></div>
                  <div>Boshqa mahsulotlar band qilgan: <strong>{capacityInfo.usedByOthers}</strong></div>
                  <div>Bo'sh joy: <strong>{capacityInfo.remaining}</strong></div>
                  <div>Ko'chirilayotgan: <strong>{capacityInfo.needed}</strong></div>
                </div>
                {!capacityInfo.fits && (
                  <div className="mt-2 text-destructive font-medium">
                    ⚠ Joy yetmaydi. Boshqa sektor tanlang yoki yangi javon yarating.
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Bekor qilish
            </Button>
            <Button
              onClick={performTransfer}
              disabled={submitting || !targetSectorId || !capacityInfo?.fits}
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ko'chirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
