import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { exportCSV, exportPDF } from '@/utils/exportLogs';
import { toast } from 'sonner';

interface Operation {
  id: string;
  worker_id: string | null;
  worker_name: string;
  product_name: string;
  action_type: string;
  quantity: number;
  created_at: string;
}

interface Worker { id: string; full_name: string; }
interface Product { id: string; name: string; product_code: string; }

export default function LogsPage() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [filterWorker, setFilterWorker] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'worker' | 'admin'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const limit = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('operations').select('*', { count: 'exact' });

    if (filterSource === 'admin') {
      query = query.is('worker_id', null);
    } else if (filterSource === 'worker') {
      query = query.not('worker_id', 'is', null);
    }
    if (filterWorker) query = query.eq('worker_id', filterWorker);
    if (filterProduct) query = query.eq('product_id', filterProduct);
    if (filterAction) query = query.eq('action_type', filterAction);
    if (filterDateFrom) query = query.gte('created_at', `${filterDateFrom}T00:00:00`);
    if (filterDateTo) query = query.lte('created_at', `${filterDateTo}T23:59:59`);

    const from = (page - 1) * limit;
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (error) toast.error("Loglarni yuklashda xatolik");
    else {
      setOperations(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [page, filterWorker, filterProduct, filterAction, filterSource, filterDateFrom, filterDateTo]);

  const fetchMeta = useCallback(async () => {
    const [wRes, pRes] = await Promise.all([
      supabase.from('workers').select('id, full_name'),
      supabase.from('products').select('id, name, product_code'),
    ]);
    setWorkers(wRes.data || []);
    setProducts(pRes.data || []);
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const resetFilters = () => {
    setFilterWorker('');
    setFilterProduct('');
    setFilterAction('');
    setFilterSource('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Loglar</h1>
          <p className="text-sm text-muted-foreground mt-1">Barcha ombor operatsiyalari tarixi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            Filterlar
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCSV(operations)} disabled={operations.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportPDF(operations)} disabled={operations.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Manba</Label>
                <Select
                  value={filterSource}
                  onValueChange={(v) => { setFilterSource(v as 'all' | 'worker' | 'admin'); setPage(1); }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hammasi</SelectItem>
                    <SelectItem value="worker">Ishchilar</SelectItem>
                    <SelectItem value="admin">Admin (Mahsulotlar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ishchi</Label>
                <Select value={filterWorker || 'all'} onValueChange={(v) => { setFilterWorker(v === 'all' ? '' : v); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Barchasi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barchasi</SelectItem>
                    {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mahsulot</Label>
                <Select value={filterProduct || 'all'} onValueChange={(v) => { setFilterProduct(v === 'all' ? '' : v); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Barchasi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barchasi</SelectItem>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amal turi</Label>
                <Select value={filterAction || 'all'} onValueChange={(v) => { setFilterAction(v === 'all' ? '' : v); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Barchasi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barchasi</SelectItem>
                    <SelectItem value="IN">Kirim</SelectItem>
                    <SelectItem value="OUT">Chiqim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Boshlanish</Label>
                <Input type="date" value={filterDateFrom} onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tugash</Label>
                <Input type="date" value={filterDateTo} onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }} />
              </div>
            </div>
            <div className="mt-3">
              <Button variant="ghost" size="sm" onClick={resetFilters}>Filtrlarni tozalash</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs uppercase text-muted-foreground">Turi</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Mahsulot</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Ishchi</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Soni</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Vaqt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Operatsiya topilmadi
                      </TableCell>
                    </TableRow>
                  ) : (
                    operations.map(op => (
                      <TableRow key={op.id}>
                        <TableCell>
                          <Badge className={op.action_type === 'IN' ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'}>
                            {op.action_type === 'IN' ? 'Kirim' : 'Chiqim'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{op.product_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {op.worker_id === null ? (
                            <Badge variant="outline" className="text-xs font-normal">
                              {op.worker_name || 'Admin (Mahsulotlar)'}
                            </Badge>
                          ) : (
                            op.worker_name
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">{op.quantity}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(op.created_at).toLocaleString('uz-UZ')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Jami: {total} ta, {page}/{totalPages} sahifa
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
