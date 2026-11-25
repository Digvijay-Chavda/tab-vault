import { describe, expect, it } from 'vitest';
import { createIndex, search, type SearchDoc } from '../../src/core/search';

const docs: SearchDoc[] = [
  { id: 'tab:1', title: 'Vitest guide', url: 'https://vitest.dev', source: 'open' },
  { id: 'saved:1:0', title: 'Dexie docs', url: 'https://dexie.org', source: 'saved', sessionName: 'Research' },
];

describe('search', () => {
  const idx = createIndex(docs);
  it('finds by title prefix', () => expect(search(idx, 'vite')[0]?.id).toBe('tab:1'));
  it('finds by session name', () => expect(search(idx, 'research')[0]?.id).toBe('saved:1:0'));
  it('tolerates typos', () => expect(search(idx, 'dexei')[0]?.id).toBe('saved:1:0'));
  it('returns nothing for blank queries', () => expect(search(idx, '  ')).toEqual([]));
});
