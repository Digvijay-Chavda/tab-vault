import { describe, expect, it } from 'vitest';
import { dedupeKey, findDuplicateIds } from '../../src/core/duplicates';

describe('dedupeKey', () => {
  it('ignores fragment and trailing slash but keeps the query', () => {
    expect(dedupeKey('https://a.com/x/#top')).toBe(dedupeKey('https://a.com/x'));
    expect(dedupeKey('https://a.com/x?p=1')).not.toBe(dedupeKey('https://a.com/x?p=2'));
  });
});

describe('findDuplicateIds', () => {
  it('keeps the active tab and closes the rest', () => {
    const tabs = [
      { id: 1, url: 'https://a.com', windowId: 1, index: 0 },
      { id: 2, url: 'https://a.com/', windowId: 1, index: 1, active: true },
      { id: 3, url: 'https://b.com', windowId: 1, index: 2 },
    ];
    expect(findDuplicateIds(tabs)).toEqual([1]);
  });
  it('prefers a pinned tab over a plain one', () => {
    const tabs = [
      { id: 1, url: 'https://a.com', windowId: 1, index: 0 },
      { id: 2, url: 'https://a.com', windowId: 1, index: 1, pinned: true },
    ];
    expect(findDuplicateIds(tabs)).toEqual([1]);
  });
  it('does not treat the same URL in different windows as duplicates', () => {
    const tabs = [
      { id: 1, url: 'https://a.com', windowId: 1 },
      { id: 2, url: 'https://a.com', windowId: 2 },
    ];
    expect(findDuplicateIds(tabs)).toEqual([]);
  });
  it('ignores tabs without id or url', () => {
    expect(findDuplicateIds([{ id: 1 }, { url: 'https://a.com' }])).toEqual([]);
  });
});
