import { dedupeKey } from './duplicates';
import { hostOf, isSuspendableUrl, isWhitelisted } from './rules';
import type { TabLike } from './types';

export type SortMode = 'title' | 'site' | 'recent';

const siteOf = (t: TabLike) => (hostOf(t.url) ?? '').replace(/^www\./, '');

export interface SortRun {
  /** Index of the first tab in the run. */
  start: number;
  /** Tab ids in the order they should end up. */
  ids: number[];
}

/**
 * Plans an in-place sort that never breaks anything the user arranged: pinned tabs stay first and every tab
 * group keeps its place. Tabs are only reordered inside a run of neighbours that share pinned state and group.
 * `lastActive` maps tab id -> epoch ms (used by 'recent': most recently used first).
 */
export function planSort(tabs: TabLike[], mode: SortMode, lastActive: Record<string, number> = {}): SortRun[] {
  const ordered = [...tabs].filter((t) => t.id !== undefined).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const cmp = (a: TabLike, b: TabLike): number => {
    if (mode === 'title') return (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' });
    if (mode === 'site') return siteOf(a).localeCompare(siteOf(b)) || (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' });
    const at = lastActive[String(a.id)] ?? a.lastAccessed ?? 0;
    const bt = lastActive[String(b.id)] ?? b.lastAccessed ?? 0;
    return bt - at;
  };
  const runKey = (t: TabLike) => `${t.pinned ? 'p' : 'n'}:${t.groupId ?? -1}`;
  const runs: SortRun[] = [];
  let i = 0;
  while (i < ordered.length) {
    let j = i;
    while (j < ordered.length && runKey(ordered[j]!) === runKey(ordered[i]!)) j++;
    const run = ordered.slice(i, j);
    const sorted = [...run].sort(cmp);
    if (run.some((t, k) => t.id !== sorted[k]!.id)) {
      runs.push({ start: run[0]!.index ?? i, ids: sorted.map((t) => t.id!) });
    }
    i = j;
  }
  return runs;
}

/** Panic: every tab that is not the active tab of its window and not playing audio. */
export function panicTargets(tabs: TabLike[]): number[] {
  return tabs.filter((t) => t.id !== undefined && !t.active && !t.discarded && !t.audible).map((t) => t.id!);
}

/**
 * Tabs that have sat unopened for `days` days: candidates to archive and close.
 * Never the active tab, pinned or audible tabs, grouped tabs the user is organising are fine, browser pages are skipped,
 * and the never-suspend list protects sites here too.
 */
export function archiveTargets(tabs: TabLike[], now: number, days: number, whitelist: string[]): TabLike[] {
  if (days <= 0) return [];
  const cutoff = now - days * 86_400_000;
  return tabs.filter(
    (t) =>
      t.id !== undefined && !t.active && !t.pinned && !t.audible &&
      isSuspendableUrl(t.url) && !isWhitelisted(t.url, whitelist) &&
      t.lastAccessed !== undefined && t.lastAccessed < cutoff,
  );
}

export interface Insights {
  tabs: number;
  windows: number;
  suspended: number;
  duplicates: number;
  pinned: number;
  topSites: Array<{ site: string; count: number }>;
  oldest: Array<{ id: number; title: string; url: string; idleDays: number }>;
}

/** Counts for the Insights view. `duplicateIds` comes from findDuplicateIds. */
export function summarize(tabs: TabLike[], duplicateIds: number[], now: number, top = 6): Insights {
  const bySite = new Map<string, number>();
  for (const t of tabs) {
    const site = siteOf(t);
    if (site) bySite.set(site, (bySite.get(site) ?? 0) + 1);
  }
  const oldest = tabs
    .filter((t) => t.id !== undefined && t.lastAccessed !== undefined && !t.active)
    .sort((a, b) => a.lastAccessed! - b.lastAccessed!)
    .slice(0, 5)
    .map((t) => ({
      id: t.id!, title: t.title || t.url || 'Untitled', url: t.url ?? '',
      idleDays: Math.max(0, Math.floor((now - t.lastAccessed!) / 86_400_000)),
    }));
  return {
    tabs: tabs.length,
    windows: new Set(tabs.map((t) => t.windowId)).size,
    suspended: tabs.filter((t) => t.discarded).length,
    duplicates: duplicateIds.length,
    pinned: tabs.filter((t) => t.pinned).length,
    topSites: [...bySite].map(([site, count]) => ({ site, count })).sort((a, b) => b.count - a.count || a.site.localeCompare(b.site)).slice(0, top),
    oldest,
  };
}

/**
 * When `tab` just navigated to a page already open in the same window, returns the tab to switch to.
 * Pinned tabs and tabs that are the only copy never trigger it.
 */
export function duplicateOf(tab: TabLike, all: TabLike[]): TabLike | undefined {
  if (tab.id === undefined || !tab.url || tab.pinned || !isSuspendableUrl(tab.url)) return undefined;
  const key = dedupeKey(tab.url);
  return all.find((o) => o.id !== undefined && o.id !== tab.id && o.windowId === tab.windowId && o.url && dedupeKey(o.url) === key);
}
