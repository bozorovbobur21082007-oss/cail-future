import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, ChevronLeft, ChevronRight, Download, ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown, FileSpreadsheet } from 'lucide-react';
import { exportCSV, exportPDF } from '@/utils/exportLogs';
import { buildReport1CData, download1CReport, download1CCsv } from '@/utils/export1C';
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

type StatPeriod = 'today' | 'week' | 'month' | 'all';

export default function LogsPage() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);

  const [filterWorker, setFilterWorker] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [statPeriod, setStatPeriod] = useState<StatPeriod>('today');
  const [stats, setStats] = useState({ inQty: 0, outQty: 0, inCount: 0, outCount: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [reportHead, setReportHead] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const handle1CExport = async (format: 'xls' | 'csv') => {
    if (!reportMonth) { toast.error('Oyni tanlang'); return; }
    setReportLoading(true);
    try {
      const rows = await buildReport1CData(reportMonth);
      if (rows.length === 0) { toast.error("Bu oy uchun ma'lumot topilmadi"); return; }
      if (format === 'xls') {
        download1CReport(rows, { month: reportMonth, headName: reportHead, warehouseName: 'Ombor' });
      } else {
        download1CCsv(rows, reportMonth);
      }
      toast.success('Hisobot yuklandi');
    } catch (e) {
      toast.error('Hisobotni tayyorlashda xatolik');
      console.error(e);
    } finally {
      setReportLoading(false);
    }
  };


  const limit = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('operations').select('*', { count: 'exact' });

    if (filterWorker) query = query.eq('worker_id', filterWorker);
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
  }, [page, filterWorker, filterAction, filterDateFrom, filterDateTo]);

  const fetchMeta = useCallback(async () => {
    const { data } = await supabase.from('workers').select('id, full_name');
    setWorkers(data || []);
  }, []);

  const periodRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (statPeriod === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (statPeriod === 'week') {
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (statPeriod === 'month') {
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else {
      return null;
    }
    return start.toISOString();
  }, [statPeriod]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    let query = supabase.from('operations').select('action_type, quantity');
    if (periodRange) query = query.gte('created_at', periodRange);
    const { data, error } = await query;
    if (error) {
      toast.error("Statistikani yuklashda xatolik");
      setStatsLoading(false);
      return;
    }
    let inQty = 0, outQty = 0, inCount = 0, outCount = 0;
    (data || []).forEach((op: { action_type: string; quantity: number }) => {
      if (op.action_type === 'IN') { inQty += op.quantity; inCount++; }
      else if (op.action_type === 'OUT') { outQty += op.quantity; outCount++; }
    });
    setStats({ inQty, outQty, inCount, outCount });
    setStatsLoading(false);
  }, [periodRange]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Re-fetch stats when new operations are inserted (after filter changes too — keeps stats fresh)
  useEffect(() => { fetchStats(); }, [operations.length, fetchStats]);

  const resetFilters = () => {
    setFilterWorker('');
    setFilterAction('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);
  const net = stats.inQty - stats.outQty;
  const periodLabel: Record<StatPeriod, string> = {
    today: 'Bugun',
    week: "So'nggi 7 kun",
    month: "So'nggi 30 kun",
    all: 'Hammasi',
  };

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

      {/* Statistika kartochkalari */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Statistika · <span className="text-foreground normal-case">{periodLabel[statPeriod]}</span>
          </h2>
          <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-1">
            {(['today', 'week', 'month', 'all'] as StatPeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setStatPeriod(p)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  statPeriod === p
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {periodLabel[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="shadow-sm border-success/20">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Jami kirim</p>
                  <p className="text-2xl font-bold text-success">
                    {statsLoading ? '—' : `+${stats.inQty.toLocaleString('uz-UZ')}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{stats.inCount} ta operatsiya</p>
                </div>
                <div className="w-10 h-10 rounded-md bg-success/10 flex items-center justify-center">
                  <ArrowDownToLine className="w-5 h-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-warning/20">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Jami chiqim</p>
                  <p className="text-2xl font-bold text-warning">
                    {statsLoading ? '—' : `−${stats.outQty.toLocaleString('uz-UZ')}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{stats.outCount} ta operatsiya</p>
                </div>
                <div className="w-10 h-10 rounded-md bg-warning/10 flex items-center justify-center">
                  <ArrowUpFromLine className="w-5 h-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`shadow-sm ${net >= 0 ? 'border-primary/20' : 'border-destructive/20'}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Sof o'zgarish</p>
                  <p className={`text-2xl font-bold ${net >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {statsLoading ? '—' : `${net >= 0 ? '+' : ''}${net.toLocaleString('uz-UZ')}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {net >= 0 ? 'Ombor zaxirasi oshdi' : 'Ombor zaxirasi kamaydi'}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${net >= 0 ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                  {net >= 0
                    ? <TrendingUp className="w-5 h-5 text-primary" />
                    : <TrendingDown className="w-5 h-5 text-destructive" />}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 1C uchun oylik material hisoboti */}
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">1C uchun oylik hisobot (Материальный отчет)</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Tanlangan oy bo'yicha har bir mahsulotning boshlang'ich qoldig'i, kirim, chiqim va oxirgi qoldig'i
            1C formatida yuklanadi.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Oy</Label>
              <Input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Rahbar (F.I.Sh.)</Label>
              <Input value={reportHead} onChange={(e) => setReportHead(e.target.value)} placeholder="Ixtiyoriy" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handle1CExport('xls')} disabled={reportLoading}>
                <Download className="w-4 h-4 mr-2" />
                XLS
              </Button>
              <Button size="sm" variant="outline" onClick={() => handle1CExport('csv')} disabled={reportLoading}>
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      {showFilters && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <Label className="text-xs">Amal turi</Label>
                <Select value={filterAction || 'all'} onValueChange={(v) => { setFilterAction(v === 'all' ? '' : v); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Barchasi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barchasi</SelectItem>
                    <SelectItem value="IN">Kirim</SelectItem>
                    <SelectItem value="OUT">Chiqim</SelectItem>
                    <SelectItem value="MOVE">Ko'chirish</SelectItem>
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
                          <Badge className={
                            op.action_type === 'IN' ? 'bg-success/10 text-success border-success/20'
                            : op.action_type === 'OUT' ? 'bg-warning/10 text-warning border-warning/20'
                            : 'bg-primary/10 text-primary border-primary/20'
                          }>
                            {op.action_type === 'IN' ? 'Kirim' : op.action_type === 'OUT' ? 'Chiqim' : "Ko'chirish"}
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
