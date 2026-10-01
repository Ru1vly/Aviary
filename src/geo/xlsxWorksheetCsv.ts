import ExcelJS from 'exceljs';

const MAX_XLSX_BYTES = 25 * 1024 * 1024;
const MAX_XLSX_EXPANDED_BYTES = 128 * 1024 * 1024;
const MAX_XLSX_ENTRY_BYTES = 64 * 1024 * 1024;
const MAX_XLSX_ENTRIES = 2_000;
const MAX_XLSX_WORKSHEETS = 32;
const MAX_XLSX_ROWS = 100_000;
const MAX_XLSX_COLUMNS = 256;
const MAX_XLSX_CSV_BYTES = 25 * 1024 * 1024;

function preflightXlsxArchive(buffer: Buffer): void {
  if (buffer.length > MAX_XLSX_BYTES) throw new Error('XLSX exceeds the 25 MiB input limit.');
  const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const eocdOffset = buffer.lastIndexOf(eocdSignature, Math.max(0, buffer.length - 22));
  if (eocdOffset < 0 || eocdOffset + 22 > buffer.length)
    throw new Error('Input is not a valid XLSX ZIP archive.');

  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(eocdOffset + 6);
  const diskEntryCount = buffer.readUInt16LE(eocdOffset + 8);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryBytes = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const commentBytes = buffer.readUInt16LE(eocdOffset + 20);
  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    diskEntryCount !== entryCount ||
    entryCount === 0xffff ||
    centralDirectoryBytes === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    throw new Error('Multi-disk and ZIP64 XLSX archives are not supported.');
  }
  if (
    eocdOffset + 22 + commentBytes > buffer.length ||
    entryCount > MAX_XLSX_ENTRIES ||
    centralDirectoryOffset + centralDirectoryBytes > eocdOffset
  ) {
    throw new Error('XLSX ZIP directory is malformed or exceeds the archive-entry limit.');
  }

  let cursor = centralDirectoryOffset;
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectoryBytes;
  let expandedBytes = 0;
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (cursor + 46 > centralDirectoryEnd || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('XLSX ZIP directory contains a malformed entry.');
    }
    const flags = buffer.readUInt16LE(cursor + 8);
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedBytes = buffer.readUInt32LE(cursor + 20);
    const uncompressedBytes = buffer.readUInt32LE(cursor + 24);
    const fileNameBytes = buffer.readUInt16LE(cursor + 28);
    const extraBytes = buffer.readUInt16LE(cursor + 30);
    const entryCommentBytes = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const entryEnd = cursor + 46 + fileNameBytes + extraBytes + entryCommentBytes;
    if (
      entryEnd > centralDirectoryEnd ||
      compressedBytes === 0xffffffff ||
      uncompressedBytes === 0xffffffff ||
      localHeaderOffset === 0xffffffff ||
      (flags & 0x0001) !== 0 ||
      ![0, 8].includes(compressionMethod)
    ) {
      throw new Error('XLSX ZIP entry is encrypted, unsupported, or malformed.');
    }
    const fileName = buffer.toString('utf8', cursor + 46, cursor + 46 + fileNameBytes);
    const segments = fileName.replace(/\\/g, '/').split('/');
    if (fileName.startsWith('/') || segments.includes('..'))
      throw new Error('XLSX ZIP contains an unsafe entry path.');
    if (
      uncompressedBytes > MAX_XLSX_ENTRY_BYTES ||
      (uncompressedBytes > 1024 * 1024 &&
        compressedBytes > 0 &&
        uncompressedBytes / compressedBytes > 300)
    ) {
      throw new Error('An XLSX ZIP entry exceeds the expanded-size safety limit.');
    }
    expandedBytes += uncompressedBytes;
    if (expandedBytes > MAX_XLSX_EXPANDED_BYTES)
      throw new Error('XLSX expands beyond the 128 MiB safety limit.');
    cursor = entryEnd;
  }
  if (cursor !== centralDirectoryEnd)
    throw new Error('XLSX ZIP directory length does not match its entries.');
}

function cellValueText(value: ExcelJS.CellValue, numberFormat: string): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date)
    return Number.isNaN(value.valueOf()) ? '' : value.toISOString().slice(0, 10);
  if (typeof value === 'string' || typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return numberFormat.includes('%') ? `${value * 100}%` : String(value);
  }
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join('');
  }
  if ('text' in value && typeof value.text === 'string') return value.text;
  if ('result' in value) {
    const result = value.result;
    if (
      result === null ||
      result === undefined ||
      typeof result === 'string' ||
      typeof result === 'number' ||
      typeof result === 'boolean' ||
      result instanceof Date
    ) {
      return cellValueText(result, numberFormat);
    }
  }
  return '';
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Extract bounded worksheet values as CSV while keeping worksheet identity for callers. */
export async function extractXlsxWorksheetCsvs(
  source: Buffer
): Promise<Array<{ name: string; csv: string }>> {
  preflightXlsxArchive(source);
  const workbook = new ExcelJS.Workbook();
  const workbookBytes = new Uint8Array(source.length);
  workbookBytes.set(source);
  const workbookPayload = workbookBytes.buffer as unknown as Parameters<
    typeof workbook.xlsx.load
  >[0];
  await workbook.xlsx.load(workbookPayload);
  if (workbook.worksheets.length > MAX_XLSX_WORKSHEETS) {
    throw new Error(`XLSX contains more than ${MAX_XLSX_WORKSHEETS} worksheets.`);
  }

  const extracted: Array<{ name: string; csv: string }> = [];
  let totalRows = 0;
  let totalCsvBytes = 0;
  for (const worksheet of workbook.worksheets) {
    const records: string[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      if (row.cellCount > MAX_XLSX_COLUMNS) {
        throw new Error(
          `Worksheet "${worksheet.name}" has a row wider than the ${MAX_XLSX_COLUMNS}-column limit.`
        );
      }
      totalRows += 1;
      if (totalRows > MAX_XLSX_ROWS)
        throw new Error(
          `XLSX contains more than ${MAX_XLSX_ROWS.toLocaleString()} non-empty rows.`
        );
      const values: string[] = [];
      for (let column = 1; column <= row.cellCount; column += 1) {
        const cell = row.getCell(column);
        values.push(cellValueText(cell.value, cell.numFmt ?? ''));
      }
      if (values.some((value) => value.trim())) records.push(values.map(csvCell).join(','));
    });
    if (records.length < 2) continue;
    const csv = records.join('\n');
    totalCsvBytes += Buffer.byteLength(csv, 'utf8');
    if (totalCsvBytes > MAX_XLSX_CSV_BYTES) {
      throw new Error('Converted XLSX worksheet data exceeds the 25 MiB analysis limit.');
    }
    extracted.push({ name: worksheet.name, csv });
  }
  return extracted;
}
