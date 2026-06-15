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
import { Plus, MoreHorizontal, Pencil, Trash2, Search, Loader2, MapPin, Package, Maximize2, Box, LayoutGrid, Target, X, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorMessages';
import SectorRack3D from '@/components/SectorRack3D';
import QrScanner from '@/components/QrScanner';

// Compute slot coords (1-indexed) of a product inside a sector's slot layout.
// Layout order matches SectorRack3D: idx = l*(cols*rows) + r*cols + c
function findProductSlot(
  sector: { rows: number; columns: number; levels: number; products: Product[] },
  predicate: (p: Product) => boolean,
): { level: number; column: number; row: number } | null {
  const cols = Math.max(1, sector.columns);
  const rows = Math.max(1, sector.rows);
  const lvls = Math.max(1, sector.levels);
  const total = cols * rows * lvls;
  let i = 0;
  for (const p of sector.products) {
    const q = Math.max(1, Math.min(p.quantity || 1, total - i));
    if (predicate(p)) {
      const idx = i;
      const l = Math.floor(idx / (cols * rows));
      const rem = idx % (cols * rows);
      const r = Math.floor(rem / cols);
      const c = rem % cols;
      return { level: l + 1, column: c + 1, row: r + 1 };
    }
    i += q;
    if (i >= total) break;
  }
  return null;
}

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
  highlight?: { level: number; column: number; row: number } | null;
}

function ShelfRack({ sector, large = false, highlight = null }: ShelfRackProps) {
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

  const boxH = large ? 'h-14' : 'h-10';
  const boxShortH = large ? 'h-12' : 'h-8';
  const fontSize = large ? 'text-[10px]' : 'text-[8px]';
  const rowGap = large ? 'gap-7' : 'gap-5';

  return (
    <div className="relative">
      {/* Header: code tag + dimensions */}
      <div className="flex items-center justify-between mb-3">
        <span className="px-2 py-0.5 bg-muted text-[10px] font-bold text-muted-foreground rounded uppercase tracking-wider font-mono">
          {sector.code}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest font-mono">
          {rows}L × {cols}C × {depthRows}R
        </span>
      </div>

      {/* Rack stage */}
      <div className="relative bg-slate-50 dark:bg-slate-900/40 rounded-lg p-5 border border-slate-100 dark:border-slate-800">
        <div className={`relative flex flex-col ${rowGap}`}>
          {Array.from({ length: rows }).map((_, r) => {
            const rowIndex = rows - 1 - r; // top = highest level
            const isBottom = r === rows - 1;
            return (
              <div key={r} className="relative">
                {/* Level label */}
                <span className="absolute -left-5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground font-mono">
                  L{rowIndex + 1}
                </span>

                {/* Horizontal steel beam */}
                <div className="h-2 w-full bg-slate-400 dark:bg-slate-500 rounded-sm shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)] mb-1" />

                {/* Pallet slots */}
                <div
                  className={`grid gap-1 ${boxH} relative px-1`}
                  style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: cols }).map((_, c) => {
                    const idx = rowIndex * cols + c;
                    const isHi = !!highlight && highlight.level === rowIndex + 1 && highlight.column === c + 1;
                    const hiRing = isHi ? 'ring-2 ring-red-500 ring-offset-1 shadow-[0_0_12px_rgba(239,68,68,0.7)] animate-pulse rounded-sm' : '';
                    if (idx >= totalCells) return <div key={c} />;
                    const p = cells[idx];
                    if (!p) {
                      return (
                        <Tooltip key={c}>
                          <TooltipTrigger asChild>
                            <div className={`relative border-b-2 border-slate-200 dark:border-slate-700 flex items-end justify-center pb-1 cursor-help hover:border-success/60 transition-colors ${hiRing}`}>
                              <div className={`w-full h-1 rounded-full ${isHi ? 'bg-red-500' : 'bg-success/30'}`} />
                              {isHi && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] font-bold text-red-500">★</span>}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {isHi ? `★ Belgilangan · L${rowIndex + 1}·C${c + 1}` : `Bo'sh joy · Q${rowIndex + 1}-${c + 1}`}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }
                    const useShort = (c + rowIndex) % 3 === 1;
                    const color = isHi ? '#ef4444' : productColor(p.id);
                    return (
                      <Tooltip key={c}>
                        <TooltipTrigger asChild>
                          <div className={`relative flex items-end cursor-help ${hiRing}`}>
                            <div
                              className={`w-full ${useShort ? boxShortH : boxH} rounded-sm border shadow-sm flex flex-col items-center overflow-hidden hover:-translate-y-0.5 transition-transform`}
                              style={{
                                background: `linear-gradient(180deg, ${color}33, ${color}55)`,
                                borderColor: `${color}99`,
                              }}
                            >
                              <div className="w-full h-[2px] mt-1 opacity-50" style={{ background: color }} />
                              <div className="flex-1" />
                              <span
                                className={`${fontSize} font-bold uppercase tracking-tighter truncate px-0.5 leading-none pb-1`}
                                style={{ color: color }}
                              >
                                {large ? p.name.slice(0, 10) : p.name.slice(0, 4).toUpperCase()}
                              </span>
                            </div>
                            {isHi && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-red-500">★</span>}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <div className="font-semibold">{isHi && '★ '}{p.name}</div>
                          <div className="text-muted-foreground">L{rowIndex + 1}·C{c + 1} · {p.quantity} dona</div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* Ground rail on bottom level */}
                {isBottom && (
                  <div className="h-1.5 w-[calc(100%+8px)] -ml-1 bg-slate-500 dark:bg-slate-600 rounded-full mt-1" />
                )}
              </div>
            );
          })}

          {/* Vertical steel uprights (primary blue) */}
          <div className="absolute inset-y-0 left-0 w-1.5 bg-primary/80 rounded-full shadow-[2px_0_4px_rgba(0,0,0,0.15)]" />
          <div className="absolute inset-y-0 right-0 w-1.5 bg-primary/80 rounded-full shadow-[-2px_0_4px_rgba(0,0,0,0.15)]" />
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
  const [detailView, setDetailView] = useState<'3d' | '2d'>('3d');
  const [highlight, setHighlight] = useState<{ level: number; column: number; row: number } | null>(null);
  const [hiInput, setHiInput] = useState({ level: 1, column: 1, row: 1 });
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
        <Dialog open={!!detailSector} onOpenChange={(o) => { if (!o) { setDetailSector(null); setHighlight(null); } }}>
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-md bg-muted p-2">
                    <p className="text-muted-foreground">Tuzilishi</p>
                    <p className="font-mono font-semibold">{detailSector.rows}×{detailSector.columns}×{detailSector.levels}</p>
                  </div>
                  <div className="rounded-md bg-muted p-2">
                    <p className="text-muted-foreground">O'lcham (sm)</p>
                    <p className="font-mono font-semibold">{detailSector.width_cm}×{detailSector.depth_cm}×{detailSector.height_cm}</p>
                  </div>
                  <div className="rounded-md bg-muted p-2">
                    <p className="text-muted-foreground">Pozitsiya</p>
                    <p className="font-mono font-semibold">X:{detailSector.position_x} Y:{detailSector.position_y}</p>
                  </div>
                  <div className="rounded-md bg-muted p-2">
                    <p className="text-muted-foreground">Burchak</p>
                    <p className="font-mono font-semibold">{detailSector.orientation}°</p>
                  </div>
                </div>

                {/* Slot belgilash (robot uchun) */}
                <div className="rounded-md border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-red-500" />
                    <p className="text-xs font-semibold">Joyni belgilash — robotga ko'rsatish</p>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Qavat (L) 1–{detailSector.levels}</Label>
                      <Input
                        type="number" min={1} max={detailSector.levels}
                        value={hiInput.level}
                        onChange={(e) => setHiInput({ ...hiInput, level: Math.max(1, Math.min(detailSector.levels, parseInt(e.target.value) || 1)) })}
                        className="h-8 w-20"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Ustun (C) 1–{detailSector.columns}</Label>
                      <Input
                        type="number" min={1} max={detailSector.columns}
                        value={hiInput.column}
                        onChange={(e) => setHiInput({ ...hiInput, column: Math.max(1, Math.min(detailSector.columns, parseInt(e.target.value) || 1)) })}
                        className="h-8 w-20"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Qator (R) 1–{detailSector.rows}</Label>
                      <Input
                        type="number" min={1} max={detailSector.rows}
                        value={hiInput.row}
                        onChange={(e) => setHiInput({ ...hiInput, row: Math.max(1, Math.min(detailSector.rows, parseInt(e.target.value) || 1)) })}
                        className="h-8 w-20"
                      />
                    </div>
                    <Button
                      size="sm" className="h-8 bg-red-500 hover:bg-red-600 text-white"
                      onClick={() => setHighlight({ ...hiInput })}
                    >
                      <Target className="w-3.5 h-3.5 mr-1.5" /> Belgilash
                    </Button>
                    {highlight && (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setHighlight(null)}>
                        <X className="w-3.5 h-3.5 mr-1.5" /> Tozalash
                      </Button>
                    )}
                    {highlight && (
                      <Badge className="bg-red-500 text-white ml-auto font-mono">
                        ★ {detailSector.code} · L{highlight.level} · C{highlight.column} · R{highlight.row}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant={detailView === '3d' ? 'default' : 'outline'}
                    onClick={() => setDetailView('3d')}
                    className="h-8"
                  >
                    <Box className="w-3.5 h-3.5 mr-1.5" /> 3D
                  </Button>
                  <Button
                    size="sm"
                    variant={detailView === '2d' ? 'default' : 'outline'}
                    onClick={() => setDetailView('2d')}
                    className="h-8"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> 2D
                  </Button>
                </div>

                {detailView === '3d' ? (
                  <SectorRack3D
                    rows={detailSector.rows}
                    columns={detailSector.columns}
                    levels={detailSector.levels}
                    width_cm={detailSector.width_cm}
                    depth_cm={detailSector.depth_cm}
                    height_cm={detailSector.height_cm}
                    products={detailSector.products}
                    highlight={highlight}
                    height={460}
                  />
                ) : (
                  <div className="pl-6">
                    <ShelfRack sector={detailSector} large highlight={highlight} />
                  </div>
                )}

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
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label>Nomi</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="masalan: A-1 zona" />
              </div>
              <div className="space-y-2">
                <Label>Tavsif</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Sektor haqida qisqacha..." rows={2} />
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-sm font-semibold">Javon tuzilishi (robot uchun)</p>
                <p className="text-xs text-muted-foreground">Sig'im avtomatik: <strong>{form.rows * form.columns * form.levels}</strong> katak (Qator × Ustun × Qavat)</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Qatorlar (chuqurlik)</Label>
                  <Input type="number" min={1} value={form.rows} onChange={(e) => setForm({ ...form, rows: Math.max(1, parseInt(e.target.value) || 1) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ustunlar (eni)</Label>
                  <Input type="number" min={1} value={form.columns} onChange={(e) => setForm({ ...form, columns: Math.max(1, parseInt(e.target.value) || 1) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Qavatlar</Label>
                  <Input type="number" min={1} value={form.levels} onChange={(e) => setForm({ ...form, levels: Math.max(1, parseInt(e.target.value) || 1) })} />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-sm font-semibold">Fizik o'lchamlar (sm)</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Kenglik (W)</Label>
                  <Input type="number" min={1} value={form.width_cm} onChange={(e) => setForm({ ...form, width_cm: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Chuqurlik (D)</Label>
                  <Input type="number" min={1} value={form.depth_cm} onChange={(e) => setForm({ ...form, depth_cm: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Balandlik (H)</Label>
                  <Input type="number" min={1} value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-sm font-semibold">Omborxonadagi pozitsiya</p>
                <p className="text-xs text-muted-foreground">Robotning navigatsiyasi uchun koordinatalar (sm)</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">X (sm)</Label>
                  <Input type="number" value={form.position_x} onChange={(e) => setForm({ ...form, position_x: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Y (sm)</Label>
                  <Input type="number" value={form.position_y} onChange={(e) => setForm({ ...form, position_y: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Burchak (°)</Label>
                  <Input type="number" min={0} max={359} value={form.orientation} onChange={(e) => setForm({ ...form, orientation: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <DialogFooter className="pt-2">
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
