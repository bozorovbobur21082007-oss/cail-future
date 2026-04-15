import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Package, Users, ArrowLeftRight, AlertTriangle,
  ArrowDownCircle, ArrowUpCircle, Boxes, BarChart3, TrendingUp
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend
} from 'recharts';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [trends, setTrends] = useState<{ thisWeekOps: number; lastWeekOps: number; thisWeekIn: number; lastWeekIn: number; thisWeekOut: number; lastWeekOut: number }>({ thisWeekOps: 0, lastWeekOps: 0, thisWeekIn: 0, lastWeekIn: 0, thisWeekOut: 0, lastWeekOut: 0 });
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [recentOps, setRecentOps] = useState<any[]>([]);
  const [allOps, setAllOps] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);

  const buildChartData = (operations: any[], period: 'week' | 'month' = chartPeriod) => {
    const now = new Date();
    const days = period === 'week' ? 7 : 30;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const dayMap: Record<string, { date: string; label: string; kirim: number; chiqim: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      dayMap[key] = { date: key, label, kirim: 0, chiqim: 0 };
    }

    operations.forEach(op => {
      const day = op.created_at?.slice(0, 10);
      if (dayMap[day]) {
        if (op.action_type === 'IN') dayMap[day].kirim += op.quantity;
        else dayMap[day].chiqim += op.quantity;
      }
    });

    setChartData(Object.values(dayMap));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, workersRes, opsRes] = await Promise.all([
          supabase.from('products').select('*'),
          supabase.from('workers').select('id'),
          supabase.from('operations').select('*').order('created_at', { ascending: false }).limit(500),
        ]);

        const products = productsRes.data || [];
        const workers = workersRes.data || [];
        const operations = opsRes.data || [];

        const today = new Date().toISOString().slice(0, 10);
        const todayOps = operations.filter(o => o.created_at?.slice(0, 10) === today);

        // Trend: this week vs last week
        const now = new Date();
        const startOfThisWeek = new Date(now);
        startOfThisWeek.setDate(now.getDate() - now.getDay());
        startOfThisWeek.setHours(0, 0, 0, 0);
        const startOfLastWeek = new Date(startOfThisWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

        const thisWeekOps = operations.filter(o => new Date(o.created_at) >= startOfThisWeek);
        const lastWeekOps = operations.filter(o => {
          const d = new Date(o.created_at);
          return d >= startOfLastWeek && d < startOfThisWeek;
        });

        setTrends({
          thisWeekOps: thisWeekOps.length,
          lastWeekOps: lastWeekOps.length,
          thisWeekIn: thisWeekOps.filter(o => o.action_type === 'IN').reduce((s, o) => s + o.quantity, 0),
          lastWeekIn: lastWeekOps.filter(o => o.action_type === 'IN').reduce((s, o) => s + o.quantity, 0),
          thisWeekOut: thisWeekOps.filter(o => o.action_type === 'OUT').reduce((s, o) => s + o.quantity, 0),
          lastWeekOut: lastWeekOps.filter(o => o.action_type === 'OUT').reduce((s, o) => s + o.quantity, 0),
        });

        setStats({
          total_products: products.length,
          total_quantity: products.reduce((s, p) => s + (p.quantity || 0), 0),
          total_workers: workers.length,
          today_operations: todayOps.length,
          today_in: todayOps.filter(o => o.action_type === 'IN').reduce((s, o) => s + o.quantity, 0),
          today_out: todayOps.filter(o => o.action_type === 'OUT').reduce((s, o) => s + o.quantity, 0),
        });

        setLowStockProducts(products.filter(p => p.quantity <= p.low_stock_threshold));
        setRecentOps(operations.slice(0, 10));

        // Build chart data
        setAllOps(operations);
        buildChartData(operations);

      } catch (err) {
        console.error('Dashboard xatolik:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (allOps.length > 0) buildChartData(allOps, chartPeriod);
  }, [chartPeriod]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) return <p className="text-muted-foreground">Ma'lumot yuklanmadi</p>;

  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const TrendBadge = ({ current, previous }: { current: number; previous: number }) => {
    const pct = calcTrend(current, previous);
    if (pct === 0) return <span className="text-[10px] text-muted-foreground ml-1">—</span>;
    const isUp = pct > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ml-2 ${isUp ? 'text-success' : 'text-destructive'}`}>
        <TrendingUp className={`w-3 h-3 ${!isUp ? 'rotate-180' : ''}`} />
        {isUp ? '+' : ''}{pct}%
      </span>
    );
  };

  const opstrend = calcTrend(trends.thisWeekOps, trends.lastWeekOps);

  const statCards = [
    { label: "Jami mahsulotlar", value: stats.total_products, icon: Package, color: "text-primary", bg: "bg-primary/10", trend: null },
    { label: "Jami soni", value: stats.total_quantity, icon: Boxes, color: "text-success", bg: "bg-success/10", trend: null },
    { label: "Ishchilar", value: stats.total_workers, icon: Users, color: "text-violet-600", bg: "bg-violet-50", trend: null },
    { label: "Bugungi operatsiyalar", value: stats.today_operations, icon: ArrowLeftRight, color: "text-warning", bg: "bg-warning/10", trend: { current: trends.thisWeekOps, previous: trends.lastWeekOps } },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Bosh sahifa</h1>
        <p className="text-sm text-muted-foreground mt-1">Omborxona holati haqida umumiy ma'lumot</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <Card key={i} className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <div className="flex items-center mt-1">
                    <p className="text-2xl font-bold">{s.value}</p>
                    {s.trend && <TrendBadge current={s.trend.current} previous={s.trend.previous} />}
                  </div>
                  {s.trend && <p className="text-[10px] text-muted-foreground">haftalik trend</p>}
                </div>
                <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's IN/OUT */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bugun kirim</p>
              <div className="flex items-center">
                <p className="text-xl font-bold">{stats.today_in}</p>
                <TrendBadge current={trends.thisWeekIn} previous={trends.lastWeekIn} />
              </div>
              <p className="text-[10px] text-muted-foreground">haftalik trend</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bugun chiqim</p>
              <p className="text-xl font-bold">{stats.today_out}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operations Chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Operatsiyalar statistikasi
            </CardTitle>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setChartPeriod('week')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  chartPeriod === 'week' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Haftalik
              </button>
              <button
                onClick={() => setChartPeriod('month')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  chartPeriod === 'month' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Oylik
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend />
                <Bar dataKey="kirim" name="Kirim" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="chiqim" name="Chiqim" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Bu davr uchun ma'lumot yo'q</p>
          )}
        </CardContent>
      </Card>

      {/* Low Stock Warning */}
      {lowStockProducts.length > 0 && (
        <Card className="shadow-sm border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Kam qolgan mahsulotlar ({lowStockProducts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase text-muted-foreground">Nomi</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground">Soni</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground">Limit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockProducts.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-destructive">{p.name}</TableCell>
                    <TableCell className="font-semibold text-destructive">{p.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{p.low_stock_threshold}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Operations */}
      {recentOps.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary" />
              So'nggi operatsiyalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase text-muted-foreground">Turi</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground">Mahsulot</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground">Ishchi</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground">Soni</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground">Vaqt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOps.map(op => (
                  <TableRow key={op.id}>
                    <TableCell>
                      <Badge className={op.action_type === 'IN' ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'}>
                        {op.action_type === 'IN' ? 'Kirim' : 'Chiqim'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{op.product_name}</TableCell>
                    <TableCell className="text-muted-foreground">{op.worker_name}</TableCell>
                    <TableCell className="font-semibold">{op.quantity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(op.created_at).toLocaleString('uz-UZ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
