import { describe, expect, it } from 'vitest';
import { archiveTargets, duplicateOf, panicTargets, planSort, summarize } from '../../src/core/tab-plans';
import type { TabLike } from '../../src/core/types';

const tab = (id: number, o: Partial<TabLike> = {}): TabLike => ({ id, index: id, windowId: 1, url: `https://site${id}.com/`, title: `T${id}`, ...o });

describe('planSort', () => {
  it('sorts by title but keeps pinned tabs first and group blocks in place', () => {
    const tabs = [
      tab(0, { pinned: true, title: 'Z pinned' }), tab(1, { pinned: true, title: 'A pinned' }),
      tab(2, { title: 'banana', groupId: 7 }), tab(3, { title: 'apple', groupId: 7 }),
      tab(4, { title: 'zebra' }), tab(5, { title: 'ant' }),
    ];
    const runs = planSort(tabs, 'title');
    expect(runs).toEqual([
      { start: 0, ids: [1, 0] },
      { start: 2, ids: [3, 2] },
      { start: 4, ids: [5, 4] },
    ]);
  });
  it('returns nothing when already sorted', () => {
    expect(planSort([tab(0, { title: 'a' }), tab(1, { title: 'b' })], 'title')).toEqual([]);
  });
  it('sorts by site and by most recent use', () => {
    const tabs = [tab(0, { url: 'https://www.zed.com/' }), tab(1, { url: 'https://alpha.com/' })];
    expect(planSort(tabs, 'site')[0]!.ids).toEqual([1, 0]);
    expect(planSort([tab(0), tab(1)], 'recent', { '0': 10, '1': 99 })[0]!.ids).toEqual([1, 0]);
  });
});

describe('panicTargets', () => {
  it('skips active, audible and already-suspended tabs', () => {
    const tabs = [tab(1, { active: true }), tab(2), tab(3, { audible: true }), tab(4, { discarded: true }), tab(5, { pinned: true })];
    expect(panicTargets(tabs)).toEqual([2, 5]);
  });
});

describe('archiveTargets', () => {
  const now = 100 * 86_400_000;
  const old = now - 40 * 86_400_000;
  it('selects only long-unopened, ordinary web tabs', () => {
    const tabs = [
      tab(1, { lastAccessed: old }), tab(2, { lastAccessed: now - 86_400_000 }), tab(3, { lastAccessed: old, pinned: true }),
      tab(4, { lastAccessed: old, active: true }), tab(5, { lastAccessed: old, url: 'chrome://settings' }),
      tab(6, { lastAccessed: old, url: 'https://mail.example.com/x' }), tab(7),
    ];
    expect(archiveTargets(tabs, now, 30, ['example.com']).map((t) => t.id)).toEqual([1]);
  });
  it('does nothing when off', () => expect(archiveTargets([tab(1, { lastAccessed: 0 })], now, 0, [])).toEqual([]));
});

describe('summarize', () => {
  it('counts sites and lists the oldest tabs', () => {
    const now = 10 * 86_400_000;
    const tabs = [
      tab(1, { url: 'https://a.com/1', lastAccessed: now - 5 * 86_400_000 }), tab(2, { url: 'https://www.a.com/2', lastAccessed: now - 9 * 86_400_000 }),
      tab(3, { url: 'https://b.com/', discarded: true, windowId: 2, active: true }),
    ];
    const s = summarize(tabs, [2], now);
    expect(s).toMatchObject({ tabs: 3, windows: 2, suspended: 1, duplicates: 1 });
    expect(s.topSites[0]).toEqual({ site: 'a.com', count: 2 });
    expect(s.oldest.map((o) => [o.id, o.idleDays])).toEqual([[2, 9], [1, 5]]);
  });
});

describe('duplicateOf', () => {
  it('finds the other tab with the same address in the same window', () => {
    const a = tab(1, { url: 'https://x.com/p#a' });
    const b = tab(2, { url: 'https://x.com/p#b' });
    expect(duplicateOf(b, [a, b])?.id).toBe(1);
    expect(duplicateOf(b, [b])).toBeUndefined();
    expect(duplicateOf(b, [a, { ...b }].map((t) => ({ ...t, windowId: t.id === 1 ? 9 : 1 })))).toBeUndefined();
    expect(duplicateOf({ ...b, pinned: true }, [a, b])).toBeUndefined();
  });
});
