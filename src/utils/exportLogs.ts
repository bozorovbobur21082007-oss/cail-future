import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LogEntry {
  action_type: string;
  product_name: string;
  worker_name: string;
  quantity: number;
  created_at: string;
}

function formatRows(data: LogEntry[]) {
  return data.map(op => [
    op.action_type === 'IN' ? 'Kirim' : 'Chiqim',
    op.product_name,
    op.worker_name,
    String(op.quantity),
    new Date(op.created_at).toLocaleString('uz-UZ'),
  ]);
}

const HEADERS = ['Turi', 'Mahsulot', 'Ishchi', 'Soni', 'Vaqt'];

export function exportCSV(data: LogEntry[]) {
  const rows = formatRows(data);
  const csvContent = [HEADERS, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `loglar_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPDF(data: LogEntry[]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Ombor operatsiyalari', 14, 15);
  doc.setFontSize(9);
  doc.text(`Sana: ${new Date().toLocaleDateString('uz-UZ')}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [HEADERS],
    body: formatRows(data),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  doc.save(`loglar_${new Date().toISOString().slice(0, 10)}.pdf`);
}
