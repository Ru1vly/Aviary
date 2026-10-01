import {
  parseBingAiPerformanceCsvExport,
  type BingAiPerformanceCsvOptions,
  type BingAiPerformanceExport,
} from './bingAiPerformance';
import { extractXlsxWorksheetCsvs } from './xlsxWorksheetCsv';

/**
 * Read supported tables from a local Bing AI Performance workbook.
 * Workbook ZIP sizes, sheets, rows, columns, and converted CSV bytes are bounded before analysis.
 */
export async function parseBingAiPerformanceXlsxExport(
  source: Buffer,
  options: BingAiPerformanceCsvOptions = {}
): Promise<BingAiPerformanceExport[]> {
  const worksheets = await extractXlsxWorksheetCsvs(source);
  const exports: BingAiPerformanceExport[] = [];
  for (const worksheet of worksheets) {
    const sourceFile = options.sourceFile
      ? `${options.sourceFile}#${worksheet.name}`
      : worksheet.name;
    try {
      exports.push(
        parseBingAiPerformanceCsvExport(worksheet.csv, {
          ...options,
          sourceFile,
          maxBytes: 25 * 1024 * 1024,
          maxRows: 100_000,
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.startsWith('Could not identify a Bing AI Performance CSV header.')) throw error;
    }
  }
  if (exports.length === 0) {
    const sheets = worksheets.length ? worksheets.map(({ name }) => name).join(', ') : 'none';
    throw new Error(
      `No Bing AI Performance table was found in the workbook worksheets (${sheets}).`
    );
  }
  return exports;
}
