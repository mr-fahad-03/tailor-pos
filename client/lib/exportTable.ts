/**
 * Getting a table out of the app and into something the shop can send on.
 *
 * All four formats are driven by the same columns the screen is showing, so
 * what is exported is what was on screen — hiding a column or searching the
 * list narrows the file too. Anything else would be a quiet lie: someone
 * filters to one customer group, exports, and gets the whole book back.
 */

export interface ExportColumn<T> {
  /** Stable key, used for column visibility. */
  key: string;
  header: string;
  /** The cell as plain text. Exports never contain markup. */
  value: (row: T) => string;
}

/** Downloads a blob under a given name, then lets go of the object URL. */
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick: Safari has not started the download yet when
  // click() returns, and revoking synchronously cancels it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/**
 * One CSV cell.
 *
 * A value starting with =, +, - or @ is prefixed with a quote: spreadsheets
 * treat those as formulas, so a name like "=cmd" would execute on open. This
 * is the CSV injection every exporter has to defend against, because the
 * values come from whatever anyone typed into the form.
 */
function csvCell(v: string): string {
  const risky = /^[=+\-@\t\r]/.test(v);
  const text = risky ? `'${v}` : v;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportCsv<T>(rows: T[], cols: ExportColumn<T>[], name: string) {
  const lines = [
    cols.map((c) => csvCell(c.header)).join(','),
    ...rows.map((r) => cols.map((c) => csvCell(c.value(r))).join(',')),
  ];
  // The BOM is what makes Excel read it as UTF-8 rather than mangling every
  // Arabic name and dirham sign in the file.
  download(
    new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' }),
    `${name}-${stamp()}.csv`,
  );
}

export async function exportExcel<T>(rows: T[], cols: ExportColumn<T>[], name: string) {
  // Loaded only when asked for: the spreadsheet writer is far larger than the
  // page itself, and most visits never press the button.
  const XLSX = await import('xlsx');
  const data = [cols.map((c) => c.header), ...rows.map((r) => cols.map((c) => c.value(r)))];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = cols.map((c) => ({
    wch: Math.min(
      40,
      Math.max(c.header.length + 2, ...rows.map((r) => c.value(r).length + 2), 10),
    ),
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, name.slice(0, 31));
  XLSX.writeFile(book, `${name}-${stamp()}.xlsx`);
}

export async function exportPdf<T>(
  rows: T[],
  cols: ExportColumn<T>[],
  name: string,
  title: string,
) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  // Landscape, because these tables are far wider than they are tall.
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text(title, 40, 36);
  doc.setFontSize(9);
  doc.text(`${rows.length} rows · ${new Date().toLocaleString('en-GB')}`, 40, 50);
  autoTable(doc, {
    startY: 62,
    head: [cols.map((c) => c.header)],
    body: rows.map((r) => cols.map((c) => c.value(r))),
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [45, 90, 61], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 245] },
    margin: { left: 40, right: 40 },
  });
  doc.save(`${name}-${stamp()}.pdf`);
}
