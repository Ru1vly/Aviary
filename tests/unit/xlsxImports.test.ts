import ExcelJS from 'exceljs';
import { extractXlsxWorksheetCsvs } from '../../src/geo/xlsxWorksheetCsv';
import { parseBingAiPerformanceXlsxExport } from '../../src/geo/bingAiWorkbook';
import { parseGoogleAiPerformanceXlsxExport } from '../../src/geo/googleAiWorkbook';

async function workbookBytes(sheets: Record<string, ExcelJS.CellValue[][]>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    workbook.addWorksheet(name).addRows(rows);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function mutateDirectory(
  source: Buffer,
  edit: (buffer: Buffer, directory: number, end: number) => void
) {
  const result = Buffer.from(source);
  const end = result.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  edit(result, result.readUInt32LE(end + 16), end);
  return result;
}

describe('XLSX import boundaries and values', () => {
  it('converts quoted strings, dates, formatted percentages, hyperlinks and cached formulas', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Values');
    sheet.addRow(['Text', 'Date', 'Percent', 'Link', 'Formula', 'Rich text', 'Boolean']);
    sheet.addRow([
      'a,"quoted"\nline',
      new Date('2026-10-03T00:00:00Z'),
      0.125,
      { text: 'visible label', hyperlink: 'https://example.com' },
      { formula: '1+1', result: 2 },
      { richText: [{ text: 'rich ' }, { text: 'value' }] },
      true,
    ]);
    sheet.getCell('C2').numFmt = '0.0%';
    const result = await extractXlsxWorksheetCsvs(Buffer.from(await workbook.xlsx.writeBuffer()));
    expect(result).toEqual([
      {
        name: 'Values',
        csv:
          '"Text","Date","Percent","Link","Formula","Rich text","Boolean"\n' +
          '"a,""quoted""\nline","2026-10-03","12.5%","visible label","2","rich value","true"',
      },
    ]);
  });

  it('omits empty and header-only sheets while preserving worksheet identity', async () => {
    const source = await workbookBytes({ Empty: [], Header: [['Page']], Data: [['Page'], ['a']] });
    expect(await extractXlsxWorksheetCsvs(source)).toEqual([{ name: 'Data', csv: '"Page"\n"a"' }]);
  });

  it('rejects non-ZIP input and oversized compressed input before loading', async () => {
    await expect(extractXlsxWorksheetCsvs(Buffer.from('not a workbook'))).rejects.toThrow(
      /valid XLSX ZIP/
    );
    await expect(extractXlsxWorksheetCsvs(Buffer.alloc(25 * 1024 * 1024 + 1))).rejects.toThrow(
      /25 MiB input/
    );
  });

  it('rejects unsupported archive topology, malformed directories and encrypted entries', async () => {
    const source = await workbookBytes({ Data: [['Page'], ['a']] });
    const cases: Array<[RegExp, (buffer: Buffer, directory: number, end: number) => void]> = [
      [/Multi-disk/, (b, _d, e) => b.writeUInt16LE(1, e + 4)],
      [/ZIP64/, (b, _d, e) => b.writeUInt32LE(0xffffffff, e + 16)],
      [
        /archive-entry limit/,
        (b, _d, e) => {
          b.writeUInt16LE(2001, e + 8);
          b.writeUInt16LE(2001, e + 10);
        },
      ],
      [/malformed entry/, (b, d) => b.writeUInt32LE(0, d)],
      [/encrypted, unsupported/, (b, d) => b.writeUInt16LE(1, d + 8)],
      [/encrypted, unsupported/, (b, d) => b.writeUInt16LE(99, d + 10)],
      [/expanded-size/, (b, d) => b.writeUInt32LE(64 * 1024 * 1024 + 1, d + 24)],
      [
        /expanded-size/,
        (b, d) => {
          b.writeUInt32LE(1, d + 20);
          b.writeUInt32LE(2 * 1024 * 1024, d + 24);
        },
      ],
      [/unsafe entry path/, (b, d) => b.write('/x', d + 46, 'utf8')],
      [/unsafe entry path/, (b, d) => b.write('../x', d + 46, 'utf8')],
    ];
    for (const [message, mutate] of cases) {
      await expect(extractXlsxWorksheetCsvs(mutateDirectory(source, mutate))).rejects.toThrow(
        message
      );
    }
  });

  it('rejects excessive worksheet counts and rows wider than 256 columns', async () => {
    const many = Object.fromEntries(
      Array.from({ length: 33 }, (_, i) => [`Sheet${i}`, [['a'], ['b']]])
    );
    await expect(extractXlsxWorksheetCsvs(await workbookBytes(many))).rejects.toThrow(
      /32 worksheets/
    );
    await expect(
      extractXlsxWorksheetCsvs(await workbookBytes({ Wide: [Array(257).fill('a'), ['b']] }))
    ).rejects.toThrow(/256-column limit/);
  });
});

describe('Bing and Google workbook reports', () => {
  it('detects each Bing report and skips unrelated sheets without losing provenance', async () => {
    const source = await workbookBytes({
      Notes: [['Note'], ['Unrelated report']],
      Pages: [
        ['Page', 'Citations'],
        ['https://example.com/a', 12],
      ],
      Queries: [
        ['Query', 'Citations'],
        ['best tools', 7],
      ],
    });
    const exports = await parseBingAiPerformanceXlsxExport(source, { sourceFile: 'bing.xlsx' });
    expect(exports.map((item) => [item.sourceFile, item.rowCount])).toEqual([
      ['bing.xlsx#Pages', 1],
      ['bing.xlsx#Queries', 1],
    ]);
    expect(exports[0].rows[0]).toMatchObject({ url: 'https://example.com/a', citations: 12 });
    expect((await parseBingAiPerformanceXlsxExport(source))[0].sourceFile).toBe('Pages');
  });

  it('detects Google reports and preserves numeric performance metrics', async () => {
    const source = await workbookBytes({
      Notes: [['Note'], ['Unrelated report']],
      Pages: [
        ['Page', 'Impressions', 'Clicks'],
        ['https://example.com/a', 120, 5],
      ],
    });
    const exports = await parseGoogleAiPerformanceXlsxExport(source, { sourceFile: 'google.xlsx' });
    expect(exports).toHaveLength(1);
    expect(exports[0]).toMatchObject({ sourceFile: 'google.xlsx#Pages', rowCount: 1 });
    expect(exports[0].rows[0]).toMatchObject({
      url: 'https://example.com/a',
      impressions: 120,
    });
    expect((await parseGoogleAiPerformanceXlsxExport(source))[0].sourceFile).toBe('Pages');
  });

  it('reports absent recognized tables and propagates errors in recognized tables', async () => {
    const unrelated = await workbookBytes({ Notes: [['Note'], ['No data']] });
    await expect(parseBingAiPerformanceXlsxExport(unrelated)).rejects.toThrow(/No Bing.*Notes/);
    await expect(parseGoogleAiPerformanceXlsxExport(unrelated)).rejects.toThrow(/No Google.*Notes/);
    await expect(
      parseBingAiPerformanceXlsxExport(
        await workbookBytes({
          Data: [
            ['Page', 'Citations'],
            ['a', 'invalid'],
          ],
        })
      )
    ).rejects.toThrow(/no rows/);
    await expect(
      parseGoogleAiPerformanceXlsxExport(
        await workbookBytes({
          Data: [
            ['Page', 'Impressions'],
            ['a', 'invalid'],
          ],
        })
      )
    ).rejects.toThrow(/no rows/);
    await expect(parseBingAiPerformanceXlsxExport(await workbookBytes({}))).rejects.toThrow(
      /worksheets \(none\)/
    );
    await expect(parseGoogleAiPerformanceXlsxExport(await workbookBytes({}))).rejects.toThrow(
      /worksheets \(none\)/
    );
  });
});
