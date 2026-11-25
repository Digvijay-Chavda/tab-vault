import { describe, expect, it } from 'vitest';

// sessions.ts imports Dexie/chrome at module load only lazily, but keep this test pure:
import { pruneIds } from '../../src/core/sessions';

describe('pruneIds', () => {
  const mk = (id: number, createdAt: number, kind: 'auto' | 'manual') => ({ id, createdAt, kind });
  it('keeps the newest N auto snapshots and never touches manual sessions', () => {
    const all = [mk(1, 1, 'auto'), mk(2, 2, 'auto'), mk(3, 3, 'auto'), mk(4, 0, 'manual')];
    expect(pruneIds(all, 2)).toEqual([1]);
  });
  it('returns nothing when under the limit', () => {
    expect(pruneIds([mk(1, 1, 'auto')], 10)).toEqual([]);
  });
});
