import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { MapPin, Search, Loader2, Box, LayoutGrid, Target, X, ScanLine, Eye, Package, Info } from 'lucide-react';
import { toast } from 'sonner';
import SectorRack3D, { placementKey, type PlacementMap, type HighlightSlot } from '@/components/SectorRack3D';
import QrScanner from '@/components/QrScanner';

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
}

interface Product {
  id: string;
  name: string;
  sector_id: string | null;
  quantity: number;
  product_code?: string | null;
  nfc_id?: string | null;
}

interface Placement {
  id: string;
  sector_id: string;
  product_id: string;
  level: number;
  column_idx: number;
  row_idx: number;
  quantity: number;
}

interface SectorWithProducts extends Sector {
  products: Product[];
  occupied: number;
  placements: PlacementMap;
  placementRows: Placement[];
}

function productColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 55%)`;
}

function findProductSlot(
  sector: { rows: number; columns: number; levels: number; products: Product[]; placements: PlacementMap },
  predicate: (p: Product) => boolean,
): HighlightSlot | null {
  // 1) Prefer explicit placement if any
  for (const [key, val] of sector.placements.entries()) {
    if (predicate(val.product as Product)) {
      const [l, c, r] = key.split('-').map(Number);
      return { level: l, column: c, row: r };
    }
  }
  // 2) Fallback: sequential fill (same as admin)
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function SectorsViewer({ open, onOpenChange }: Props) {
  const [sectors, setSectors] = useState<SectorWithProducts[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detailSector, setDetailSector] = useState<SectorWithProducts | null>(null);
  const [detailView, setDetailView] = useState<'3d' | '2d'>('3d');
  const [highlight, setHighlight] = useState<HighlightSlot | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [depthRow, setDepthRow] = useState(1);
  const [selectedSlot, setSelectedSlot] = useState<HighlightSlot | null>(null);

  const fetchSectors = useCallback(async () => {
    setLoading(true);
    const [sectorsRes, productsRes, placementsRes] = await Promise.all([
      supabase.from('sectors').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, sector_id, quantity, product_code, nfc_id'),
      supabase.from('product_placements').select('*'),
    ]);
    if (sectorsRes.error) {
      toast.error('Sektorlarni yuklashda xatolik');
      setLoading(false);
      return;
    }
    const products = (productsRes.data || []) as Product[];
    const productById = new Map(products.map(p => [p.id, p]));
    const bySector: Record<string, Product[]> = {};
    products.forEach(p => { if (p.sector_id) (bySector[p.sector_id] ||= []).push(p); });
    const placements = (placementsRes.data || []) as Placement[];
    const placementsBySector: Record<string, Placement[]> = {};
    placements.forEach(pl => { (placementsBySector[pl.sector_id] ||= []).push(pl); });

    const enriched: SectorWithProducts[] = (sectorsRes.data || []).map(s => {
      const list = bySector[s.id] || [];
      const plList = placementsBySector[s.id] || [];
      const map: PlacementMap = new Map();
      plList.forEach(pl => {
        const prod = productById.get(pl.product_id);
        if (prod) map.set(placementKey(pl.level, pl.column_idx, pl.row_idx), { product: prod, quantity: pl.quantity });
      });
      const occupiedFromPlacements = plList.reduce((sum, pl) => sum + pl.quantity, 0);
      const occupied = map.size > 0
        ? Math.min(occupiedFromPlacements, s.capacity)
        : Math.min(list.reduce((sum, p) => sum + (p.quantity || 0), 0), s.capacity);
      return { ...s, products: list, occupied, placements: map, placementRows: plList };
    });
    setSectors(enriched);
    setDetailSector(prev => prev ? (enriched.find(e => e.id === prev.id) ?? null) : null);
    setLoading(false);
  }, []);

  useEffect(() => { if (open) fetchSectors(); }, [open, fetchSectors]);

  // RFID (Web Serial) UID — dialog ochiq bo'lsa, avtomatik global qidiruv
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const uid = (e as CustomEvent<string>).detail;
      if (!uid) return;
      setProductQuery(uid);
      globalFind(uid);
    };
    window.addEventListener('web-serial-uid', handler as EventListener);
    return () => window.removeEventListener('web-serial-uid', handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sectors]);

  const filtered = sectors.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  // Global product search across all sectors → opens detail and highlights
  const globalFind = (q: string) => {
    const raw = q.trim();
    if (!raw) return;
    const needle = raw.toLowerCase();
    const match = (p: Product) =>
      p.name.toLowerCase().includes(needle) ||
      (p.product_code || '').toLowerCase() === needle ||
      (p.nfc_id || '').toLowerCase() === needle;

    // 1) Try exact placement slot first
    for (const s of sectors) {
      const slot = findProductSlot(s, match);
      if (slot) {
        setDetailSector(s);
        setHighlight(slot);
        toast.success(`Topildi: ${s.name} · L${slot.level}·C${slot.column}·R${slot.row}`);
        return;
      }
    }
    // 2) Fallback: product assigned to sector but not placed in a cell
    for (const s of sectors) {
      const prod = s.products.find(match);
      if (prod) {
        setDetailSector(s);
        setHighlight(null);
        toast.success(`Topildi: ${s.name} (aniq joy belgilanmagan)`);
        return;
      }
    }
    toast.error(`"${raw}" topilmadi`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setDetailSector(null); setHighlight(null); setProductQuery(''); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" /> Ombor xaritasi (faqat ko'rish)
            </DialogTitle>
            <DialogDescription>
              Sektorlarni 3D ko'rinishda ko'ring. Mahsulotni qidirib, joyini aniqlang.
            </DialogDescription>
          </DialogHeader>

          {/* Global find */}
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1 flex-1 min-w-[180px]">
                <Label className="text-[10px] text-muted-foreground">Mahsulot nomi yoki kodi</Label>
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
            <Input placeholder="Sektor qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.length === 0 ? (
                <div className="col-span-full text-center text-muted-foreground py-8 text-sm">
                  {search ? "Natija topilmadi" : "Sektor mavjud emas"}
                </div>
              ) : filtered.map(s => {
                const pct = s.capacity > 0 ? Math.round((s.occupied / s.capacity) * 100) : 0;
                return (
                  <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setDetailSector(s); setHighlight(null); }}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{s.name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono truncate">{s.code} · {s.products.length} mahsulot</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{pct}%</Badge>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sector detail (read-only) */}
      <Dialog open={!!detailSector} onOpenChange={(o) => { if (!o) { setDetailSector(null); setHighlight(null); setSelectedSlot(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailSector && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  {detailSector.name}
                  <Badge variant="outline" className="font-mono">{detailSector.code}</Badge>
                  <Badge variant="secondary" className="text-[10px]">Faqat ko'rish</Badge>
                </DialogTitle>
                <DialogDescription>
                  {detailSector.description || "Sektor ko'rinishi"}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                {highlight && (
                  <Badge className="bg-red-500 text-white font-mono">
                    <Target className="w-3 h-3 mr-1" /> L{highlight.level} · C{highlight.column} · R{highlight.row}
                  </Badge>
                )}
                <div className="flex items-center gap-1 ml-auto flex-wrap">
                  {detailView === '2d' && detailSector.rows > 1 && (
                    <div className="flex items-center gap-1 mr-2">
                      <span className="text-[10px] text-muted-foreground font-mono">Chuqurlik:</span>
                      {Array.from({ length: detailSector.rows }).map((_, i) => (
                        <Button
                          key={i}
                          size="sm"
                          variant={depthRow === i + 1 ? 'default' : 'outline'}
                          onClick={() => setDepthRow(i + 1)}
                          className="h-7 px-2 text-[10px] font-mono"
                        >
                          R{i + 1}
                        </Button>
                      ))}
                    </div>
                  )}
                  {highlight && (
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setHighlight(null)}>
                      <X className="w-3.5 h-3.5 mr-1.5" /> Tozalash
                    </Button>
                  )}
                  <Button size="sm" variant={detailView === '3d' ? 'default' : 'outline'} onClick={() => setDetailView('3d')} className="h-8">
                    <Box className="w-3.5 h-3.5 mr-1.5" /> 3D
                  </Button>
                  <Button size="sm" variant={detailView === '2d' ? 'default' : 'outline'} onClick={() => { setDetailView('2d'); setDepthRow(1); }} className="h-8">
                    <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> 2D
                  </Button>
                </div>
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
                  placements={detailSector.placements}
                  highlight={highlight}
                  height={460}
                  readOnly
                  onSlotClick={(slot) => setSelectedSlot(slot)}
                />
              ) : (
                <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 bg-muted text-[10px] font-bold text-muted-foreground rounded uppercase tracking-wider font-mono">
                      {detailSector.code}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest font-mono">
                      {detailSector.levels}L × {detailSector.columns}C × {detailSector.rows}R{detailSector.rows > 1 ? ` · R${depthRow}` : ''}
                    </span>
                  </div>
                  <div className="flex flex-col gap-7">
                    {Array.from({ length: detailSector.levels }).map((_, lIdx) => {
                      const L = detailSector.levels - lIdx;
                      const isBottom = lIdx === detailSector.levels - 1;
                      return (
                        <div key={L} className="relative">
                          <span className="absolute -left-5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground font-mono">L{L}</span>
                          <div className="h-2 w-full bg-slate-400 dark:bg-slate-500 rounded-sm shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)] mb-1" />
                          <div className="grid gap-1 h-14 px-1" style={{ gridTemplateColumns: `repeat(${detailSector.columns}, minmax(0, 1fr))` }}>
                            {Array.from({ length: detailSector.columns }).map((_, cIdx) => {
                              const C = cIdx + 1;
                              const R = depthRow;
                              const pl = detailSector.placements.get(placementKey(L, C, R));
                              const isHi = !!highlight && highlight.level === L && highlight.column === C && highlight.row === R;
                              const color = pl ? productColor(pl.product.id) : null;
                              const hiRing = isHi ? 'ring-2 ring-red-500 ring-offset-1 shadow-[0_0_12px_rgba(239,68,68,0.7)] animate-pulse' : '';
                              if (!pl) {
                                return (
                                  <div
                                    key={C}
                                    className={`relative border-b-2 border-slate-200 dark:border-slate-700 flex items-end justify-center pb-1 rounded-sm ${hiRing}`}
                                    title={`Bo'sh · L${L}·C${C}·R${R}`}
                                  >
                                    <div className={`w-full h-1 rounded-full ${isHi ? 'bg-red-500' : 'bg-success/30'}`} />
                                  </div>
                                );
                              }
                              return (
                                <div
                                  key={C}
                                  className={`relative h-14 rounded-sm border shadow-sm flex flex-col items-center justify-end overflow-hidden ${hiRing}`}
                                  style={{ background: `linear-gradient(180deg, ${color}33, ${color}55)`, borderColor: `${color}99` }}
                                  title={`${pl.product.name} ×${pl.quantity} · L${L}·C${C}·R${R}`}
                                >
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

      {/* Slot info dialog */}
      <Dialog open={!!selectedSlot} onOpenChange={(o) => { if (!o) setSelectedSlot(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Katak ma'lumoti
            </DialogTitle>
          </DialogHeader>
          {selectedSlot && detailSector && (() => {
            const pl = detailSector.placements.get(placementKey(selectedSlot.level, selectedSlot.column, selectedSlot.row));
            let prod: Product | null = null;
            let qty = 0;
            if (pl) {
              prod = pl.product as Product;
              qty = pl.quantity;
            } else if (detailSector.placements.size === 0) {
              // Sequential fill fallback (matches 3D render order)
              const cols = Math.max(1, detailSector.columns);
              const rows = Math.max(1, detailSector.rows);
              const lvls = Math.max(1, detailSector.levels);
              const total = cols * rows * lvls;
              const idx = (selectedSlot.level - 1) * (cols * rows) + (selectedSlot.row - 1) * cols + (selectedSlot.column - 1);
              let i = 0;
              for (const p of detailSector.products) {
                const q = Math.max(1, Math.min(p.quantity || 1, total - i));
                if (idx >= i && idx < i + q) { prod = p; qty = p.quantity; break; }
                i += q;
                if (i >= total) break;
              }
            }
            if (!prod) {
              return (
                <div className="space-y-3 py-2">
                  <Badge variant="outline" className="font-mono">L{selectedSlot.level} · C{selectedSlot.column} · R{selectedSlot.row}</Badge>
                  <p className="text-sm text-muted-foreground">Bu katak bo'sh.</p>
                </div>
              );
            }
            return (
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">L{selectedSlot.level} · C{selectedSlot.column} · R{selectedSlot.row}</Badge>
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ background: productColor(prod.id) }} />
                    <span className="font-semibold text-sm">{prod.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-muted-foreground">Miqdor:</div>
                    <div className="font-medium text-right">{qty} dona</div>
                    {prod.product_code && (
                      <>
                        <div className="text-muted-foreground">Kod:</div>
                        <div className="font-medium font-mono text-right">{prod.product_code}</div>
                      </>
                    )}
                    {prod.nfc_id && (
                      <>
                        <div className="text-muted-foreground">NFC:</div>
                        <div className="font-medium font-mono text-right">{prod.nfc_id}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

        </DialogContent>
      </Dialog>

      {/* QR scanner */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-primary" /> QR yoki barkodni skanerlash
            </DialogTitle>
            <DialogDescription>
              Mahsulot kodini ko'rsating — joyi avtomatik topiladi
            </DialogDescription>
          </DialogHeader>
          {scannerOpen && (
            <QrScanner
              onScan={(code) => {
                setScannerOpen(false);
                setProductQuery(code);
                globalFind(code);
              }}
              onClose={() => setScannerOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
