import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Pencil, Trash2, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorMessages';

interface Worker {
  id: string;
  full_name: string;
  badge_id: string;
  role: string;
  created_at: string;
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [deleting, setDeleting] = useState<Worker | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ full_name: '', badge_id: '', role: 'ishchi' });

  const fetchWorkers = useCallback(async () => {
    const { data, error } = await supabase.from('workers').select('*').order('created_at', { ascending: false });
    if (error) toast.error("Ishchilarni yuklashda xatolik");
    else setWorkers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  const openCreate = () => {
    setEditing(null);
    setForm({ full_name: '', badge_id: '', role: 'ishchi' });
    setDialogOpen(true);
  };

  const openEdit = (w: Worker) => {
    setEditing(w);
    setForm({ full_name: w.full_name, badge_id: w.badge_id, role: w.role });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        const { error } = await supabase.from('workers').update(form).eq('id', editing.id);
        if (error) throw error;
        toast.success("Ishchi yangilandi");
      } else {
        const { error } = await supabase.from('workers').insert(form);
        if (error) throw error;
        toast.success("Ishchi qo'shildi");
      }
      setDialogOpen(false);
      fetchWorkers();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const { error } = await supabase.from('workers').delete().eq('id', deleting.id);
      if (error) throw error;
      toast.success("Ishchi o'chirildi");
      setDeleteDialogOpen(false);
      fetchWorkers();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const filtered = workers.filter(w =>
    w.full_name.toLowerCase().includes(search.toLowerCase()) ||
    w.badge_id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ishchilar</h1>
          <p className="text-sm text-muted-foreground mt-1">Omborxona ishchilari ro'yxati</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Yangi ishchi
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Qidirish (ism yoki badge ID)..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs uppercase text-muted-foreground">Ism familiya</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">Badge ID</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">Roli</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">Yaratilgan</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground text-right">Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {search ? "Natija topilmadi" : "Hali ishchi mavjud emas"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.full_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{w.badge_id}</TableCell>
                    <TableCell>
                      <Badge className={w.role === 'admin' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground'}>
                        {w.role === 'admin' ? 'Admin' : 'Ishchi'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{w.created_at?.slice(0, 10)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(w)}>
                            <Pencil className="w-4 h-4 mr-2" /> Tahrirlash
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setDeleting(w); setDeleteDialogOpen(true); }} className="text-destructive focus:text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" /> O'chirish
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Ishchini tahrirlash" : "Yangi ishchi qo'shish"}</DialogTitle>
            <DialogDescription>Ishchi ma'lumotlarini kiriting</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Ism familiya</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Badge ID</Label>
              <Input value={form.badge_id} onChange={(e) => setForm({ ...form, badge_id: e.target.value })} required placeholder="Skaner orqali yoki qo'lda kiriting" />
            </div>
            <div className="space-y-2">
              <Label>Roli</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ishchi">Ishchi</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
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
            <DialogTitle>Ishchini o'chirish</DialogTitle>
            <DialogDescription>
              <strong>{deleting?.full_name}</strong> ishchisini o'chirishni tasdiqlaysizmi?
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
