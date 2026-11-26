import { db } from '../storage/db';
import { isSuspendableUrl } from './rules';
import type { StashItem } from './types';

export const listStash = () => db.stash.orderBy('createdAt').reverse().toArray();
export const removeStash = (id: number) => db.stash.delete(id);
export const clearStash = () => db.stash.clear();

/** Pure: which of these tabs can be stashed (real web pages only). */
export function stashable(tabs: Array<Pick<chrome.tabs.Tab, 'url'>>): number {
  return tabs.filter((t) => isSuspendableUrl(t.url)).length;
}

/** Saves the tabs to the stash and closes them. Returns how many were stashed. Tabs that cannot be saved stay open. */
export async function stashTabs(tabs: chrome.tabs.Tab[]): Promise<number> {
  const items: StashItem[] = [];
  const closeIds: number[] = [];
  const now = Date.now();
  for (const t of tabs) {
    if (t.id === undefined || !t.url || !isSuspendableUrl(t.url)) continue;
    items.push({ url: t.url, title: t.title || t.url, favIconUrl: t.favIconUrl, createdAt: now });
    closeIds.push(t.id);
  }
  if (items.length === 0) return 0;
  await db.stash.bulkAdd(items); // saved first: a failure here must never lose a tab
  await chrome.tabs.remove(closeIds);
  return items.length;
}

/** Opens a stashed page in a new background tab and removes it from the stash. */
export async function unstash(item: StashItem): Promise<void> {
  await chrome.tabs.create({ url: item.url, active: true });
  if (item.id !== undefined) await db.stash.delete(item.id);
}
