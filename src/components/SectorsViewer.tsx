import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Home, Search, Loader2, Box, LayoutGrid, Target, X, ScanLine, Eye,
  Package, Info, Layers, ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import SectorRack3D, { placementKey, type PlacementMap, type HighlightSlot } from '@/components/SectorRack3D';
import QrScanner from '@/components/QrScanner';

interface Sector {
  id: string;
  name: string;
  code: string;
  description: string | null;
  position_x: number;
  position_y: number;
  orientation: number;
}

interface Shelf {
  id: string;
  sector_id: string;
  name: string;
  code: string;
  rows: number;
  columns: number;
  levels: number;
  capacity: number;
  width_cm: number;
  depth_cm: number;
  height_cm: number;
  position_x: number;
  position_y: number;
  orientation: number;
}

interface Product {
  id: string;
  name: string;
  sector_id?: string | null;
  quantity: number;
  product_code?: string | null;
  
}

interface Placement {
  id: string;
  sector_id: string;
  shelf_id: string;
  product_id: string;
  level: number;
  column_idx: number;
  row_idx: number;
  quantity: number;
}

function productColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

function findSlotInShelf(
  shelf: Shelf,
  shelfProducts: Product[],
  placements: PlacementMap,
  predicate: (p: Product) => boolean,
): HighlightSlot | null {
  for (const [key, val] of placements.entries()) {
    if (predicate(val.product)) {
      const [l, c, r] = key.split('-').map(Number);
      return { level: l, column: c, row: r };
    }
  }
  const cols = Math.max(1, shelf.columns);
  const rows = Math.max(1, shelf.rows);
  const lvls = Math.max(1, shelf.levels);
  const total = cols * rows * lvls;
  let i = 0;
  for (const p of shelfProducts) {
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function SectorsViewer({ open, onOpenChange }: Props) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [openSectorId, setOpenSectorId] = useState<string | null>(null);
  const [openShelfId, setOpenShelfId] = useState<string | null>(null);
  const [shelfView, setShelfView] = useState<'3d' | '2d'>('3d');
  const [depthRow, setDepthRow] = useState(1);

  const [productQuery, setProductQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [highlight, setHighlight] = useState<HighlightSlot | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<HighlightSlot | null>(null);

  // ---- Fetch
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [s, sh, p, pl] = await Promise.all([
      supabase.from('sectors').select('*').order('code'),
      supabase.from('shelves').select('*').order('code'),
      supabase.from('products').select('id, name, sector_id, quantity, product_code'),
      supabase.from('product_placements').select('*'),
    ]);
    if (s.error) { toast.error('Xonalarni yuklashda xatolik'); setLoading(false); return; }
    setSectors(s.data || []);
    setShelves(sh.data || []);
    setProducts((p.data || []) as Product[]);
    setPlacements((pl.data || []) as Placement[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (open) fetchAll(); }, [open, fetchAll]);

  // ---- Derived
  const productsBySector = useMemo(() => {
    const m = new Map<string, Product[]>();
    products.forEach(p => { if (p.sector_id) { if (!m.has(p.sector_id)) m.set(p.sector_id, []); m.get(p.sector_id)!.push(p); } });
    return m;
  }, [products]);

  const shelvesBySector = useMemo(() => {
    const m = new Map<string, Shelf[]>();
    shelves.forEach(sh => { if (!m.has(sh.sector_id)) m.set(sh.sector_id, []); m.get(sh.sector_id)!.push(sh); });
    return m;
  }, [shelves]);

  const placementsByShelf = useMemo(() => {
    const m = new Map<string, PlacementMap>();
    placements.forEach(pl => {
      if (!m.has(pl.shelf_id)) m.set(pl.shelf_id, new Map());
      const prod = products.find(pp => pp.id === pl.product_id);
      if (prod) m.get(pl.shelf_id)!.set(placementKey(pl.level, pl.column_idx, pl.row_idx), { product: prod, quantity: pl.quantity });
    });
    return m;
  }, [placements, products]);

  const sectorStats = useMemo(() => sectors.map(s => {
    const shList = shelvesBySector.get(s.id) || [];
    const capacity = shList.reduce((sum, sh) => sum + (sh.capacity || 0), 0);
    const occupied = (productsBySector.get(s.id) || []).reduce((sum, p) => sum + (p.quantity || 0), 0);
    const pct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;
    return { sector: s, shelfCount: shList.length, capacity, occupied, pct };
  }), [sectors, shelvesBySector, productsBySector]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sectorStats;
    return sectorStats.filter(({ sector }) =>
      sector.name.toLowerCase().includes(q) || sector.code.toLowerCase().includes(q)
    );
  }, [sectorStats, search]);

  const openSector = sectors.find(s => s.id === openSectorId) || null;
  const openShelf = shelves.find(sh => sh.id === openShelfId) || null;
  const openShelfProducts = openShelf ? (productsBySector.get(openShelf.sector_id) || []) : [];
  const openShelfPlacements = openShelf ? (placementsByShelf.get(openShelf.id) || new Map()) : new Map();

  // ---- Global find: across all shelves
  const globalFind = useCallback((q: string) => {
    const raw = q.trim();
    if (!raw) return;
    const needle = raw.toLowerCase();
    const match = (p: Product) =>
      p.name.toLowerCase().includes(needle) ||
      (p.product_code || '').toLowerCase() === needle;

    for (const sh of shelves) {
      const shelfProds = productsBySector.get(sh.sector_id) || [];
      const map = placementsByShelf.get(sh.id) || new Map();
      const slot = findSlotInShelf(sh, shelfProds, map, match);
      if (slot) {
        const sec = sectors.find(s => s.id === sh.sector_id);
        setOpenSectorId(sh.sector_id);
        setOpenShelfId(sh.id);
        setHighlight(slot);
        toast.success(`Topildi: ${sec?.name || ''} → ${sh.name} · L${slot.level}·C${slot.column}·R${slot.row}`);
        return;
      }
    }
    for (const sec of sectors) {
      const list = productsBySector.get(sec.id) || [];
      const found = list.find(match);
      if (found) {
        setOpenSectorId(sec.id);
        setHighlight(null);
        toast.success(`Topildi: ${sec.name} (aniq shkaf / joy belgilanmagan)`);
        return;
      }
    }
    toast.error(`"${raw}" topilmadi`);
  }, [shelves, sectors, productsBySector, placementsByShelf]);


  // Slot info computation (read-only)
  const slotInfoProduct = useMemo(() => {
    if (!selectedSlot || !openShelf) return null;
    const pl = openShelfPlacements.get(placementKey(selectedSlot.level, selectedSlot.column, selectedSlot.row));
    if (pl) return { product: pl.product as Product, quantity: pl.quantity };
    if (openShelfPlacements.size === 0) {
      const cols = Math.max(1, openShelf.columns);
      const rows = Math.max(1, openShelf.rows);
      const lvls = Math.max(1, openShelf.levels);
      const total = cols * rows * lvls;
      const idx = (selectedSlot.level - 1) * (cols * rows) + (selectedSlot.row - 1) * cols + (selectedSlot.column - 1);
      let i = 0;
      for (const p of openShelfProducts) {
        const q = Math.max(1, Math.min(p.quantity || 1, total - i));
        if (idx >= i && idx < i + q) return { product: p, quantity: p.quantity };
        i += q;
        if (i >= total) break;
      }
    }
    return null;
  }, [selectedSlot, openShelf, openShelfPlacements, openShelfProducts]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setOpenSectorId(null); setOpenShelfId(null);
      setHighlight(null); setProductQuery(''); setSelectedSlot(null);
    }
  }, [open]);

  return (
    <>
      {/* Root dialog: rooms list */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" /> Ombor xaritasi (faqat ko'rish)
            </DialogTitle>
            <DialogDescription>
              Xonalar va ulardagi shkaflarni 3D ko'rinishda ko'ring. Mahsulotni qidirib, joyini aniqlang.
            </DialogDescription>
          </DialogHeader>

          {/* Global search */}
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1 flex-1 min-w-[180px]">
                <Label className="text-[10px] text-muted-foreground">Mahsulot nomi, kodi yoki RFID</Label>
                <Input
                  placeholder="Masalan: Olma yoki AB12CD34"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); globalFind(productQuery); } }}
                  className="h-8"
                />
              </div>
              <Button size="sm" className="h-8" onClick={() => globalFind(productQuery)}>
                <Search className="w-3.5 h-3.5 mr-1.5" /> Topish
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setScannerOpen(true)}>
                <ScanLine className="w-3.5 h-3.5 mr-1.5" /> QR / Barkod
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Xona qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.length === 0 ? (
                <div className="col-span-full text-center text-muted-foreground py-8 text-sm">
                  {search ? "Natija topilmadi" : "Xonalar mavjud emas"}
                </div>
              ) : filtered.map(({ sector, shelfCount, capacity, occupied, pct }) => (
                <Card key={sector.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setOpenSectorId(sector.id); setHighlight(null); }}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Home className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{sector.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono truncate">
                            {sector.code} · {shelfCount} shkaf · {capacity} slot
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{pct}%</Badge>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground mt-1">Band: {occupied} / {capacity}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sector detail (room map → choose shelf) */}
      <Dialog open={!!openSectorId && !openShelfId} onOpenChange={(o) => { if (!o) setOpenSectorId(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {openSector && (() => {
            const shList = shelvesBySector.get(openSector.id) || [];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Home className="w-5 h-5 text-primary" /> {openSector.name}
                    <Badge variant="outline" className="font-mono text-xs">{openSector.code}</Badge>
                    <Badge variant="secondary" className="text-[10px]">Faqat ko'rish</Badge>
                  </DialogTitle>
                  <DialogDescription>
                    {openSector.description || `${shList.length} ta shkaf`}
                  </DialogDescription>
                </DialogHeader>

                <RoomMap shelves={shList} placements={placements} onClick={(sh) => setOpenShelfId(sh.id)} />

                <div className="space-y-2 mt-2">
                  <Label className="text-xs uppercase text-muted-foreground tracking-wide">Shkaflar</Label>
                  {shList.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-4 border rounded text-center">Bu xonada shkaf yo'q.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {shList.map(sh => {
                        const occ = placements.filter(pl => pl.shelf_id === sh.id).reduce((s, pl) => s + (pl.quantity || 1), 0);
                        const pct = sh.capacity > 0 ? Math.round((occ / sh.capacity) * 100) : 0;
                        const barClass = pct >= 100 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : pct > 0 ? 'bg-blue-500' : 'bg-emerald-500';
                        return (
                          <button key={sh.id} onClick={() => setOpenShelfId(sh.id)}
                            className="flex items-center gap-3 p-3 border rounded-md hover:bg-muted/50 transition text-left">
                            <div className={`w-2 h-12 rounded ${barClass}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{sh.name}</span>
                                <Badge variant="outline" className="font-mono text-[10px]">{sh.code}</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {sh.rows}R × {sh.columns}C × {sh.levels}L · {occ}/{sh.capacity} ({pct}%)
                              </div>
                            </div>
                            <Box className="w-4 h-4 text-muted-foreground" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Shelf 3D/2D detail */}
      <Dialog open={!!openShelfId} onOpenChange={(o) => { if (!o) { setOpenShelfId(null); setHighlight(null); setSelectedSlot(null); } }}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          {openShelf && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpenShelfId(null)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <DialogTitle className="flex items-center gap-2">
                    <Box className="w-5 h-5 text-primary" /> {openShelf.name}
                    <Badge variant="outline" className="font-mono text-xs">{openShelf.code}</Badge>
                  </DialogTitle>
                </div>
                <DialogDescription>
                  {openSector?.name} · {openShelf.rows}R × {openShelf.columns}C × {openShelf.levels}L · sig'im {openShelf.capacity}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                {highlight && (
                  <Badge className="bg-red-500 text-white font-mono">
                    <Target className="w-3 h-3 mr-1" /> L{highlight.level} · C{highlight.column} · R{highlight.row}
                  </Badge>
                )}
                <div className="flex items-center gap-1 ml-auto flex-wrap">
                  {shelfView === '2d' && openShelf.rows > 1 && (
                    <div className="flex items-center gap-1 mr-2">
                      <span className="text-[10px] text-muted-foreground font-mono">Chuqurlik:</span>
                      {Array.from({ length: openShelf.rows }).map((_, i) => (
                        <Button key={i} size="sm" variant={depthRow === i + 1 ? 'default' : 'outline'}
                          onClick={() => setDepthRow(i + 1)} className="h-7 px-2 text-[10px] font-mono">R{i + 1}</Button>
                      ))}
                    </div>
                  )}
                  {highlight && (
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setHighlight(null)}>
                      <X className="w-3.5 h-3.5 mr-1.5" /> Tozalash
                    </Button>
                  )}
                  <Button size="sm" variant={shelfView === '3d' ? 'default' : 'outline'} onClick={() => setShelfView('3d')} className="h-8">
                    <Box className="w-3.5 h-3.5 mr-1.5" /> 3D
                  </Button>
                  <Button size="sm" variant={shelfView === '2d' ? 'default' : 'outline'} onClick={() => { setShelfView('2d'); setDepthRow(1); }} className="h-8">
                    <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> 2D
                  </Button>
                </div>
              </div>

              {shelfView === '3d' ? (
                <SectorRack3D
                  rows={openShelf.rows}
                  columns={openShelf.columns}
                  levels={openShelf.levels}
                  width_cm={openShelf.width_cm}
                  depth_cm={openShelf.depth_cm}
                  height_cm={openShelf.height_cm}
                  products={openShelfProducts}
                  placements={openShelfPlacements as PlacementMap}
                  highlight={highlight}
                  height={460}
                  readOnly
                  onSlotClick={(slot) => setSelectedSlot(slot)}
                />
              ) : (
                <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 bg-muted text-[10px] font-bold text-muted-foreground rounded uppercase tracking-wider font-mono">
                      {openShelf.code}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest font-mono">
                      {openShelf.levels}L × {openShelf.columns}C × {openShelf.rows}R{openShelf.rows > 1 ? ` · R${depthRow}` : ''}
                    </span>
                  </div>
                  <div className="flex flex-col gap-7">
                    {Array.from({ length: openShelf.levels }).map((_, lIdx) => {
                      const L = openShelf.levels - lIdx;
                      const isBottom = lIdx === openShelf.levels - 1;
                      return (
                        <div key={L} className="relative">
                          <span className="absolute -left-5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground font-mono">L{L}</span>
                          <div className="h-2 w-full bg-slate-400 dark:bg-slate-500 rounded-sm shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)] mb-1" />
                          <div className="grid gap-1 h-14 px-1" style={{ gridTemplateColumns: `repeat(${openShelf.columns}, minmax(0, 1fr))` }}>
                            {Array.from({ length: openShelf.columns }).map((_, cIdx) => {
                              const C = cIdx + 1;
                              const R = depthRow;
                              const pl = (openShelfPlacements as PlacementMap).get(placementKey(L, C, R));
                              const isHi = !!highlight && highlight.level === L && highlight.column === C && highlight.row === R;
                              const color = pl ? productColor(pl.product.id) : null;
                              const hiRing = isHi ? 'ring-2 ring-red-500 ring-offset-1 shadow-[0_0_12px_rgba(239,68,68,0.7)] animate-pulse' : '';
                              if (!pl) {
                                return (
                                  <div key={C}
                                    onClick={() => setSelectedSlot({ level: L, column: C, row: R })}
                                    className={`relative border-b-2 border-slate-200 dark:border-slate-700 flex items-end justify-center pb-1 rounded-sm cursor-pointer ${hiRing}`}
                                    title={`Bo'sh · L${L}·C${C}·R${R}`}>
                                    <div className={`w-full h-1 rounded-full ${isHi ? 'bg-red-500' : 'bg-success/30'}`} />
                                  </div>
                                );
                              }
                              return (
                                <div key={C}
                                  onClick={() => setSelectedSlot({ level: L, column: C, row: R })}
                                  className={`relative h-14 rounded-sm border shadow-sm flex flex-col items-center justify-end overflow-hidden cursor-pointer ${hiRing}`}
                                  style={{ background: `linear-gradient(180deg, ${color}33, ${color}55)`, borderColor: `${color}99` }}
                                  title={`${pl.product.name} ×${pl.quantity} · L${L}·C${C}·R${R}`}>
                                  <span className="text-[10px] font-bold uppercase tracking-tighter truncate px-0.5 leading-none pb-1" style={{ color: color! }}>
                                    {pl.product.name.slice(0, 10)}
                                  </span>
                                  {isHi && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-red-500">★</span>}
                                </div>
                              );
                            })}
                          </div>
                          {isBottom && <div className="h-1.5 w-[calc(100%+8px)] -ml-1 bg-slate-500 dark:bg-slate-600 rounded-full mt-1" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {openShelfProducts.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" /> Xonadagi mahsulotlar ({openShelfProducts.length})
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {openShelfProducts.map(p => (
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

      {/* Slot info */}
      <Dialog open={!!selectedSlot} onOpenChange={(o) => { if (!o) setSelectedSlot(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" /> Katak ma'lumoti
            </DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <div className="space-y-3 py-2">
              <Badge variant="outline" className="font-mono">L{selectedSlot.level} · C{selectedSlot.column} · R{selectedSlot.row}</Badge>
              {slotInfoProduct ? (
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ background: productColor(slotInfoProduct.product.id) }} />
                    <span className="font-semibold text-sm">{slotInfoProduct.product.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-muted-foreground">Miqdor:</div>
                    <div className="font-medium text-right">{slotInfoProduct.quantity} dona</div>
                    {slotInfoProduct.product.product_code && (
                      <>
                        <div className="text-muted-foreground">Kod:</div>
                        <div className="font-medium font-mono text-right">{slotInfoProduct.product.product_code}</div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Bu katak bo'sh.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* QR scanner */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-primary" /> QR yoki barkodni skanerlash
            </DialogTitle>
            <DialogDescription>Mahsulot kodini ko'rsating — joyi avtomatik topiladi</DialogDescription>
          </DialogHeader>
          {scannerOpen && (
            <QrScanner
              onScan={(code) => { setScannerOpen(false); setProductQuery(code); globalFind(code); }}
              onClose={() => setScannerOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---- Room map (read-only) ----
function RoomMap({
  shelves, placements, onClick,
}: { shelves: Shelf[]; placements: Placement[]; onClick: (sh: Shelf) => void }) {
  if (shelves.length === 0) {
    return <div className="aspect-[2/1] border-2 border-dashed rounded-lg flex items-center justify-center text-sm text-muted-foreground bg-muted/20">Shkaflar yo'q</div>;
  }
  const padding = 50;
  const xs = shelves.map(s => s.position_x);
  const ys = shelves.map(s => s.position_y);
  const xMax = Math.max(...xs.map((x, i) => x + shelves[i].width_cm), 100);
  const yMax = Math.max(...ys.map((y, i) => y + shelves[i].depth_cm), 100);
  const xMin = Math.min(...xs, 0);
  const yMin = Math.min(...ys, 0);
  const w = xMax - xMin + padding * 2;
  const h = yMax - yMin + padding * 2;

  return (
    <div className="border rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-2 overflow-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 360 }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="grid-viewer" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeOpacity="0.06" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-viewer)" />
        <rect x={padding / 2} y={padding / 2} width={w - padding} height={h - padding}
          fill="none" stroke="currentColor" strokeOpacity="0.2" strokeDasharray="4 4" rx="8" />
        {shelves.map((sh) => {
          const occ = placements.filter(pl => pl.shelf_id === sh.id).reduce((s, pl) => s + (pl.quantity || 1), 0);
          const pct = sh.capacity > 0 ? Math.round((occ / sh.capacity) * 100) : 0;
          const fillClass = pct >= 100 ? 'fill-red-500/70' : pct >= 70 ? 'fill-amber-500/70' : pct > 0 ? 'fill-blue-500/60' : 'fill-emerald-500/40';
          const x = sh.position_x - xMin + padding;
          const y = sh.position_y - yMin + padding;
          return (
            <g key={sh.id} className="cursor-pointer" onClick={() => onClick(sh)}>
              <rect x={x} y={y} width={sh.width_cm} height={sh.depth_cm} rx="4"
                className={`${fillClass} hover:opacity-90 transition`}
                stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5"
                transform={sh.orientation ? `rotate(${sh.orientation} ${x + sh.width_cm / 2} ${y + sh.depth_cm / 2})` : undefined} />
              <text x={x + sh.width_cm / 2} y={y + sh.depth_cm / 2}
                textAnchor="middle" dominantBaseline="middle"
                className="fill-white font-bold pointer-events-none"
                style={{ fontSize: Math.min(24, sh.depth_cm / 3) }}>{sh.code}</text>
              <text x={x + sh.width_cm / 2} y={y + sh.depth_cm / 2 + 18}
                textAnchor="middle" className="fill-white/80 pointer-events-none" style={{ fontSize: 12 }}>{pct}%</text>
            </g>
          );
        })}
      </svg>
      <p className="text-[11px] text-muted-foreground text-center mt-1">Shkaf ustiga bosing — 3D ochiladi</p>
    </div>
  );
}
