import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Plus, MoreHorizontal, Pencil, Trash2, Search, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorMessages';

interface Sector {
  id: string;
  name: string;
  code: string;
  description: string;
  capacity: number;
  created_at: string;
  product_count?: number;
}

export default function SectorsPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Sector | null>(null);
  const [deleting, setDeleting] = useState<Sector | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', capacity: 100 });

  const fetchSectors = useCallback(async () => {
    const [sectorsRes, productsRes] = await Promise.all([
      supabase.from('sectors').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id, sector_id, quantity'),
    ]);

    if (sectorsRes.error) {
      toast.error('Sektorlarni yuklashda xatolik');
      setLoading(false);
      return;
    }

    const products = productsRes.data || [];
    const countMap: Record<string, number> = {};
    products.forEach(p => {
      if (p.sector_id) countMap[p.sector_id] = (countMap[p.sector_id] || 0) + (p.quantity || 0);
    });

    const enriched = (sectorsRes.data || []).map(s => ({
      ...s,
      product_count: countMap[s.id] || 0,
    }));

    setSectors(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSectors(); }, [fetchSectors]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', capacity: 100 });
    setDialogOpen(true);
  };

  const openEdit = (s: Sector) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description || '', capacity: s.capacity });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        const { error } = await supabase.from('sectors').update(form).eq('id', editing.id);
        if (error) throw error;
        toast.success("Sektor yangilandi");
      } else {
        const { error } = await supabase.from('sectors').insert(form);
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sektorlar</h1>
          <p className="text-sm text-muted-foreground mt-1">Omborxona sektorlarini boshqarish</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Yangi sektor
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Sector Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              {search ? "Natija topilmadi" : "Hali sektor mavjud emas"}
            </CardContent>
          </Card>
        ) : (
          filtered.map((s) => {
            const occupied = Math.min(s.product_count || 0, s.capacity);
            const empty = Math.max(s.capacity - occupied, 0);
            const usagePercent = s.capacity > 0 ? Math.round((occupied / s.capacity) * 100) : 0;
            const isFull = usagePercent >= 90;

            // Compute grid columns: aim for near-square layout
            const cols = Math.min(Math.max(Math.ceil(Math.sqrt(s.capacity)), 4), 12);

            return (
              <Card key={s.id} className={`shadow-sm hover:shadow-md transition-shadow ${isFull ? 'border-destructive/40' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{s.name}</p>
                        <p className="text-xs font-mono text-muted-foreground">{s.code}</p>
                      </div>
                    </div>
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

                  {s.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{s.description}</p>
                  )}

                  {/* 2D shelf grid */}
                  <div className="mb-3 rounded-md border border-border/60 bg-muted/30 p-2">
                    <div
                      className="grid gap-1"
                      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                      aria-label={`${s.name} polka xaritasi`}
                    >
                      {Array.from({ length: s.capacity }).map((_, i) => {
                        const isOccupied = i < occupied;
                        return (
                          <div
                            key={i}
                            title={isOccupied ? `Katak ${i + 1}: band` : `Katak ${i + 1}: bo'sh`}
                            className={`aspect-square rounded-sm border ${
                              isOccupied
                                ? 'bg-destructive/80 border-destructive'
                                : 'bg-success/70 border-success'
                            }`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-sm bg-destructive/80" /> Band: {occupied}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-sm bg-success/70" /> Bo'sh: {empty}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Band: {occupied} / {s.capacity}</span>
                      <Badge className={
                        isFull
                          ? 'bg-destructive/10 text-destructive border-destructive/20 text-[10px]'
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
              <Label>Sig'imi (mahsulot turi soni)</Label>
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
  );
}
