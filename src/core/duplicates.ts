import type { TabLike } from './types';

/** URL identity for duplicate detection: ignores the #fragment and a trailing slash. */
export function dedupeKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href.replace(/\/$/, '');
  } catch {
    return url;
  }
}

/**
 * Returns ids of tabs that duplicate another tab in the same window.
 * The kept tab per group is the active one, otherwise the pinned one, otherwise the leftmost.
 */
export function findDuplicateIds(tabs: TabLike[]): number[] {
  const groups = new Map<string, TabLike[]>();
  for (const t of tabs) {
    if (t.id === undefined || !t.url) continue;
    const key = `${t.windowId ?? 0}|${dedupeKey(t.url)}`;
    const g = groups.get(key);
    if (g) g.push(t);
    else groups.set(key, [t]);
  }
  const rank = (t: TabLike) => (t.active ? 0 : t.pinned ? 1 : 2);
  const dupes: number[] = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const sorted = [...g].sort((a, b) => rank(a) - rank(b) || (a.index ?? 0) - (b.index ?? 0));
    for (const t of sorted.slice(1)) dupes.push(t.id!);
  }
  return dupes;
}
