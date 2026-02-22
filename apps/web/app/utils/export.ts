/**
 * Client-side CSV/data export utilities.
 * Generates CSV content and triggers browser download.
 */

interface CsvColumn<T> {
  header: string;
  /** Function to extract the cell value from a row */
  accessor: (row: T) => string | number | boolean | null | undefined;
}

/**
 * Escape a CSV value per RFC 4180:
 * - Wrap in quotes if it contains comma, quote, or newline
 * - Double any existing quotes
 */
function escapeCsvValue(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects to CSV string using column definitions.
 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((col) => escapeCsvValue(col.header)).join(',');
  const body = rows.map((row) =>
    columns.map((col) => escapeCsvValue(col.accessor(row))).join(','),
  );
  return [header, ...body].join('\r\n');
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType }); // BOM for Excel UTF-8
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data as CSV and trigger download.
 */
export function exportToCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename: string,
): void {
  const csv = toCsv(rows, columns);
  const dateSuffix = new Date().toISOString().slice(0, 10);
  downloadFile(csv, `${filename}_${dateSuffix}.csv`);
}
