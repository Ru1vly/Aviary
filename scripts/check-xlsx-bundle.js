const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ExcelJS = require('exceljs');

async function main() {
  const modulePath = path.resolve('dist/geo/xlsxWorksheetCsv.js');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Values');
  sheet.addRow(['Text', 'Date', 'Percent', 'Link', 'Formula', 'Rich', 'Boolean']);
  sheet.addRow([
    'a,"quoted"\nline',
    new Date('2026-10-04T00:00:00Z'),
    0.125,
    { text: 'visible', hyperlink: 'https://aviary-rs.com/' },
    { formula: '1+1', result: 2 },
    { richText: [{ text: 'rich ' }, { text: 'value' }] },
    true,
  ]);
  sheet.getCell('C2').numFmt = '0.0%';
  workbook.addWorksheet('Empty');
  workbook.addWorksheet('Header').addRow(['Page']);
  const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
  // Block dependency loading: the compiled reader must run using only Node builtins.
  const code = `
    const Module = require('node:module');
    const original = Module._load;
    Module._load = function(id, ...args) {
      if (!Module.isBuiltin(id) && id !== process.argv[1]) throw Error('External dependency: ' + id);
      return original.call(this, id, ...args);
    };
    const {extractXlsxWorksheetCsvs} = require(process.argv[1]);
    const fs = require('node:fs');
    (async () => {
      const rows = await extractXlsxWorksheetCsvs(fs.readFileSync(0));
      const assert = require('node:assert/strict');
      await assert.rejects(extractXlsxWorksheetCsvs(Buffer.from('invalid')), /valid XLSX ZIP/);
      await assert.rejects(extractXlsxWorksheetCsvs(Buffer.alloc(25 * 1024 * 1024 + 1)), /25 MiB/);
      console.log(JSON.stringify(rows));
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `;
  const result = spawnSync(process.execPath, ['-e', code, modulePath], {
    input: bytes,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [
    {
      name: 'Values',
      csv:
        '"Text","Date","Percent","Link","Formula","Rich","Boolean"\n' +
        '"a,""quoted""\nline","2026-10-04","12.5%","visible","2","rich value","true"',
    },
  ]);
  const notices = fs.readFileSync('dist/geo/XLSX-THIRD-PARTY-NOTICES.txt', 'utf8');
  assert.match(notices, /exceljs@4\.4\.0/);
  assert.match(notices, /uuid@11\.1\.1/);
  console.log('Bundled XLSX conversion, boundaries, dependency isolation, and notices pass.');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
