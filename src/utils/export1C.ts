import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

/**
 * 1C "Материальный отчет" formatidagi oylik kirim/chiqim hisoboti.
 * Ustunlar 1C tipovoy hisoboti bilan bir xil:
 * Номенклатура | Код | Артикул | Остаток на начало (кол./сумма) |
 * Приход (кол./сумма) | Расход (кол./сумма) | Остаток на конец (кол./сумма)
 */

export interface Report1COptions {
  /** YYYY-MM ko'rinishida oy */
  month: string;
  /** Hisobot sarlavhasidagi ombor nomi */
  warehouseName?: string;
  /** Rahbar F.I.Sh. (UTVERJDAYU bloki) */
  headName?: string;
}

interface ProductRow {
  id: string;
  name: string;
  product_code: string;
  quantity: number;
  sector_id: string | null;
  price: number | null;
}

interface OpRow {
  product_id: string | null;
  product_name: string;
  action_type: string;
  quantity: number;
  created_at: string;
}

function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { start, end };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmtDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

async function fetchAll<T>(table: 'operations', select: string, gte?: string): Promise<T[]> {
  const out: T[] = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    let q = supabase.from(table).select(select);
    if (gte) q = q.gte('created_at', gte);
    const { data, error } = await q.order('created_at', { ascending: true }).range(from, from + step - 1);
    if (error) throw error;
    const rows = (data || []) as unknown as T[];
    out.push(...rows);
    if (rows.length < step) break;
  }
  return out;
}

export interface Report1CRow {
  sector: string;
  name: string;
  code: string;
  price: number;
  startQty: number;
  inQty: number;
  outQty: number;
  endQty: number;
  startSum: number;
  inSum: number;
  outSum: number;
  endSum: number;
}

/** Oylik boshlanish/oxirgi qoldiq va kirim/chiqimni hisoblaydi */
export async function buildReport1CData(month: string): Promise<Report1CRow[]> {
  const { start, end } = monthRange(month);

  const [{ data: products, error: pErr }, { data: sectors, error: sErr }] = await Promise.all([
    supabase.from('products').select('id, name, product_code, quantity, sector_id, price'),
    supabase.from('sectors').select('id, name'),
  ]);
  if (pErr) throw pErr;
  if (sErr) throw sErr;

  const sectorName = new Map((sectors || []).map((s) => [s.id, s.name]));
  const ops = await fetchAll<OpRow>('operations', 'product_id, product_name, action_type, quantity, created_at', start.toISOString());

  // Oy ichidagi va oydan keyingi harakatlar
  const inMonth = new Map<string, { in: number; out: number }>();
  const afterMonth = new Map<string, { in: number; out: number }>();
  const orphan = new Map<string, { name: string; in: number; out: number }>();

  for (const op of ops) {
    const t = new Date(op.created_at);
    const bucket = t < end ? inMonth : afterMonth;
    if (!op.product_id) {
      if (t < end) {
        const o = orphan.get(op.product_name) || { name: op.product_name, in: 0, out: 0 };
        if (op.action_type === 'IN') o.in += op.quantity; else o.out += op.quantity;
        orphan.set(op.product_name, o);
      }
      continue;
    }
    const cur = bucket.get(op.product_id) || { in: 0, out: 0 };
    if (op.action_type === 'IN') cur.in += op.quantity; else cur.out += op.quantity;
    bucket.set(op.product_id, cur);
  }

  const rows: Report1CRow[] = [];
  for (const p of (products || []) as ProductRow[]) {
    const after = afterMonth.get(p.id) || { in: 0, out: 0 };
    const cur = inMonth.get(p.id) || { in: 0, out: 0 };
    const endQty = p.quantity - after.in + after.out;
    const startQty = endQty - cur.in + cur.out;
    if (startQty === 0 && endQty === 0 && cur.in === 0 && cur.out === 0) continue;
    const price = Number(p.price) || 0;
    rows.push({
      sector: p.sector_id ? sectorName.get(p.sector_id) || 'Ombor' : 'Ombor',
      name: p.name,
      code: p.product_code || '',
      price,
      startQty,
      inQty: cur.in,
      outQty: cur.out,
      endQty,
      startSum: round2(startQty * price),
      inSum: round2(cur.in * price),
      outSum: round2(cur.out * price),
      endSum: round2(endQty * price),
    });
  }

  // O'chirilgan mahsulotlar bo'yicha harakatlar
  for (const o of orphan.values()) {
    rows.push({
      sector: 'Ombor', name: o.name, code: '', price: 0,
      startQty: 0, inQty: o.in, outQty: o.out, endQty: 0,
      startSum: 0, inSum: 0, outSum: 0, endSum: 0,
    });
  }

  rows.sort((a, b) => a.sector.localeCompare(b.sector) || a.name.localeCompare(b.name));
  return rows;
}

type Cell = string | number | null;

export function buildReport1CSheet(rows: Report1CRow[], opts: Report1COptions) {
  const { start, end } = monthRange(opts.month);
  const lastDay = new Date(end.getTime() - 86400000);
  const head = opts.headName || '';
  const warehouse = opts.warehouseName || 'Ombor';

  const aoa: Cell[][] = [];
  aoa.push([null, null, null, null, null, null, 'УТВЕРЖДАЮ', null]);
  aoa.push([null, null, null, null, null, null, 'Руководитель', head]);
  aoa.push([null, null, null, null, null, null, '(должность)', '(расшифровка подписи)']);
  aoa.push([]);
  aoa.push(['Материальный отчет']);
  aoa.push(['Период', `${fmtDate(start)} - ${fmtDate(lastDay)}`]);
  aoa.push(['Склад / Контрагент / Номенклатура', null, null, 'Итого']);
  aoa.push([]);
  aoa.push([
    'Номенклатура', 'Код', 'Артикул',
    'Остаток на начало', null,
    'Приход', null,
    'Расход', null,
    'Остаток на конец', null,
  ]);
  aoa.push([null, null, null, 'кол.', 'сумма', 'кол.', 'сумма', 'кол.', 'сумма', 'кол.', 'сумма']);

  const totals = { s: 0, i: 0, o: 0, e: 0, ss: 0, is: 0, os: 0, es: 0 };
  let currentSector = '';
  const groups = new Map<string, Report1CRow[]>();
  for (const r of rows) {
    const list = groups.get(r.sector) || [];
    list.push(r);
    groups.set(r.sector, list);
  }

  for (const [sector, list] of groups) {
    const g = list.reduce(
      (acc, r) => ({
        s: acc.s + r.startQty, i: acc.i + r.inQty, o: acc.o + r.outQty, e: acc.e + r.endQty,
        ss: acc.ss + r.startSum, is: acc.is + r.inSum, os: acc.os + r.outSum, es: acc.es + r.endSum,
      }),
      { s: 0, i: 0, o: 0, e: 0, ss: 0, is: 0, os: 0, es: 0 },
    );
    currentSector = sector;
    aoa.push([
      `${warehouse} / ${currentSector}`, null, null,
      g.s, round2(g.ss), g.i, round2(g.is), g.o, round2(g.os), g.e, round2(g.es),
    ]);
    for (const r of list) {
      aoa.push([r.name, r.code, null, r.startQty, r.startSum, r.inQty, r.inSum, r.outQty, r.outSum, r.endQty, r.endSum]);
    }
    totals.s += g.s; totals.i += g.i; totals.o += g.o; totals.e += g.e;
    totals.ss += g.ss; totals.is += g.is; totals.os += g.os; totals.es += g.es;
  }

  aoa.push([
    'Итого', null, null,
    totals.s, round2(totals.ss), totals.i, round2(totals.is),
    totals.o, round2(totals.os), totals.e, round2(totals.es),
  ]);
  aoa.push([]);
  aoa.push(['Исполнитель', null, null, '(должность)', null, '(подпись)', null, '(расшифровка подписи)']);

  const ws = XLSX.utils.aoa_to_sheet(aoa as (string | number | null)[][]);
  ws['!cols'] = [
    { wch: 48 }, { wch: 14 }, { wch: 12 },
    { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 16 },
    { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 16 },
  ];
  ws['!merges'] = [
    { s: { r: 8, c: 3 }, e: { r: 8, c: 4 } },
    { s: { r: 8, c: 5 }, e: { r: 8, c: 6 } },
    { s: { r: 8, c: 7 }, e: { r: 8, c: 8 } },
    { s: { r: 8, c: 9 }, e: { r: 8, c: 10 } },
  ];
  return ws;
}

/** XLS (1C uchun) yuklab olish */
export function download1CReport(rows: Report1CRow[], opts: Report1COptions) {
  const ws = buildReport1CSheet(rows, opts);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TDSheet');
  XLSX.writeFile(wb, `Material_hisobot_${opts.month}.xls`, { bookType: 'biff8' });
}

/** 1C "Загрузка из табличного документа" uchun sodda CSV */
export function download1CCsv(rows: Report1CRow[], month: string) {
  const header = [
    'Номенклатура', 'Код', 'Цена',
    'Остаток на начало кол.', 'Остаток на начало сумма',
    'Приход кол.', 'Приход сумма',
    'Расход кол.', 'Расход сумма',
    'Остаток на конец кол.', 'Остаток на конец сумма',
  ];
  const body = rows.map((r) => [
    r.name, r.code, r.price,
    r.startQty, r.startSum, r.inQty, r.inSum, r.outQty, r.outSum, r.endQty, r.endSum,
  ]);
  const csv = [header, ...body]
    .map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Material_hisobot_${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
