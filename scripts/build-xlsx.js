// Bundle the audited XLSX dependency graph so consumer installs retain security overrides.
const { build } = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const result = await build({
    entryPoints: ['src/geo/xlsxWorksheetCsv.ts'],
    outfile: 'dist/geo/xlsxWorksheetCsv.js',
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    sourcemap: true,
    metafile: true,
    plugins: [{ name: 'xlsx-workbook-only', setup(builder) {
      builder.onResolve({ filter: /^exceljs$/ }, () => ({ path: 'exceljs-workbook', namespace: 'aviary' }));
      builder.onLoad({ filter: /.*/, namespace: 'aviary' }, () => ({
        contents: `module.exports = { Workbook: require('exceljs/lib/doc/workbook') };`,
        resolveDir: process.cwd(),
      }));
    } }],
    legalComments: 'eof',
  });
  const roots = new Set();
  for (const input of Object.keys(result.metafile.inputs)) {
    if (!input.includes('node_modules/')) continue;
    let dir = path.dirname(path.resolve(input));
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'package.json')) && JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name) { roots.add(dir); break; }
      dir = path.dirname(dir);
    }
  }
  const notices = [];
  for (const root of [...roots].sort()) {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const files = fs.readdirSync(root).filter(name => /^(licen[cs]e|copying|notice)([.-]|$)/i.test(name));
    const texts = files.filter(name => fs.statSync(path.join(root, name)).isFile())
      .map(name => fs.readFileSync(path.join(root, name), 'utf8'));
    if (!texts.length) {
      if (!pkg.license) throw new Error(`Missing bundled dependency license: ${pkg.name}`);
      const readme = fs.readdirSync(root).find(name => /^readme([.-]|$)/i.test(name));
      texts.push(JSON.stringify({ name: pkg.name, version: pkg.version, license: pkg.license, author: pkg.author }, null, 2));
      if (readme) texts.push(fs.readFileSync(path.join(root, readme), 'utf8'));
    }
    notices.push(`${pkg.name}@${pkg.version} (${pkg.license || 'see license'})\n${texts.join('\n')}`);
  }
  fs.writeFileSync('dist/geo/XLSX-THIRD-PARTY-NOTICES.txt', notices.join('\n\n-----\n\n') + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
