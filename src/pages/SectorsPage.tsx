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
import {
  Plus, MoreHorizontal, Pencil, Trash2, Search, Loader2, MapPin,
  Package, Box, LayoutGrid, Target, X, ScanLine, Layers, Info, Home,
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorMessages';
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
  created_at: string;
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
  product_code: string | null;
  nfc_id: string | null;
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

// ---- Helpers --------------------------------------------------------------

function colorForOcc(pct: number): string {
  if (pct >= 100) return 'bg-destructive/80';
  if (pct >= 70) return 'bg-warning/80';
  if (pct > 0) return 'bg-primary/70';
  return 'bg-success/60';
}

function findProductSlot(
  shelf: Shelf,
  shelfProducts: Product[],
  predicate: (p: Product) => boolean,
): HighlightSlot | null {
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

// ---- Main Page ------------------------------------------------------------

export default function SectorsPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Sector dialog
  const [sectorDialogOpen, setSectorDialogOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [sectorForm, setSectorForm] = useState({ name: '', code: '', description: '', position_x: 0, position_y: 0, orientation: 0 });

  // Delete sector
  const [deletingSector, setDeletingSector] = useState<Sector | null>(null);

  // Open detail
  const [openSectorId, setOpenSectorId] = useState<string | null>(null);

  // Shelf dialog
  const [shelfDialogOpen, setShelfDialogOpen] = useState(false);
  const [editingShelf, setEditingShelf] = useState<Shelf | null>(null);
  const [shelfForm, setShelfForm] = useState({
    name: '', code: '',
    rows: 3, columns: 5, levels: 2,
    width_cm: 200, depth_cm: 60, height_cm: 180,
    position_x: 0, position_y: 0, orientation: 0,
  });
  const [deletingShelf, setDeletingShelf] = useState<Shelf | null>(null);

  // Shelf detail (3D)
  const [openShelfId, setOpenShelfId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<HighlightSlot | null>(null);
  const [shelfSearch, setShelfSearch] = useState('');
  const [shelfQrOpen, setShelfQrOpen] = useState(false);
  const [slotInfo, setSlotInfo] = useState<{ slot: HighlightSlot; product: Product | null } | null>(null);

  // Fetch
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [secRes, shRes, pRes, plRes] = await Promise.all([
      supabase.from('sectors').select('*').order('code'),
      supabase.from('shelves').select('*').order('code'),
      supabase.from('products').select('id, name, sector_id, quantity, product_code, nfc_id').order('name'),
      supabase.from('product_placements').select('*'),
    ]);
    if (secRes.error) toast.error('Xonalarni yuklashda xatolik');
    else setSectors(secRes.data || []);
    if (shRes.error) toast.error('Shkaflarni yuklashda xatolik');
    else setShelves(shRes.data || []);
    if (pRes.error) toast.error('Mahsulotlarni yuklashda xatolik');
    else setProducts(pRes.data || []);
    if (plRes.error) toast.error('Joylashtirishlarni yuklashda xatolik');
    else setPlacements(plRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Derived
  const productsBySector = useMemo(() => {
    const m = new Map<string, Product[]>();
    products.forEach(p => {
      if (!p.sector_id) return;
      if (!m.has(p.sector_id)) m.set(p.sector_id, []);
      m.get(p.sector_id)!.push(p);
    });
    return m;
  }, [products]);

  const shelvesBySector = useMemo(() => {
    const m = new Map<string, Shelf[]>();
    shelves.forEach(sh => {
      if (!m.has(sh.sector_id)) m.set(sh.sector_id, []);
      m.get(sh.sector_id)!.push(sh);
    });
    return m;
  }, [shelves]);

  const placementsByShelf = useMemo(() => {
    const m = new Map<string, PlacementMap>();
    placements.forEach(pl => {
      if (!m.has(pl.shelf_id)) m.set(pl.shelf_id, new Map());
      const prod = products.find(p => p.id === pl.product_id);
      if (!prod) return;
      m.get(pl.shelf_id)!.set(placementKey(pl.level, pl.column_idx, pl.row_idx), { product: prod, quantity: pl.quantity });
    });
    return m;
  }, [placements, products]);

  // Shkaflar bo'yicha bandlik: aniq joylashuv + qolgan mahsulotlarni ketma-ket taqsimlash
  const shelfOccupancy = useMemo(() => {
    const map = new Map<string, number>();
    sectors.forEach(s => {
      const shList = shelvesBySector.get(s.id) || [];
      const sectorProds = productsBySector.get(s.id) || [];
      const placedIds = new Set<string>();
      const explicit = new Map<string, number>();
      placements.forEach(pl => {
        const sh = shList.find(x => x.id === pl.shelf_id);
        if (!sh) return;
        explicit.set(pl.shelf_id, (explicit.get(pl.shelf_id) || 0) + (pl.quantity || 1));
        placedIds.add(pl.product_id);
      });
      let unplaced = sectorProds
        .filter(p => !placedIds.has(p.id))
        .reduce((sum, p) => sum + (p.quantity || 0), 0);
      shList.forEach(sh => {
        const ex = explicit.get(sh.id) || 0;
        const free = Math.max(0, (sh.capacity || 0) - ex);
        const take = Math.min(free, unplaced);
        unplaced -= take;
        map.set(sh.id, ex + take);
      });
    });
    return map;
  }, [sectors, shelvesBySector, productsBySector, placements]);

  const sectorStats = useMemo(() => {
    return sectors.map(s => {
      const shList = shelvesBySector.get(s.id) || [];
      const capacity = shList.reduce((sum, sh) => sum + (sh.capacity || 0), 0);
      const occupied = (productsBySector.get(s.id) || []).reduce((sum, p) => sum + (p.quantity || 0), 0);
      const pct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;
      return { sector: s, shelfCount: shList.length, capacity, occupied, pct };
    });
  }, [sectors, shelvesBySector, productsBySector]);

  const filteredSectors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sectorStats;
    return sectorStats.filter(({ sector }) =>
      sector.name.toLowerCase().includes(q) ||
      sector.code.toLowerCase().includes(q) ||
      (sector.description || '').toLowerCase().includes(q),
    );
  }, [sectorStats, search]);

  const totalStats = useMemo(() => {
    const capacity = sectorStats.reduce((s, x) => s + x.capacity, 0);
    const occupied = sectorStats.reduce((s, x) => s + x.occupied, 0);
    return { capacity, occupied, free: Math.max(0, capacity - occupied) };
  }, [sectorStats]);

  // ---- Sector CRUD --------------------------------------------------------
  const openCreateSector = () => {
    setEditingSector(null);
    setSectorForm({ name: '', code: '', description: '', position_x: 0, position_y: 0, orientation: 0 });
    setSectorDialogOpen(true);
  };
  const openEditSector = (s: Sector) => {
    setEditingSector(s);
    setSectorForm({
      name: s.name, code: s.code, description: s.description || '',
      position_x: s.position_x, position_y: s.position_y, orientation: s.orientation,
    });
    setSectorDialogOpen(true);
  };
  const submitSector = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSector) {
        const { error } = await supabase.from('sectors').update({
          name: sectorForm.name.trim(),
          code: sectorForm.code.trim().toUpperCase() || editingSector.code,
          description: sectorForm.description.trim() || null,
          position_x: sectorForm.position_x,
          position_y: sectorForm.position_y,
          orientation: sectorForm.orientation,
        }).eq('id', editingSector.id);
        if (error) throw error;
        toast.success('Xona yangilandi');
      } else {
        const { data, error } = await supabase.from('sectors').insert({
          name: sectorForm.name.trim(),
          code: sectorForm.code.trim().toUpperCase() || undefined,
          description: sectorForm.description.trim() || null,
          position_x: sectorForm.position_x,
          position_y: sectorForm.position_y,
          orientation: sectorForm.orientation,
        }).select().single();
        if (error) throw error;
        // Avto-yarataylik: yangi xonaga 1 ta standart shkaf
        if (data) {
          await supabase.from('shelves').insert({
            sector_id: data.id, name: 'Asosiy shkaf', code: 'A1',
          });
        }
        toast.success("Xona qo'shildi (Asosiy shkaf avtomatik yaratildi)");
      }
      setSectorDialogOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };
  const confirmDeleteSector = async () => {
    if (!deletingSector) return;
    const hasProducts = (productsBySector.get(deletingSector.id) || []).length > 0;
    if (hasProducts) {
      toast.error("Bu xonada mahsulot bor. Avval mahsulotlarni boshqa xonaga ko'chiring.");
      setDeletingSector(null);
      return;
    }
    try {
      const { error } = await supabase.from('sectors').delete().eq('id', deletingSector.id);
      if (error) throw error;
      toast.success("Xona o'chirildi");
      setDeletingSector(null);
      fetchAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // ---- Shelf CRUD ---------------------------------------------------------
  const openCreateShelf = (sectorId: string) => {
    setEditingShelf({ sector_id: sectorId } as Shelf);
    const existing = shelvesBySector.get(sectorId) || [];
    const nextCode = `A${existing.length + 1}`;
    setShelfForm({
      name: `Shkaf ${existing.length + 1}`, code: nextCode,
      rows: 3, columns: 5, levels: 2,
      width_cm: 200, depth_cm: 60, height_cm: 180,
      position_x: existing.length * 250, position_y: 0, orientation: 0,
    });
    setShelfDialogOpen(true);
  };
  const openEditShelf = (sh: Shelf) => {
    setEditingShelf(sh);
    setShelfForm({
      name: sh.name, code: sh.code,
      rows: sh.rows, columns: sh.columns, levels: sh.levels,
      width_cm: sh.width_cm, depth_cm: sh.depth_cm, height_cm: sh.height_cm,
      position_x: sh.position_x, position_y: sh.position_y, orientation: sh.orientation,
    });
    setShelfDialogOpen(true);
  };
  const submitShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShelf) return;
    const isEdit = !!editingShelf.id;
    const newCap = Math.max(1, shelfForm.rows * shelfForm.columns * shelfForm.levels);
    if (isEdit) {
      // Band slotlardan kam qila olmaslik tekshiruvi
      const occInThisShelf = placements
        .filter(pl => pl.shelf_id === editingShelf.id)
        .reduce((s, pl) => s + (pl.quantity || 1), 0);
      if (newCap < occInThisShelf) {
        toast.error(`Yangi sig'im (${newCap}) hozirgi band slotlardan (${occInThisShelf}) kam bo'lishi mumkin emas.`);
        return;
      }
    }
    try {
      if (isEdit) {
        const { error } = await supabase.from('shelves').update({
          name: shelfForm.name.trim(),
          code: shelfForm.code.trim().toUpperCase() || editingShelf.code,
          rows: shelfForm.rows,
          columns: shelfForm.columns,
          levels: shelfForm.levels,
          width_cm: shelfForm.width_cm,
          depth_cm: shelfForm.depth_cm,
          height_cm: shelfForm.height_cm,
          position_x: shelfForm.position_x,
          position_y: shelfForm.position_y,
          orientation: shelfForm.orientation,
        }).eq('id', editingShelf.id);
        if (error) throw error;
        toast.success('Shkaf yangilandi');
      } else {
        const { error } = await supabase.from('shelves').insert({
          sector_id: editingShelf.sector_id,
          name: shelfForm.name.trim(),
          code: shelfForm.code.trim().toUpperCase() || undefined,
          rows: shelfForm.rows,
          columns: shelfForm.columns,
          levels: shelfForm.levels,
          width_cm: shelfForm.width_cm,
          depth_cm: shelfForm.depth_cm,
          height_cm: shelfForm.height_cm,
          position_x: shelfForm.position_x,
          position_y: shelfForm.position_y,
          orientation: shelfForm.orientation,
        });
        if (error) throw error;
        toast.success("Shkaf qo'shildi");
      }
      setShelfDialogOpen(false);
      setEditingShelf(null);
      fetchAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };
  const confirmDeleteShelf = async () => {
    if (!deletingShelf) return;
    const hasPl = placements.some(pl => pl.shelf_id === deletingShelf.id);
    if (hasPl) {
      toast.error("Bu shkafda joylashtirilgan mahsulotlar bor. Avval ularni boshqa shkafga ko'chiring.");
      setDeletingShelf(null);
      return;
    }
    try {
      const { error } = await supabase.from('shelves').delete().eq('id', deletingShelf.id);
      if (error) throw error;
      toast.success("Shkaf o'chirildi");
      setDeletingShelf(null);
      fetchAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // ---- Open shelf 3D ------------------------------------------------------
  const openShelf = (shelfId: string) => {
    setOpenShelfId(shelfId);
    setHighlight(null);
    setShelfSearch('');
    setSlotInfo(null);
  };

  const openShelfData = useMemo(() => {
    if (!openShelfId) return null;
    const shelf = shelves.find(s => s.id === openShelfId);
    if (!shelf) return null;
    const sectorProducts = productsBySector.get(shelf.sector_id) || [];
    const placementsMap = placementsByShelf.get(shelf.id) || new Map();
    // Bu shkafga aniq joylashtirilgan mahsulotlar
    const placedProductIds = new Set<string>();
    placements.forEach(pl => { if (pl.shelf_id === shelf.id) placedProductIds.add(pl.product_id); });
    // Tegishli (sektordagi) mahsulotlar — agar explicit placement bo'lmasa, ketma-ket fill uchun ishlatamiz
    const shelfProducts = sectorProducts;
    return { shelf, products: shelfProducts, placementsMap, placedProductIds };
  }, [openShelfId, shelves, productsBySector, placementsByShelf, placements]);

  // Shelf search → highlight
  const runShelfSearch = useCallback((rawQuery: string) => {
    const q = rawQuery.trim();
    if (!q || !openShelfData) return;
    const { shelf, products: shelfProducts, placementsMap } = openShelfData;
    const ql = q.toLowerCase();
    const matches = (p: Product) =>
      p.name.toLowerCase().includes(ql) ||
      (p.product_code || '').toLowerCase().includes(ql) ||
      (p.nfc_id || '').toLowerCase() === ql ||
      (p.nfc_id || '').toLowerCase().includes(ql);
    // 1) Aniq placement?
    for (const [key, val] of placementsMap.entries()) {
      if (matches(val.product)) {
        const [l, c, r] = key.split('-').map(Number);
        setHighlight({ level: l, column: c, row: r });
        toast.success(`Topildi: L${l}·C${c}·R${r}`);
        return;
      }
    }
    // 2) Ketma-ket
    const slot = findProductSlot(shelf, shelfProducts, matches);
    if (slot) {
      setHighlight(slot);
      toast.success(`Topildi: L${slot.level}·C${slot.column}·R${slot.row}`);
    } else {
      toast.error("Bu shkafda topilmadi");
    }
  }, [openShelfData]);

  // Listen for RFID
  useEffect(() => {
    const handler = (e: Event) => {
      const uid = (e as CustomEvent<string>).detail;
      if (!uid || !openShelfId) return;
      setShelfSearch(uid);
      runShelfSearch(uid);
    };
    window.addEventListener('web-serial-uid', handler as EventListener);
    return () => window.removeEventListener('web-serial-uid', handler as EventListener);
  }, [openShelfId, runShelfSearch]);

  // Slot click → info
  const onSlotClick = (slot: HighlightSlot) => {
    if (!openShelfData) return;
    const { shelf, products: shelfProducts, placementsMap } = openShelfData;
    const pl = placementsMap.get(placementKey(slot.level, slot.column, slot.row));
    if (pl) {
      setSlotInfo({ slot, product: pl.product });
      return;
    }
    // Ketma-ket fill (faqat explicit placement bo'lmaganda)
    if (placementsMap.size === 0) {
      const cols = Math.max(1, shelf.columns);
      const rows = Math.max(1, shelf.rows);
      const idx = (slot.level - 1) * (cols * rows) + (slot.row - 1) * cols + (slot.column - 1);
      let i = 0;
      for (const p of shelfProducts) {
        const q = Math.max(1, p.quantity || 1);
        if (idx < i + q) { setSlotInfo({ slot, product: p }); return; }
        i += q;
      }
    }
    setSlotInfo({ slot, product: null });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Xonalar va shkaflar</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Omborning xonalari va ulardagi shkaflarni boshqaring
            </p>
          </div>
          <Button onClick={openCreateSector} size="lg">
            <Plus className="w-4 h-4 mr-2" /> Yangi xona
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Xonalar" value={sectors.length} icon={<Home className="w-4 h-4" />} />
          <StatCard label="Shkaflar" value={shelves.length} icon={<Layers className="w-4 h-4" />} />
          <StatCard label="Umumiy sig'im" value={totalStats.capacity} icon={<Box className="w-4 h-4" />} />
          <StatCard label="Bo'sh joy" value={totalStats.free} icon={<Package className="w-4 h-4" />} sub={`band: ${totalStats.occupied}`} />
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Xona qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sector cards */}
        {filteredSectors.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            {sectors.length === 0 ? "Hali xonalar yo'q. \"Yangi xona\" tugmasini bosing." : "Hech narsa topilmadi"}
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSectors.map(({ sector, shelfCount, capacity, occupied, pct }) => (
              <Card
                key={sector.id}
                className="group hover:shadow-md transition cursor-pointer"
                onClick={() => setOpenSectorId(sector.id)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold truncate">{sector.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{sector.code}</p>
                      {sector.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sector.description}</p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1 -mt-1">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => openEditSector(sector)}>
                          <Pencil className="w-4 h-4 mr-2" /> Tahrirlash
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeletingSector(sector)} className="text-destructive focus:text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> O'chirish
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="gap-1"><Layers className="w-3 h-3" /> {shelfCount} shkaf</Badge>
                    <Badge variant="outline" className="gap-1"><Box className="w-3 h-3" /> {capacity} slot</Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Band</span>
                      <span className="font-medium">{occupied} / {capacity} ({pct}%)</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ---- Sector Create/Edit dialog ---- */}
      <Dialog open={sectorDialogOpen} onOpenChange={setSectorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSector ? 'Xonani tahrirlash' : 'Yangi xona'}</DialogTitle>
            <DialogDescription>
              Xona — bu omborning bir qismi. Ichida bir nechta shkaf bo'lishi mumkin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitSector} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Nomi *</Label>
                <Input required value={sectorForm.name} onChange={(e) => setSectorForm({ ...sectorForm, name: e.target.value })} placeholder="masalan: Sklad A" />
              </div>
              <div className="space-y-1.5">
                <Label>Kodi</Label>
                <Input value={sectorForm.code} onChange={(e) => setSectorForm({ ...sectorForm, code: e.target.value.toUpperCase() })} placeholder="auto" className="font-mono uppercase" maxLength={6} />
              </div>
              <div className="space-y-1.5">
                <Label>Burilish (°)</Label>
                <Input type="number" value={sectorForm.orientation} onChange={(e) => setSectorForm({ ...sectorForm, orientation: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Izoh</Label>
                <Textarea value={sectorForm.description} onChange={(e) => setSectorForm({ ...sectorForm, description: e.target.value })} rows={2} placeholder="ixtiyoriy" />
              </div>
              <div className="space-y-1.5">
                <Label>Ombor X (cm)</Label>
                <Input type="number" value={sectorForm.position_x} onChange={(e) => setSectorForm({ ...sectorForm, position_x: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Ombor Y (cm)</Label>
                <Input type="number" value={sectorForm.position_y} onChange={(e) => setSectorForm({ ...sectorForm, position_y: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSectorDialogOpen(false)}>Bekor</Button>
              <Button type="submit">{editingSector ? 'Saqlash' : "Qo'shish"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- Sector delete confirm ---- */}
      <Dialog open={!!deletingSector} onOpenChange={(o) => !o && setDeletingSector(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xonani o'chirish</DialogTitle>
            <DialogDescription>
              "{deletingSector?.name}" xonasi va undagi barcha shkaflar o'chiriladi. Bu amalni qaytarib bo'lmaydi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingSector(null)}>Bekor</Button>
            <Button variant="destructive" onClick={confirmDeleteSector}>O'chirish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Sector Detail (Room Map + Shelves) ---- */}
      <Dialog open={!!openSectorId} onOpenChange={(o) => !o && setOpenSectorId(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {openSectorId && (() => {
            const sector = sectors.find(s => s.id === openSectorId);
            if (!sector) return null;
            const shelfList = shelvesBySector.get(sector.id) || [];
            const sectorProds = productsBySector.get(sector.id) || [];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Home className="w-5 h-5 text-primary" /> {sector.name}
                    <Badge variant="outline" className="font-mono text-xs ml-1">{sector.code}</Badge>
                  </DialogTitle>
                  <DialogDescription>{sector.description || `${shelfList.length} ta shkaf · ${sectorProds.length} ta mahsulot`}</DialogDescription>
                </DialogHeader>

                {/* Room map */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase text-muted-foreground tracking-wide">Xona xaritasi (yuqoridan ko'rinish)</Label>
                    <Button size="sm" onClick={() => openCreateShelf(sector.id)}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Yangi shkaf
                    </Button>
                  </div>
                  <RoomMap
                    shelves={shelfList}
                    placements={placements}
                    occupancy={shelfOccupancy}
                    onClick={(sh) => openShelf(sh.id)}
                  />
                </div>

                {/* Shelves list */}
                <div className="space-y-2 mt-4">
                  <Label className="text-xs uppercase text-muted-foreground tracking-wide">Shkaflar ({shelfList.length})</Label>
                  {shelfList.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-4 border rounded text-center">
                      Bu xonada hali shkaf yo'q.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {shelfList.map(sh => {
                        const occ = shelfOccupancy.get(sh.id) ?? 0;
                        const pct = sh.capacity > 0 ? Math.round((occ / sh.capacity) * 100) : 0;
                        return (
                          <div key={sh.id} className="flex items-center gap-3 p-3 border rounded-md hover:bg-muted/50 transition group">
                            <div className={`w-2 h-12 rounded ${colorForOcc(pct)}`} />
                            <button onClick={() => openShelf(sh.id)} className="flex-1 text-left min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{sh.name}</span>
                                <Badge variant="outline" className="font-mono text-[10px]">{sh.code}</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {sh.rows}R × {sh.columns}C × {sh.levels}L · sig'im {sh.capacity} · band {occ}
                              </div>
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openShelf(sh.id)}>
                                  <Box className="w-4 h-4 mr-2" /> 3D ko'rinish
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditShelf(sh)}>
                                  <Pencil className="w-4 h-4 mr-2" /> Tahrirlash
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDeletingShelf(sh)} className="text-destructive focus:text-destructive">
                                  <Trash2 className="w-4 h-4 mr-2" /> O'chirish
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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

      {/* ---- Shelf Create/Edit dialog ---- */}
      <Dialog open={shelfDialogOpen} onOpenChange={setShelfDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingShelf?.id ? 'Shkafni tahrirlash' : 'Yangi shkaf'}</DialogTitle>
            <DialogDescription>O'lcham va xona ichidagi joylashuv</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitShelf} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Nomi *</Label>
                <Input required value={shelfForm.name} onChange={(e) => setShelfForm({ ...shelfForm, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Kodi</Label>
                <Input value={shelfForm.code} onChange={(e) => setShelfForm({ ...shelfForm, code: e.target.value.toUpperCase() })} className="font-mono uppercase" maxLength={6} />
              </div>
              <div className="space-y-1.5">
                <Label>Burilish (°)</Label>
                <Input type="number" value={shelfForm.orientation} onChange={(e) => setShelfForm({ ...shelfForm, orientation: parseInt(e.target.value) || 0 })} />
              </div>

              <div className="space-y-1.5">
                <Label>Qator (R, chuqurlik)</Label>
                <Input type="number" min={1} max={20} value={shelfForm.rows} onChange={(e) => setShelfForm({ ...shelfForm, rows: Math.max(1, parseInt(e.target.value) || 1) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Ustun (C, kenglik)</Label>
                <Input type="number" min={1} max={20} value={shelfForm.columns} onChange={(e) => setShelfForm({ ...shelfForm, columns: Math.max(1, parseInt(e.target.value) || 1) })} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Qavat (L, balandlik)</Label>
                <Input type="number" min={1} max={10} value={shelfForm.levels} onChange={(e) => setShelfForm({ ...shelfForm, levels: Math.max(1, parseInt(e.target.value) || 1) })} />
                <p className="text-[11px] text-muted-foreground">Sig'im: {shelfForm.rows * shelfForm.columns * shelfForm.levels} slot</p>
              </div>

              <div className="space-y-1.5">
                <Label>Kenglik (cm)</Label>
                <Input type="number" value={shelfForm.width_cm} onChange={(e) => setShelfForm({ ...shelfForm, width_cm: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Chuqurlik (cm)</Label>
                <Input type="number" value={shelfForm.depth_cm} onChange={(e) => setShelfForm({ ...shelfForm, depth_cm: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Balandlik (cm)</Label>
                <Input type="number" value={shelfForm.height_cm} onChange={(e) => setShelfForm({ ...shelfForm, height_cm: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Xona X (cm)</Label>
                <Input type="number" value={shelfForm.position_x} onChange={(e) => setShelfForm({ ...shelfForm, position_x: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Xona Y (cm)</Label>
                <Input type="number" value={shelfForm.position_y} onChange={(e) => setShelfForm({ ...shelfForm, position_y: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShelfDialogOpen(false)}>Bekor</Button>
              <Button type="submit">{editingShelf?.id ? 'Saqlash' : "Qo'shish"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- Shelf delete confirm ---- */}
      <Dialog open={!!deletingShelf} onOpenChange={(o) => !o && setDeletingShelf(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shkafni o'chirish</DialogTitle>
            <DialogDescription>
              "{deletingShelf?.name}" shkafi o'chiriladi. Agar joylashtirilgan mahsulotlar bo'lsa, o'chirish bloklanadi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingShelf(null)}>Bekor</Button>
            <Button variant="destructive" onClick={confirmDeleteShelf}>O'chirish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Shelf 3D detail ---- */}
      <Dialog open={!!openShelfId} onOpenChange={(o) => !o && setOpenShelfId(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          {openShelfData && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Box className="w-5 h-5 text-primary" />
                  {openShelfData.shelf.name}
                  <Badge variant="outline" className="font-mono text-xs">{openShelfData.shelf.code}</Badge>
                </DialogTitle>
                <DialogDescription>
                  {openShelfData.shelf.rows}R × {openShelfData.shelf.columns}C × {openShelfData.shelf.levels}L — sig'im {openShelfData.shelf.capacity} slot
                </DialogDescription>
              </DialogHeader>

              {/* Search & RFID */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Mahsulot nomi, kodi yoki RFID..."
                    value={shelfSearch}
                    onChange={(e) => setShelfSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runShelfSearch(shelfSearch); } }}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={() => runShelfSearch(shelfSearch)}>
                  <Target className="w-4 h-4 mr-1.5" /> Topish
                </Button>
                <Button variant="outline" onClick={() => setShelfQrOpen(true)}>
                  <ScanLine className="w-4 h-4 mr-1.5" /> QR
                </Button>
                {highlight && (
                  <Button variant="ghost" onClick={() => setHighlight(null)}>
                    <X className="w-4 h-4 mr-1.5" /> Tozalash
                  </Button>
                )}
              </div>

              {shelfQrOpen && (
                <QrScanner
                  onScan={(text) => { setShelfQrOpen(false); setShelfSearch(text); runShelfSearch(text); }}
                  onClose={() => setShelfQrOpen(false)}
                />
              )}

              <SectorRack3D
                rows={openShelfData.shelf.rows}
                columns={openShelfData.shelf.columns}
                levels={openShelfData.shelf.levels}
                width_cm={openShelfData.shelf.width_cm}
                depth_cm={openShelfData.shelf.depth_cm}
                height_cm={openShelfData.shelf.height_cm}
                products={openShelfData.products}
                placements={openShelfData.placementsMap}
                highlight={highlight}
                onSlotClick={onSlotClick}
                readOnly
                height={500}
              />

              {highlight && (
                <div className="text-xs text-center text-muted-foreground">
                  Belgilangan: <span className="font-mono text-red-600 font-bold">L{highlight.level} · C{highlight.column} · R{highlight.row}</span>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Slot info */}
      <Dialog open={!!slotInfo} onOpenChange={(o) => !o && setSlotInfo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" /> Slot ma'lumoti
            </DialogTitle>
            <DialogDescription className="font-mono">
              L{slotInfo?.slot.level} · C{slotInfo?.slot.column} · R{slotInfo?.slot.row}
            </DialogDescription>
          </DialogHeader>
          {slotInfo?.product ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mahsulot:</span>
                <span className="font-semibold">{slotInfo.product.name}</span>
              </div>
              {slotInfo.product.product_code && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Kod:</span>
                  <span className="font-mono text-xs">{slotInfo.product.product_code}</span>
                </div>
              )}
              {slotInfo.product.nfc_id && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">RFID:</span>
                  <span className="font-mono text-xs">{slotInfo.product.nfc_id}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Soni:</span>
                <span>{slotInfo.product.quantity}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">Bu slot bo'sh</div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

// ---- Subcomponents --------------------------------------------------------

function StatCard({ label, value, icon, sub }: { label: string; value: number | string; icon: React.ReactNode; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
          {icon}{label}
        </div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function RoomMap({
  shelves,
  placements,
  onClick,
}: {
  shelves: Shelf[];
  placements: Placement[];
  onClick: (sh: Shelf) => void;
}) {
  if (shelves.length === 0) {
    return (
      <div className="aspect-[2/1] border-2 border-dashed rounded-lg flex items-center justify-center text-sm text-muted-foreground bg-muted/20">
        Hali shkaflar yo'q
      </div>
    );
  }
  // Build bounding box from positions + dimensions
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
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 400 }} preserveAspectRatio="xMidYMid meet">
        {/* grid */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeOpacity="0.06" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Room border */}
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
              <rect
                x={x} y={y} width={sh.width_cm} height={sh.depth_cm}
                rx="4"
                className={`${fillClass} hover:opacity-90 transition`}
                stroke="currentColor"
                strokeOpacity="0.4"
                strokeWidth="1.5"
                transform={sh.orientation ? `rotate(${sh.orientation} ${x + sh.width_cm / 2} ${y + sh.depth_cm / 2})` : undefined}
              />
              <text
                x={x + sh.width_cm / 2}
                y={y + sh.depth_cm / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-white font-bold pointer-events-none"
                style={{ fontSize: Math.min(24, sh.depth_cm / 3) }}
              >
                {sh.code}
              </text>
              <text
                x={x + sh.width_cm / 2}
                y={y + sh.depth_cm / 2 + 18}
                textAnchor="middle"
                className="fill-white/80 pointer-events-none"
                style={{ fontSize: 12 }}
              >
                {pct}%
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-[11px] text-muted-foreground text-center mt-1">
        Shkaf ustiga bosing — 3D ko'rinish ochiladi · ranglar to'lalik foiziga qarab
      </p>
    </div>
  );
}
