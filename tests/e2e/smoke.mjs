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
  await panel.evaluate(() => { globalThis.close = () => {}; }); // the popup closes itself after jumping to a tab; keep this page alive
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

  await step('session restore brings back tab groups', async () => {
    await setGroupSettings({ rules: '127.0.0.1 = Local test', auto: false });
    // Give the existing group a distinctive name and color; the saved session must remember both.
    await sw.evaluate(async () => {
      const g = (await chrome.tabGroups.query({}))[0];
      await chrome.tabGroups.update(g.id, { title: 'Saved group', color: 'red' });
    });
    await panel.getByRole('tab', { name: 'Sessions' }).click();
    await panel.getByRole('button', { name: 'Save this window as a session' }).click();
    await panel.getByText('Session saved.').waitFor();
    await panel.locator('li', { hasText: /^Session /i }).first().click();
    const restored = await until(async () => {
      const wins = await sw.evaluate(async () => (await chrome.windows.getAll({ populate: true })).map((w) => ({
        id: w.id, tabs: w.tabs.map((t) => ({ url: t.url, groupId: t.groupId })),
      })));
      return wins.find((w) => w.tabs.length >= 2 && w.tabs.every((t) => t.url.startsWith('http') && t.groupId !== -1));
    });
    const info = await sw.evaluate(async (id) => (await chrome.tabGroups.get(id)), restored.tabs[0].groupId);
    assert.equal(info.title, 'Saved group');
    assert.equal(info.color, 'red');
    await sw.evaluate((id) => chrome.windows.remove(id), restored.id);
    await panel.bringToFront();
    await panel.getByRole('tab', { name: 'Tabs' }).click();
  });

  const rowOf = (text) => panel.locator('li', { hasText: text }).first();
  const rowMenu = async (text, item) => {
    const row = rowOf(text);
    await row.hover();
    await row.getByRole('button', { name: 'More actions' }).click();
    await panel.getByRole('menuitem', { name: item }).click();
  };

  await step('notes and tags are saved and searchable', async () => {
    await panel.getByRole('heading', { name: /^Open tabs/ }).waitFor();
    await rowMenu('Beta Page', 'Add note and tags…');
    await panel.getByRole('textbox', { name: 'Note', exact: true }).fill('quarterly numbers');
    await panel.getByRole('textbox', { name: 'Tags (separate with spaces)', exact: true }).fill('#Work finance');
    await panel.getByRole('button', { name: 'Save', exact: true }).click();
    await panel.getByText('Note saved.').waitFor();
    await panel.locator('.pill.tag', { hasText: '#finance' }).first().waitFor();
    await panel.fill('#q', '#finance');
    await panel.getByRole('heading', { name: /^Results \(\d+\)/ }).waitFor(); // the open tab plus its copies in saved sessions
    await panel.getByText('Beta Page').first().waitFor();
    assert.equal(await panel.getByText('Alpha Page').count(), 0, 'only tagged pages match');
    await panel.fill('#q', '');
    await panel.getByRole('heading', { name: /^Open tabs/ }).waitFor();
  });

  await step('stash a tab and see it in the Stash view', async () => {
    await rowMenu('Alpha Page', 'Stash and close');
    await panel.getByText(/Stashed 1 tab/).waitFor();
    await panel.getByRole('tab', { name: 'Stash' }).click();
    await panel.getByRole('heading', { name: /^Stashed tabs \(1\)/ }).waitFor();
    await panel.getByText('Alpha Page').first().waitFor();
    await shot(panel, 'stash');
    await panel.getByRole('tab', { name: 'Tabs' }).click();
    const again = await ctx.newPage(); await again.goto(`${base}/alpha`); // bring Alpha back so later steps keep two pages
    await panel.bringToFront();
    await panel.getByText('Alpha Page').first().waitFor();
  });

  await step('multi-select with Ctrl-click and bulk save', async () => {
    await rowOf('Beta Page').click({ modifiers: ['Control'] });
    await rowOf('Alpha Page').click({ modifiers: ['Control'] });
    await panel.getByText('2 selected').waitFor();
    await panel.getByRole('button', { name: 'Save session' }).click();
    await panel.getByText(/Saved 2 tabs as a session/).waitFor();
    assert.equal(await panel.getByText('2 selected').count(), 0);
  });

  await step('command palette sorts tabs; panic suspends all but the active tab', async () => {
    const extra = await ctx.newPage(); await extra.goto(`${base}/aardvark`);
    await panel.bringToFront();
    await panel.getByText('Aardvark Page').first().waitFor();
    await panel.fill('#q', '>sort');
    await panel.getByRole('heading', { name: /^Commands \(/ }).waitFor();
    await shot(panel, 'commands');
    await panel.fill('#q', '>sort by title');
    await panel.getByRole('heading', { name: /^Commands \(1\)/ }).waitFor();
    await panel.press('#q', 'Enter');
    await panel.getByText(/Sorted \d+ tabs|Already sorted/).waitFor();
    const order = await sw.evaluate(async () => (await chrome.tabs.query({})).sort((a, b) => a.index - b.index).map((t) => t.title));
    assert.ok(order.indexOf('Aardvark Page') < order.indexOf('TabVault'), `Aardvark sorted before the panel, got ${order}`);

    await panel.fill('#q', '>panic');
    await panel.getByRole('heading', { name: /^Commands \(/ }).waitFor();
    await panel.press('#q', 'Enter');
    await panel.getByText(/^Panic: suspended|Nothing to suspend/).waitFor();
    for (const t of ['Aardvark Page', 'Alpha Page', 'Beta Page']) assert.equal(await discarded(t), true, `${t} suspended`);
    assert.equal(await discarded('TabVault'), false, 'the active tab stays loaded');
    // The tab is suspended now, so close it through the browser API (a suspended page cannot answer page.close()).
    await sw.evaluate(async () => { for (const t of await chrome.tabs.query({})) if (t.url?.includes('/aardvark')) await chrome.tabs.remove(t.id); });
    await panel.bringToFront();
  });

  await step('insights view summarises open tabs', async () => {
    await panel.getByRole('tab', { name: 'Insights' }).click();
    await panel.getByRole('heading', { name: 'Top sites' }).waitFor();
    await panel.locator('.bar-label', { hasText: '127.0.0.1' }).waitFor();
    await panel.getByText('open tabs', { exact: true }).waitFor();
    await shot(panel, 'insights');
    await panel.getByRole('tab', { name: 'Tabs' }).click();
  });

  await step('merge windows and schedule a workspace', async () => {
    await sw.evaluate((url) => chrome.windows.create({ url }), `${base}/merge`);
    await until(async () => (await sw.evaluate(async () => (await chrome.windows.getAll({ windowTypes: ['normal'] })).length)) === 2);
    await panel.bringToFront();
    await panel.fill('#q', '>merge all windows');
    await panel.getByRole('heading', { name: /^Commands \(/ }).waitFor();
    await panel.press('#q', 'Enter');
    await panel.getByText(/Moved 1 tab into this window/).waitFor();
    assert.equal(await sw.evaluate(async () => (await chrome.windows.getAll({ windowTypes: ['normal'] })).length), 1);
    await sw.evaluate(async () => { for (const t of await chrome.tabs.query({})) if (t.url?.includes('/merge')) await chrome.tabs.remove(t.id); });

    // Schedule a throwaway workspace, then delete it (the later workspace steps expect exactly their own two).
    await panel.getByRole('tab', { name: 'Workspaces' }).click();
    await panel.fill('input[type=text]', 'Temp');
    await panel.getByRole('button', { name: 'Create' }).click();
    await rowOf('Temp').waitFor();
    await rowMenu('Temp', 'Open automatically…');
    await panel.getByRole('textbox', { name: /^Time/ }).fill('25:99');
    await panel.getByRole('button', { name: 'Save', exact: true }).click();
    await panel.getByText(/not a time/).waitFor(); // invalid input is rejected, not stored
    await rowMenu('Temp', 'Open automatically…');
    await panel.getByRole('textbox', { name: /^Time/ }).fill('9:30');
    await panel.getByRole('button', { name: 'Save', exact: true }).click();
    await panel.getByText(/Will open at 09:30/).waitFor();
    await panel.locator('.pill', { hasText: '⏰ 09:30 weekdays' }).waitFor();
    panel.once('dialog', (d) => d.accept());
    await rowMenu('Temp', 'Delete workspace');
    await panel.getByText('Temp').waitFor({ state: 'detached' });
    await panel.getByRole('tab', { name: 'Tabs' }).click();
  });

  await step('opt-in: opening an already-open page switches to the existing tab', async () => {
    const setDupeAction = async (value) => {
      const opts = await ctx.newPage();
      await opts.goto(`chrome-extension://${extId}/options.html`);
      await opts.selectOption('#dupeaction', value);
      await opts.click('#save');
      await opts.getByText('Saved.').waitFor();
      await opts.close();
    };
    await setDupeAction('switch');
    const before = await sw.evaluate(async () => (await chrome.tabs.query({})).length);
    const dup = await ctx.newPage();
    await dup.goto(`${base}/alpha`).catch(() => {}); // the new tab is closed as soon as it loads
    await until(() => dup.isClosed());
    assert.equal(await sw.evaluate(async () => (await chrome.tabs.query({})).length), before, 'no extra tab left open');
    await setDupeAction('badge');
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
    assert.ok(backup.stash.length >= 1 && backup.notes.length >= 1, 'stash and notes are part of the backup');
    await opts.setInputFiles('#file', file);
    await opts.getByText(/Imported \d+ sessions and 2 workspaces/).waitFor();
    const bad = path.join(path.dirname(file), 'bad.json');
    writeFileSync(bad, '{"app":"other"}');
    await opts.setInputFiles('#file', bad);
    await opts.getByText(/not a TabVault backup/).waitFor();
    await opts.click('#backupnow'); // writes a file into the downloads folder
    await opts.getByText(/^Saved TabVault\/tabvault-backup-.*\.json/).waitFor();
  });
} finally {
  await ctx.close();
  server.close();
}
if (failed) { console.error('\nE2E FAILED'); process.exit(1); }
console.log('\nE2E passed');
