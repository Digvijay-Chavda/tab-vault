// Renders scripts/icon.svg to PNGs in public/icon/. Run: node scripts/make-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync(new URL('./icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const size of [16, 32, 48, 96, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: new URL(`../public/icon/${size}.png`, import.meta.url).pathname, omitBackground: true });
  await page.close();
}
await browser.close();
