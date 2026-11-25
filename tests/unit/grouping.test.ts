import { describe, expect, it } from 'vitest';
import { categoryFor, colorFor, GROUP_COLORS, groupNameFor, planGroups, registrableDomain } from '../../src/core/grouping';

const S = { groupRules: [], minGroupSize: 2 };
const t = (id: number, url: string, extra: Record<string, unknown> = {}) => ({ id, url, groupId: -1, ...extra });

describe('registrableDomain', () => {
  it.each([
    ['mail.google.com', 'google.com'],
    ['google.com', 'google.com'],
    ['news.bbc.co.uk', 'bbc.co.uk'],
    ['a.b.example.com.au', 'example.com.au'],
    ['127.0.0.1', '127.0.0.1'],
    ['localhost', 'localhost'],
  ])('%s -> %s', (host, out) => expect(registrableDomain(host)).toBe(out));
});

describe('categoryFor', () => {
  it('uses the longest matching host', () => {
    expect(categoryFor('mail.google.com')).toBe('Mail');
    expect(categoryFor('docs.google.com')).toBe('Docs');
    expect(categoryFor('gist.github.com')).toBe('Dev');
  });
  it('matches brands across country domains', () => {
    expect(categoryFor('www.amazon.co.uk')).toBe('Shopping');
    expect(categoryFor('amazon.de')).toBe('Shopping');
  });
  it('does not match lookalike hosts', () => {
    expect(categoryFor('notgithub.com')).toBeNull();
  });
});

describe('groupNameFor', () => {
  it('ignores non-http pages', () => {
    expect(groupNameFor('chrome://settings', S)).toBeNull();
    expect(groupNameFor('chrome-extension://abc/x.html', S)).toBeNull();
    expect(groupNameFor('file:///tmp/a.html', S)).toBeNull();
    expect(groupNameFor(undefined, S)).toBeNull();
  });
  it('user rules beat categories, and the longest rule wins', () => {
    const rules = [{ host: 'github.com', name: 'Work' }, { host: 'gist.github.com', name: 'Snippets' }];
    expect(groupNameFor('https://github.com/x', { groupRules: rules })).toBe('Work');
    expect(groupNameFor('https://gist.github.com/x', { groupRules: rules })).toBe('Snippets');
  });
  it('falls back to the site when there is no category', () => {
    expect(groupNameFor('https://blog.example.com/p', S)).toBe('example.com');
  });
});

describe('colorFor', () => {
  it('is stable, case-insensitive and always a valid color', () => {
    expect(colorFor('Dev')).toBe(colorFor('dev'));
    expect(GROUP_COLORS).toContain(colorFor('whatever'));
  });
});

describe('planGroups', () => {
  it('groups tabs by category across different sites', () => {
    const plans = planGroups([t(1, 'https://github.com/a'), t(2, 'https://stackoverflow.com/q'), t(3, 'https://example.com')], [], S);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ name: 'Dev', tabIds: [1, 2] });
  });
  it('needs minGroupSize tabs to create a new group', () => {
    expect(planGroups([t(1, 'https://example.com/a')], [], S)).toEqual([]);
    expect(planGroups([t(1, 'https://example.com/a'), t(2, 'https://example.com/b')], [], { ...S, minGroupSize: 3 })).toEqual([]);
  });
  it('never touches pinned tabs, grouped tabs or browser pages', () => {
    const plans = planGroups([
      t(1, 'https://github.com/a', { pinned: true }),
      t(2, 'https://github.com/b', { groupId: 7 }),
      t(3, 'chrome://settings'),
      t(4, 'https://github.com/c'),
    ], [], S);
    expect(plans).toEqual([]); // only one eligible github tab, below the minimum
  });
  it('joins an existing group with the same title even for a single tab', () => {
    const plans = planGroups([t(1, 'https://github.com/a')], [{ id: 42, title: 'dev ' }], S);
    expect(plans).toEqual([expect.objectContaining({ name: 'Dev', tabIds: [1], existingGroupId: 42 })]);
  });
  it('keeps separate groups separate', () => {
    const plans = planGroups([
      t(1, 'https://github.com/a'), t(2, 'https://gitlab.com/b'),
      t(3, 'https://youtube.com/w'), t(4, 'https://vimeo.com/v'),
    ], [], S);
    expect(plans.map((p) => p.name).sort()).toEqual(['Dev', 'Video']);
  });
  it('treats a tab with no groupId as ungrouped', () => {
    const plans = planGroups([{ id: 1, url: 'https://github.com/a' }, { id: 2, url: 'https://github.com/b' }], [], S);
    expect(plans[0]?.tabIds).toEqual([1, 2]);
  });
});
