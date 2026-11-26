// End-to-end smoke test: loads the built extension in real Chromium and drives the UI.
// Run: npm run build && npm run e2e   (CHROMIUM_PATH=/path/to/chrome to use a custom binary)
// Set SCREENSHOTS=1 to refresh docs/screenshots.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const extPath = path.join(root, '.output/chrome-mv3');
const shots = process.env.SCREENSHOTS === '1';

const server = http.createServer((req, res) => {
  const name = decodeURIComponent((req.url ?? '/').slice(1).split('?')[0] || 'home');
  res.setHeader('content-type', 'text/html');
  res.end(`<!doctype html><title>${name[0].toUpperCase() + name.slice(1)} Page</title><h1>${name}</h1>`);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const ctx = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'tabvault-e2e-')), {
  headless: false,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--headless=new', '--no-sandbox', `--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
});

let failed = false;
const step = async (name, fn) => {
  try { await fn(); console.log(`  ok  ${name}`); }
  catch (e) { failed = true; console.error(`  FAIL ${name}\n       ${e.message}`); }
};

try {
  let [sw] = ctx.serviceWorkers();
  sw ??= await ctx.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;
  const shot = (page, name) => shots && page.screenshot({ path: path.join(root, 'docs/screenshots', `${name}.png`) });

  const blank = ctx.pages()[0];
  const alpha = await ctx.newPage(); await alpha.goto(`${base}/alpha`);
  const beta = await ctx.newPage(); await beta.goto(`${base}/beta`);
  const panel = await ctx.newPage();
  await panel.setViewportSize({ width: 420, height: 760 });
  await panel.goto(`chrome-extension://${extId}/popup.html`);
  await panel.bringToFront();
  await blank?.close();

  const until = async (fn, ms = 10000) => {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > end) throw new Error('timed out waiting for condition');
      await new Promise((r) => setTimeout(r, 200));
    }
  };
  const groupTitles = () => sw.evaluate(async () => (await chrome.tabGroups.query({})).map((g) => g.title));
  const groupedTabCount = () => sw.evaluate(async () => (await chrome.tabs.query({})).filter((t) => t.groupId !== -1).length);
  const setGroupSettings = async ({ rules, auto }) => {
    const opts = await ctx.newPage();
    await opts.goto(`chrome-extension://${extId}/options.html`);
    await opts.fill('#grouprules', rules);
    await (auto ? opts.check('#autogroup') : opts.uncheck('#autogroup'));
    await opts.click('#save');
    await opts.getByText('Saved.').waitFor();
    await opts.close();
    await panel.bringToFront();
  };

  const badge = () => sw.evaluate(() => chrome.action.getBadgeText({}));
  const discarded = (title) => sw.evaluate(async (t) => (await chrome.tabs.query({})).find((x) => x.title?.includes(t))?.discarded, title);

  await step('lists open tabs', async () => {
    await panel.getByText('Alpha Page').first().waitFor();
    await panel.getByText('Beta Page').first().waitFor();
  });

  await step('search finds open tabs (typo tolerant)', async () => {
    await panel.fill('#q', 'alpa');
    await panel.getByRole('heading', { name: /^Results \(/ }).waitFor(); // wait for the async re-render
    await panel.getByText('Alpha Page').first().waitFor();
    assert.equal(await panel.getByText('Beta Page').count(), 0);
    await panel.fill('#q', '');
    await panel.getByRole('heading', { name: /^Open tabs/ }).waitFor();
  });

  await step('suspends background tabs on demand', async () => {
    await panel.getByRole('button', { name: 'Suspend idle now' }).click();
    await panel.waitForFunction(() => document.getElementById('stats').textContent.startsWith('0 suspended') === false);
    assert.equal(await discarded('Alpha Page'), true);
    assert.equal(await discarded('Beta Page'), true);
  });

  await step('detects and closes duplicate tabs', async () => {
    const dup = await ctx.newPage(); await dup.goto(`${base}/alpha`);
    await panel.bringToFront();
    await panel.getByRole('button', { name: /Close duplicates \(1\)/ }).waitFor();
    await until(async () => (await badge()) === '1'); // toolbar badge warns about the duplicate
    await panel.getByRole('button', { name: /Close duplicates/ }).click();
    await panel.getByRole('button', { name: 'Close duplicates (0)' }).waitFor();
    await until(async () => (await badge()) === '');
  });

  await step('lists recently closed tabs', async () => {
    await panel.getByRole('tab', { name: 'Closed' }).click();
    await panel.getByRole('heading', { name: /^Recently closed \(/ }).waitFor();
    await panel.getByText('Alpha Page').first().waitFor(); // the duplicate we just closed
    await shot(panel, 'closed');
    await panel.getByRole('tab', { name: 'Tabs' }).click();
    await panel.getByRole('heading', { name: /^Open tabs/ }).waitFor();
  });

  await step('saves a session and searches inside it', async () => {
    await panel.getByRole('tab', { name: 'Sessions' }).click();
    await panel.getByRole('button', { name: 'Save this window as a session' }).click();
    await panel.getByText(/\d+ tabs ·/).first().waitFor();
    await shot(panel, 'sessions');
    await panel.fill('#q', 'beta');
    await panel.getByRole('heading', { name: /^Results \(/ }).waitFor();
    await panel.getByText('saved', { exact: true }).first().waitFor();
    await panel.fill('#q', '');
    await panel.getByRole('heading', { name: /^Sessions/ }).waitFor();
  });

  await step('smart grouping: rules, manual group, ungroup, auto-group', async () => {
    await setGroupSettings({ rules: '127.0.0.1 = Local test\nnot a rule', auto: false });
    await panel.getByRole('tab', { name: 'Tabs' }).click();
    await panel.getByRole('button', { name: 'Group tabs' }).click();
    await panel.getByText('Grouped 2 tabs into 1 group.').waitFor();
    assert.deepEqual(await groupTitles(), ['Local test']);
    await panel.locator('.chip', { hasText: 'Local test' }).first().waitFor();
    await shot(panel, 'tabs');

    // Running it again changes nothing (idempotent) and never regroups grouped tabs.
    await panel.getByRole('button', { name: 'Group tabs' }).click();
    await panel.getByText(/Nothing to group/).waitFor();
    assert.equal(await groupedTabCount(), 2);

    panel.once('dialog', (d) => d.accept());
    await panel.getByRole('button', { name: 'Ungroup all' }).click();
    await panel.getByText('Ungrouped 2 tabs.').waitFor();
    assert.deepEqual(await groupTitles(), []);

    // Auto-group: a newly loaded tab triggers grouping of every ungrouped matching tab.
    await setGroupSettings({ rules: '127.0.0.1 = Local test', auto: true });
    const gamma = await ctx.newPage();
    await gamma.goto(`${base}/gamma`);
    await until(async () => (await groupedTabCount()) === 3);
    assert.deepEqual(await groupTitles(), ['Local test']);
    await gamma.close();
    await panel.bringToFront();
  });

  await step('creates and switches workspaces without losing tabs', async () => {
    await panel.getByRole('tab', { name: 'Workspaces' }).click();
    await panel.fill('input[type=text]', 'Research');
    await panel.getByRole('button', { name: 'Create' }).click();
    await panel.getByText('Research').first().waitFor();
    await shot(panel, 'workspaces');
    await panel.fill('input[type=text]', 'Scratch');
    // Regression: tab events while typing must not wipe the draft.
    const noise = await ctx.newPage(); await noise.goto(`${base}/noise`); await noise.close();
    await panel.bringToFront();
    await panel.waitForTimeout(600); // longer than the panel's re-render debounce
    assert.equal(await panel.inputValue('input[type=text]'), 'Scratch');
    await panel.getByRole('button', { name: 'Create' }).click();
    await panel.getByText('Scratch').first().waitFor();
    // Switch back to Research: window tabs are saved into Scratch first, then replaced.
    await panel.getByText('Research').first().click();
    await panel.waitForEvent('close').catch(() => {}); // the panel tab itself is closed by the switch
    const urls = await sw.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.url));
    assert.ok(urls.some((u) => u.includes('/alpha')), `alpha restored, got ${urls}`);
    assert.ok(urls.some((u) => u.includes('/beta')), `beta restored, got ${urls}`);
    const saved = await sw.evaluate(() => new Promise((res) => {
      const r = indexedDB.open('tabvault');
      r.onsuccess = () => {
        const g = r.result.transaction('workspaces').objectStore('workspaces').getAll();
        g.onsuccess = () => res(g.result.map((w) => `${w.name}:${w.tabs.length}`));
      };
    }));
    assert.ok(saved.includes('Scratch:2'), `Scratch kept its tabs, got ${saved}`);
  });

  await step('settings persist, export and import round-trip', async () => {
    const opts = await ctx.newPage();
    await opts.setViewportSize({ width: 760, height: 900 });
    await opts.goto(`chrome-extension://${extId}/options.html`);
    await opts.fill('#idle', '15');
    await opts.fill('#whitelist', 'https://Mail.Example.com/inbox\nnot a host');
    await opts.click('#save');
    await opts.getByText('Saved.').waitFor();
    await opts.reload();
    assert.equal(await opts.inputValue('#idle'), '15');
    assert.equal(await opts.inputValue('#whitelist'), 'mail.example.com');
    await shot(opts, 'settings');
    const [dl] = await Promise.all([opts.waitForEvent('download'), opts.click('#export')]);
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'tv-')), 'backup.json');
    await dl.saveAs(file);
    const backup = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(backup.app, 'tabvault');
    assert.ok(backup.sessions.length >= 1 && backup.workspaces.length === 2);
    await opts.setInputFiles('#file', file);
    await opts.getByText(/Imported \d+ sessions and 2 workspaces/).waitFor();
    const bad = path.join(path.dirname(file), 'bad.json');
    writeFileSync(bad, '{"app":"other"}');
    await opts.setInputFiles('#file', bad);
    await opts.getByText(/not a TabVault backup/).waitFor();
  });
} finally {
  await ctx.close();
  server.close();
}
if (failed) { console.error('\nE2E FAILED'); process.exit(1); }
console.log('\nE2E passed');
