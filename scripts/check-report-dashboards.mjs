// Offline browser smoke for generated dashboards. Requires installed Playwright Chromium.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
if (!process.argv[2]) throw new Error('Supply a directory containing generated HTML reports.');
const root = path.resolve(process.argv[2]);
const files = fs.readdirSync(root).filter((name) => name.endsWith('.html'));
if (!files.length) throw new Error('No HTML reports found.');
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route(/^https?:/, (route) => route.abort());
    for (const file of files) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(pathToFileURL(path.join(root, file)).href);
      const layout = await page.evaluate(() => ({
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      }));
      results.push({ file, width, ...layout, errors });
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}
const failures = results.filter((row) => row.errors.length || row.documentWidth > row.viewport);
fs.writeFileSync(
  path.join(root, 'browser-layout-audit.json'),
  JSON.stringify(
    {
      scope:
        'Offline Chromium document overflow and uncaught page errors. Network blocked. Does not assess visual quality or filter semantics.',
      results,
    },
    null,
    2
  ) + '\n'
);
console.log(JSON.stringify({ pages: results.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
