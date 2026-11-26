import { describe, expect, it } from 'vitest';
import { parseBackup, buildBackup } from '../../src/core/backup';
import { formatTags, parseTags, sanitizeNote } from '../../src/core/notes';
import { DEFAULT_SETTINGS } from '../../src/core/types';

describe('parseTags', () => {
  it('lowercases, de-duplicates, strips symbols and bounds the list', () => {
    expect(parseTags('Read later, #Client-X  urgent; urgent <b>')).toEqual(['read', 'later', 'client-x', 'urgent', 'b']);
    expect(parseTags('a b c d e f g h i j k l')).toHaveLength(10);
    expect(parseTags('x'.repeat(100))[0]).toHaveLength(24);
    expect(parseTags('   ')).toEqual([]);
  });
  it('formats with hash marks', () => expect(formatTags(['a', 'b'])).toBe('#a #b'));
});

describe('sanitizeNote', () => {
  it('drops empty notes and bad input, trims long text', () => {
    expect(sanitizeNote({ key: 'k', note: '  ', tags: [] })).toBeNull();
    expect(sanitizeNote(null)).toBeNull();
    expect(sanitizeNote({ key: 'k', note: 'x'.repeat(900), tags: ['A b'] })!.note).toHaveLength(500);
    expect(sanitizeNote({ key: 'k', note: 'hi', tags: ['A b'] })!.tags).toEqual(['a', 'b']);
  });
});

describe('backup keeps groups, stash and notes', () => {
  it('round-trips tab groups and sanitizes them', () => {
    const b = buildBackup(DEFAULT_SETTINGS,
      [{ name: 's', createdAt: 1, kind: 'archive', tabs: [{ url: 'https://a.com', title: 'A', group: { title: 'Work', color: 'blue' } }, { url: 'https://b.com', title: 'B', group: { title: 'x'.repeat(80), color: 'neon' } }] }],
      [], 5,
      [{ url: 'https://s.com', title: 'S', createdAt: 2 }, { url: 'javascript:1', title: 'bad', createdAt: 2 }],
      [{ key: 'https://a.com', note: 'hello', tags: ['x'], updatedAt: 3 }, { key: '', note: '', tags: [], updatedAt: 0 }],
    );
    const p = parseBackup(JSON.stringify(b));
    expect(p.sessions[0]!.kind).toBe('archive');
    expect(p.sessions[0]!.tabs[0]!.group).toEqual({ title: 'Work', color: 'blue' });
    expect(p.sessions[0]!.tabs[1]!.group).toEqual({ title: 'x'.repeat(30), color: 'grey' });
    expect(p.stash.map((s) => s.url)).toEqual(['https://s.com']);
    expect(p.notes).toHaveLength(1);
  });
  it('still reads old backups without those fields', () => {
    const p = parseBackup(JSON.stringify({ app: 'tabvault', version: 1 }));
    expect(p.stash).toEqual([]);
    expect(p.notes).toEqual([]);
  });
});
