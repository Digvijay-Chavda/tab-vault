import { getAll } from './activity';
import { archiveTargets, panicTargets, planSort, type SortMode } from './tab-plans';
import { saveArchive } from './sessions';
import { getSettings, saveSettings } from './settings';
import { hostOf } from './rules';
import { normalizeHost } from './settings-schema';
import { addSuspended } from './stats';

/** Suspends every tab except each window's active one (not audible ones). Returns how many were suspended. */
export async function panic(): Promise<number> {
  let n = 0;
  for (const id of panicTargets(await chrome.tabs.query({}))) {
    await chrome.tabs.discard(id).then(() => n++, () => undefined);
  }
  await addSuspended(n);
  return n;
}

export async function sortWindow(windowId: number, mode: SortMode): Promise<number> {
  const [tabs, activity] = await Promise.all([chrome.tabs.query({ windowId }), getAll()]);
  const runs = planSort(tabs, mode, activity);
  for (const run of runs) {
    await chrome.tabs.move(run.ids, { index: run.start });
  }
  return runs.reduce((n, r) => n + r.ids.length, 0);
}

/** Moves every tab from the other normal windows into this one. Returns the tab count moved. */
export async function mergeWindows(windowId: number): Promise<number> {
  const [wins, here] = await Promise.all([chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }), chrome.windows.get(windowId)]);
  let n = 0;
  for (const w of wins) {
    if (w.id === windowId || w.incognito !== here.incognito) continue; // tabs cannot cross between normal and private windows
    const ids = (w.tabs ?? []).flatMap((t) => (t.id === undefined ? [] : [t.id]));
    if (ids.length === 0) continue;
    await chrome.tabs.move(ids, { windowId, index: -1 });
    n += ids.length;
  }
  return n;
}

export const moveTab = (tabId: number, windowId: number) => chrome.tabs.move(tabId, { windowId, index: -1 });

/** Adds the tab's site to the never-suspend list. Returns the host, or null when it has none. */
export async function whitelistSite(url: string | undefined): Promise<string | null> {
  const host = normalizeHost(hostOf(url) ?? '');
  if (!host) return null;
  const { whitelist } = await getSettings();
  if (!whitelist.includes(host)) await saveSettings({ whitelist: [...whitelist, host] });
  return host;
}

/** Saves tabs idle for `archiveDays` into an archive session, then closes them. Returns how many were archived. */
export async function archiveStale(now = Date.now()): Promise<number> {
  const { archiveDays, whitelist } = await getSettings();
  if (archiveDays <= 0) return 0;
  const targets = archiveTargets(await chrome.tabs.query({}), now, archiveDays, whitelist) as chrome.tabs.Tab[];
  if (targets.length === 0) return 0;
  const stamp = new Date(now).toLocaleDateString();
  const saved = await saveArchive(targets, `Archive ${stamp}`);
  // Only close what was actually saved (browser pages are never archived, so never closed).
  if (saved > 0) await chrome.tabs.remove(targets.flatMap((t) => (t.id === undefined ? [] : [t.id])));
  return saved;
}
