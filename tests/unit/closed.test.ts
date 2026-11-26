import { describe, expect, it } from 'vitest';
import { timeAgo, toClosedEntries } from '../../src/core/closed';

describe('toClosedEntries', () => {
  it('maps tabs and windows, newest first, and skips unrestorable entries', () => {
    const out = toClosedEntries([
      { lastModified: 100, tab: { sessionId: 'a', title: 'Old', url: 'https://a.test' } },
      { lastModified: 300, window: { sessionId: 'w', tabs: [{ url: 'https://w.test' }, { url: 'https://x.test' }] } },
      { lastModified: 200, tab: { sessionId: 'b', url: 'https://b.test' } },
      { lastModified: 400, tab: { title: 'no session id', url: 'https://c.test' } },
      { lastModified: 500, window: { sessionId: 'empty', tabs: [] } },
    ]);
    expect(out.map((e) => e.sessionId)).toEqual(['w', 'b', 'a']);
    expect(out[0]).toMatchObject({ kind: 'window', tabs: 2, title: 'Window with 2 tabs', closedAt: 300_000 });
    expect(out[1]!.title).toBe('https://b.test'); // falls back to the address
  });
});

describe('timeAgo', () => {
  const now = 1_000_000_000;
  it.each([
    [now - 5_000, 'just now'], [now - 5 * 60_000, '5 min ago'], [now - 3 * 3_600_000, '3 h ago'], [now - 2 * 86_400_000, '2 d ago'],
  ])('%s', (t, label) => expect(timeAgo(t, now)).toBe(label));
});
