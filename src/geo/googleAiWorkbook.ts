import {
  parseGoogleAiPerformanceCsvExport,
  type GoogleAiPerformanceCsvOptions,
  type GoogleAiPerformanceExport,
} from './googleAiPerformance';
import { extractXlsxWorksheetCsvs } from './xlsxWorksheetCsv';

/** Read each recognized Google Search Console AI performance table as an isolated worksheet export. */
export async function parseGoogleAiPerformanceXlsxExport(
  source: Buffer,
  options: GoogleAiPerformanceCsvOptions = {}
): Promise<GoogleAiPerformanceExport[]> {
  const worksheets = await extractXlsxWorksheetCsvs(source);
  const exports: GoogleAiPerformanceExport[] = [];
  for (const worksheet of worksheets) {
    const sourceFile = options.sourceFile
      ? `${options.sourceFile}#${worksheet.name}`
      : worksheet.name;
    try {
      exports.push(
        parseGoogleAiPerformanceCsvExport(worksheet.csv, {
          ...options,
          sourceFile,
          maxBytes: 25 * 1024 * 1024,
          maxRows: 100_000,
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.startsWith('Could not identify a Search Console generative AI report header.'))
        throw error;
    }
  }
  if (exports.length === 0) {
    const sheets = worksheets.length ? worksheets.map(({ name }) => name).join(', ') : 'none';
    throw new Error(
      `No Google Search Console generative AI table was found in the workbook worksheets (${sheets}).`
    );
  }
  return exports;
}
