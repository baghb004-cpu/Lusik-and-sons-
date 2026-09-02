// Renders the print pieces to PDF (and PNG previews) with headless Chromium.
//   node print/render.mjs [--preview-dir <dir>]
// Needs Playwright's Chromium: `npx playwright install chromium` once, or
// point PLAYWRIGHT_BROWSERS_PATH at an existing install.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'out');
fs.mkdirSync(outDir, { recursive: true });
const argIdx = process.argv.indexOf('--preview-dir');
const previewDir = argIdx > -1 ? process.argv[argIdx + 1] : null;
if (previewDir) fs.mkdirSync(previewDir, { recursive: true });

const jobs = [
  { file: 'brochure/brochure.html', query: '',            out: 'lusik-and-sons-brochure.pdf',            page: { width: '11in',    height: '8.5in'  } },
  { file: 'brochure/brochure.html', query: '?mode=bleed', out: 'lusik-and-sons-brochure-print-shop.pdf', page: { width: '11.25in', height: '8.75in' } },
  { file: 'coupons/coupons.html',   query: '',            out: 'lusik-and-sons-coupon-sheet.pdf',        page: { width: '8.5in',   height: '11in'   } },
];

const browser = await chromium.launch();
try {
  for (const job of jobs) {
    const abs = path.join(here, job.file);
    if (!fs.existsSync(abs)) { console.log(`skip (missing): ${job.file}`); continue; }
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(`file://${abs}${job.query}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Array.from(document.images).every(i => i.complete && i.naturalWidth > 0));
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: path.join(outDir, job.out), width: job.page.width, height: job.page.height, margin: { top: 0, right: 0, bottom: 0, left: 0 }, printBackground: true, preferCSSPageSize: false });
    const bytes = fs.statSync(path.join(outDir, job.out)).size;
    console.log(`wrote out/${job.out} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
    if (previewDir) {
      await page.emulateMedia({ media: 'screen' });
      const sheets = page.locator('.sheet');
      const n = await sheets.count();
      for (let i = 0; i < n; i++) {
        const png = path.join(previewDir, `${job.out.replace('.pdf', '')}-p${i + 1}.png`);
        await sheets.nth(i).screenshot({ path: png });
        console.log(`  preview ${png}`);
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}
