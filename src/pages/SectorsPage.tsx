import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, MoreHorizontal, Pencil, Trash2, Search, Loader2, MapPin, Package, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorMessages';

interface Sector {
  id: string;
  name: string;
  code: string;
  description: string;
  capacity: number;
  rows: number;
  columns: number;
  levels: number;
  width_cm: number;
  depth_cm: number;
  height_cm: number;
  position_x: number;
  position_y: number;
  orientation: number;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  sector_id: string | null;
  quantity: number;
}

interface SectorWithProducts extends Sector {
  products: Product[];
  occupied: number;
}

// Color hash for product chips to differentiate visually
function productColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 70% 55%)`;
}

interface ShelfRackProps {
  sector: SectorWithProducts;
  large?: boolean;
}

function ShelfRack({ sector, large = false }: ShelfRackProps) {
  const rows = Math.max(1, sector.levels || 1);
  const cols = Math.max(1, sector.columns || 1);
  const depthRows = Math.max(1, sector.rows || 1);
  const totalCells = rows * cols;
  const capacity = rows * cols * depthRows;

  // Build occupancy map: distribute each product across N consecutive slots = its quantity (capped)
  const cells = useMemo(() => {
    const arr: Array<Product | null> = Array(totalCells).fill(null);
    let i = 0;
    for (const p of sector.products) {
      const slots = Math.max(1, Math.min(p.quantity || 1, capacity));
      // Each visible cell represents depthRows physical slots
      const visibleSlots = Math.max(1, Math.ceil(slots / depthRows));
      for (let k = 0; k < visibleSlots && i < totalCells; k++, i++) arr[i] = p;
    }
    return arr;
  }, [sector.products, capacity, totalCells, depthRows]);

  const cellSize = large ? 'min-h-[44px]' : 'min-h-[26px]';
  const fontSize = large ? 'text-[10px]' : 'text-[8px]';

  return (
    <div className="relative">
      {/* Rack header label (like physical shelf label) */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-foreground text-background text-[10px] font-mono font-bold rounded-sm tracking-wider">
          {sector.code}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          {rows}L × {cols}C × {depthRows}R
        </span>
      </div>

      {/* Metal rack frame */}
      <div className="relative rounded-md bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 p-[6px] shadow-inner border border-slate-400/40">
        {/* Side posts */}
        <div className="absolute inset-y-1 left-0 w-[3px] bg-gradient-to-b from-slate-400 to-slate-500 rounded-l-md" />
        <div className="absolute inset-y-1 right-0 w-[3px] bg-gradient-to-b from-slate-400 to-slate-500 rounded-r-md" />

        <div className="space-y-[3px]">
          {Array.from({ length: rows }).map((_, r) => {
            const rowIndex = rows - 1 - r; // top shelf = highest level
            return (
              <div key={r} className="relative">
                {/* Shelf plank (top edge) */}
                <div className="h-[2px] bg-gradient-to-r from-slate-500 via-slate-400 to-slate-500 rounded-sm mb-[2px]" />

                {/* Shelf interior - back wall */}
                <div className="bg-amber-50/60 dark:bg-amber-950/30 px-1 py-1 border-x border-slate-400/30">
                  <div
                    className="grid gap-[2px]"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                  >
                    {Array.from({ length: cols }).map((_, c) => {
                      const idx = rowIndex * cols + c;
                      if (idx >= totalCells) {
                        return <div key={c} className={`${cellSize} bg-transparent`} />;
                      }
                      const p = cells[idx];
                      if (!p) {
                        return (
                          <Tooltip key={c}>
                            <TooltipTrigger asChild>
                              <div
                                className={`${cellSize} rounded-sm bg-success/20 border border-success/40 hover:bg-success/30 transition-colors cursor-help`}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Bo'sh joy · Q{rowIndex + 1}-{c + 1}
                            </TooltipContent>
                          </Tooltip>
                        );
                      }
                      return (
                        <Tooltip key={c}>
                          <TooltipTrigger asChild>
                            <div
                              className={`${cellSize} rounded-sm border flex items-center justify-center cursor-help shadow-sm hover:scale-105 transition-transform overflow-hidden`}
                              style={{
                                background: `linear-gradient(135deg, ${productColor(p.id)}, ${productColor(p.id)}dd)`,
                                borderColor: productColor(p.id),
                              }}
                            >
                              <span className={`${fontSize} font-semibold text-white truncate px-0.5 leading-none`}>
                                {large ? p.name.slice(0, 10) : p.name.slice(0, 3).toUpperCase()}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="font-semibold">{p.name}</div>
                            <div className="text-muted-foreground">Q{rowIndex + 1}-{c + 1} · {p.quantity} dona</div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                {/* Shelf level label on left */}
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 -translate-x-full pr-1 text-[8px] font-mono text-muted-foreground font-bold">
                  L{rowIndex + 1}
                </div>
              </div>
            );
          })}
          {/* Bottom shelf plank */}
          <div className="h-[2px] bg-gradient-to-r from-slate-500 via-slate-400 to-slate-500 rounded-sm" />
          {/* Base/floor */}
          <div className="h-[4px] bg-gradient-to-b from-slate-500 to-slate-600 rounded-b-sm" />
        </div>
      </div>
    </div>
  );
}

export default function SectorsPage() {
  const [sectors, setSectors] = useState<SectorWithProducts[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailSector, setDetailSector] = useState<SectorWithProducts | null>(null);
  const [editing, setEditing] = useState<Sector | null>(null);
  const [deleting, setDeleting] = useState<Sector | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '',
    rows: 3, columns: 5, levels: 2,
    width_cm: 200, depth_cm: 60, height_cm: 180,
    position_x: 0, position_y: 0, orientation: 0,
  });

  const fetchSectors = useCallback(async () => {
    const [sectorsRes, productsRes] = await Promise.all([
      supabase.from('sectors').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, sector_id, quantity'),
    ]);

    if (sectorsRes.error) {
      toast.error('Sektorlarni yuklashda xatolik');
      setLoading(false);
      return;
    }

    const products = (productsRes.data || []) as Product[];
    const bySector: Record<string, Product[]> = {};
    products.forEach(p => {
      if (!p.sector_id) return;
      (bySector[p.sector_id] ||= []).push(p);
    });

    const enriched: SectorWithProducts[] = (sectorsRes.data || []).map(s => {
      const list = bySector[s.id] || [];
      const occupied = list.reduce((sum, p) => sum + (p.quantity || 0), 0);
      return { ...s, products: list, occupied: Math.min(occupied, s.capacity) };
    });

    setSectors(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSectors(); }, [fetchSectors]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '', description: '',
      rows: 3, columns: 5, levels: 2,
      width_cm: 200, depth_cm: 60, height_cm: 180,
      position_x: 0, position_y: 0, orientation: 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (s: Sector) => {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description || '',
      rows: s.rows ?? 3,
      columns: s.columns ?? 5,
      levels: s.levels ?? 2,
      width_cm: s.width_cm ?? 200,
      depth_cm: s.depth_cm ?? 60,
      height_cm: s.height_cm ?? 180,
      position_x: s.position_x ?? 0,
      position_y: s.position_y ?? 0,
      orientation: s.orientation ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const capacity = Math.max(1, form.rows * form.columns * form.levels);
      const payload = { ...form, capacity };
      if (editing) {
        const { error } = await supabase.from('sectors').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success("Sektor yangilandi");
      } else {
        const { error } = await supabase.from('sectors').insert(payload);
        if (error) throw error;
        toast.success("Sektor qo'shildi");
      }
      setDialogOpen(false);
      fetchSectors();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const { error } = await supabase.from('sectors').delete().eq('id', deleting.id);
      if (error) throw error;
      toast.success("Sektor o'chirildi");
      setDeleteDialogOpen(false);
      fetchSectors();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const filtered = sectors.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  // Global stats
  const totalCapacity = sectors.reduce((s, x) => s + x.capacity, 0);
  const totalOccupied = sectors.reduce((s, x) => s + x.occupied, 0);
  const totalEmpty = totalCapacity - totalOccupied;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sektorlar — Polkalar xaritasi</h1>
            <p className="text-sm text-muted-foreground mt-1">Omborxonadagi har bir javon va polkani vizual nazorat qiling</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Yangi sektor
          </Button>
        </div>

        {/* Global stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Jami javonlar</p>
            <p className="text-2xl font-bold mt-1">{sectors.length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Umumiy sig'im</p>
            <p className="text-2xl font-bold mt-1">{totalCapacity}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-destructive" /> Band joylar
            </p>
            <p className="text-2xl font-bold mt-1 text-destructive">{totalOccupied}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-success" /> Bo'sh joylar
            </p>
            <p className="text-2xl font-bold mt-1 text-success">{totalEmpty}</p>
          </CardContent></Card>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* Rack grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-8 text-center text-muted-foreground">
                {search ? "Natija topilmadi" : "Hali sektor mavjud emas"}
              </CardContent>
            </Card>
          ) : (
            filtered.map((s) => {
              const usagePercent = s.capacity > 0 ? Math.round((s.occupied / s.capacity) * 100) : 0;
              const isFull = usagePercent >= 90;
              const empty = s.capacity - s.occupied;

              return (
                <Card key={s.id} className={`shadow-sm hover:shadow-lg transition-all ${isFull ? 'border-destructive/50' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {s.products.length} ta mahsulot turi
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailSector(s)} title="Kattalashtirish">
                          <Maximize2 className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(s)}>
                              <Pencil className="w-4 h-4 mr-2" /> Tahrirlash
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setDeleting(s); setDeleteDialogOpen(true); }} className="text-destructive focus:text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> O'chirish
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* The rack */}
                    <div className="pl-5">
                      <ShelfRack sector={s} />
                    </div>

                    {/* Footer stats */}
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-destructive/70" /> {s.occupied}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-success/40 border border-success" /> {empty}
                          </span>
                        </div>
                        <Badge className={
                          isFull
                            ? 'bg-destructive/10 text-destructive border-destructive/20 text-[10px]'
                            : usagePercent > 60
                              ? 'bg-warning/10 text-warning border-warning/20 text-[10px]'
                              : 'bg-success/10 text-success border-success/20 text-[10px]'
                        }>
                          {usagePercent}%
                        </Badge>
                      </div>
                      <Progress value={usagePercent} className="h-1.5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Detail dialog with large rack */}
        <Dialog open={!!detailSector} onOpenChange={(o) => !o && setDetailSector(null)}>
          <DialogContent className="max-w-3xl">
            {detailSector && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    {detailSector.name}
                    <Badge variant="outline" className="font-mono">{detailSector.code}</Badge>
                  </DialogTitle>
                  <DialogDescription>
                    {detailSector.description || "Sektor batafsil ko'rinishi"}
                  </DialogDescription>
                </DialogHeader>

                <div className="pl-6">
                  <ShelfRack sector={detailSector} large />
                </div>

                {detailSector.products.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" /> Mahsulotlar ({detailSector.products.length})
                    </p>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {detailSector.products.map(p => (
                        <div key={p.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: productColor(p.id) }} />
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground">×{p.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Sektorni tahrirlash" : "Yangi sektor qo'shish"}</DialogTitle>
              <DialogDescription>Sektor ma'lumotlarini kiriting</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nomi</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="masalan: A-1 zona" />
              </div>
              <div className="space-y-2">
                <Label>Tavsif</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Sektor haqida qisqacha..." rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Sig'imi (jami katak soni)</Label>
                <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 100 })} min={1} />
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
              <DialogTitle>Sektorni o'chirish</DialogTitle>
              <DialogDescription>
                <strong>{deleting?.name}</strong> sektorini o'chirishni tasdiqlaysizmi? Sektordagi mahsulotlar sektorsiz qoladi.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Bekor qilish</Button>
              <Button variant="destructive" onClick={handleDelete}>O'chirish</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
