/** Encode one RFC 4180-style CSV cell and neutralize spreadsheet formulas. */
export function escapeSpreadsheetCsvCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  let text = Array.isArray(value) ? value.join('|') : String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
