/**
 * Export engine (§19) — CSV, Excel, PDF and Print from one column definition.
 *
 * Every export goes through `ExportColumn[]` so a table renders and exports the
 * same numbers in the same order; there is no second, drifting copy of the
 * column list living inside each page.
 */

export interface ExportColumn<T> {
  key: string;
  header: string;
  value: (row: T) => string | number;
}

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'print';

function stamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so Safari has finished reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** RFC 4180 escaping: quote when the cell contains a delimiter, quote or newline. */
function csvCell(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCSV<T>(rows: T[], columns: ExportColumn<T>[], name: string) {
  const header = columns.map(c => csvCell(c.header)).join(',');
  const body = rows.map(r => columns.map(c => csvCell(c.value(r))).join(','));
  // BOM so Excel opens UTF-8 currency symbols correctly instead of mojibake.
  const csv = '﻿' + [header, ...body].join('\r\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${name}_${stamp()}.csv`);
}

function escapeHtml(v: string | number): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tableHtml<T>(rows: T[], columns: ExportColumn<T>[], title: string): string {
  const head = columns.map(c => `<th>${escapeHtml(c.header)}</th>`).join('');
  const body = rows
    .map(r => `<tr>${columns.map(c => `<td>${escapeHtml(c.value(r))}</td>`).join('')}</tr>`)
    .join('');
  return `<table><caption>${escapeHtml(title)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * Excel export as an HTML-table workbook. Excel and Google Sheets both open this
 * natively with styling and typed columns intact, and it needs no SheetJS-sized
 * dependency in the bundle.
 */
export function exportExcel<T>(rows: T[], columns: ExportColumn<T>[], name: string, title = name) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8" />
<style>
  table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  caption { font-size: 14pt; font-weight: bold; text-align: left; padding: 8px 0; }
  th { background: #7C3AED; color: #fff; font-weight: 600; text-align: left; padding: 6px 10px; border: 1px solid #5B21B6; }
  td { padding: 5px 10px; border: 1px solid #D9D9D9; }
  tr:nth-child(even) td { background: #F5F3FF; }
</style></head>
<body>${tableHtml(rows, columns, title)}</body></html>`;
  download(
    new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
    `${name}_${stamp()}.xls`,
  );
}

const PRINT_STYLES = `
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; padding: 24px; }
  header { border-bottom: 3px solid #7C3AED; padding-bottom: 14px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: flex-end; }
  h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: -0.02em; }
  .sub { color: #64748B; font-size: 12px; margin: 0; }
  .brand { font-size: 12px; font-weight: 700; color: #7C3AED; letter-spacing: 0.08em; text-transform: uppercase; }
  table { border-collapse: collapse; width: 100%; font-size: 10.5px; }
  caption { display: none; }
  th { background: #F1F5F9; color: #334155; text-align: left; font-weight: 600; padding: 8px 10px; border-bottom: 2px solid #CBD5E1; white-space: nowrap; }
  td { padding: 7px 10px; border-bottom: 1px solid #E2E8F0; white-space: nowrap; }
  tr:nth-child(even) td { background: #FAFAFC; }
  footer { margin-top: 20px; color: #94A3B8; font-size: 10px; border-top: 1px solid #E2E8F0; padding-top: 10px; }
`;

/**
 * Open a paginated, print-styled report. The browser's print dialog is what
 * turns it into a PDF ("Save as PDF"), which keeps selectable text and real
 * vector output instead of the rasterised screenshot a canvas export would give.
 */
export function exportPDF<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  name: string,
  meta: { title: string; subtitle?: string } = { title: name },
) {
  const w = window.open('', '_blank', 'width=1200,height=800');
  if (!w) {
    // Popup blocked — fall back to a file the user can open and print.
    exportExcel(rows, columns, name, meta.title);
    return;
  }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8" />
<title>${escapeHtml(meta.title)}</title><style>${PRINT_STYLES}</style></head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(meta.title)}</h1>
      <p class="sub">${escapeHtml(meta.subtitle ?? '')}</p>
    </div>
    <div class="brand">Pharmescence</div>
  </header>
  ${tableHtml(rows, columns, meta.title)}
  <footer>Generated ${new Date().toLocaleString()} — Pharmescence Meta Ads Dashboard — ${rows.length} rows</footer>
</body></html>`);
  w.document.close();
  w.focus();
  // Let fonts and layout settle before the dialog snapshots the page.
  setTimeout(() => w.print(), 350);
}

/** Print the live dashboard view using the app's own print stylesheet. */
export function printView() {
  window.print();
}

export function runExport<T>(
  format: ExportFormat,
  rows: T[],
  columns: ExportColumn<T>[],
  name: string,
  meta?: { title: string; subtitle?: string },
) {
  switch (format) {
    case 'csv': return exportCSV(rows, columns, name);
    case 'excel': return exportExcel(rows, columns, name, meta?.title ?? name);
    case 'pdf': return exportPDF(rows, columns, name, meta ?? { title: name });
    case 'print': return printView();
  }
}

// --- Column presets ----------------------------------------------------------

export const money = (v: number) => v.toFixed(2);
export const ratio = (v: number) => v.toFixed(2);
export const pct = (v: number) => `${v.toFixed(2)}%`;
