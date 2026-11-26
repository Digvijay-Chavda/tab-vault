import { describe, expect, it } from 'vitest';
import { formatGroupRules, normalizeHost, parseGroupRules, sanitizeSettings } from '../../src/core/settings-schema';
import { DEFAULT_SETTINGS } from '../../src/core/types';

describe('normalizeHost', () => {
  it.each([
    ['example.com', 'example.com'],
    ['  HTTPS://www.Example.com/path?x=1  ', 'example.com'],
    ['*.example.com', 'example.com'],
    ['example.com:8080', 'example.com'],
    ['localhost', 'localhost'],
    ['not a host', ''],
    ['javascript:alert(1)', ''],
    ['', ''],
  ])('%j -> %j', (input, out) => expect(normalizeHost(input)).toBe(out));
});

describe('sanitizeSettings', () => {
  it('defaults warnDuplicates on and respects an explicit false', () => {
    expect(sanitizeSettings({}).warnDuplicates).toBe(true);
    expect(sanitizeSettings({ warnDuplicates: false }).warnDuplicates).toBe(false);
    expect(sanitizeSettings({ warnDuplicates: 'no' }).warnDuplicates).toBe(true);
  });
  it('returns defaults for garbage', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('x')).toEqual(DEFAULT_SETTINGS);
  });
  it('clamps idleMinutes and rounds', () => {
    expect(sanitizeSettings({ idleMinutes: -5 }).idleMinutes).toBe(0);
    expect(sanitizeSettings({ idleMinutes: 99999999 }).idleMinutes).toBe(7 * 24 * 60);
    expect(sanitizeSettings({ idleMinutes: 12.6 }).idleMinutes).toBe(13);
    expect(sanitizeSettings({ idleMinutes: 'abc' }).idleMinutes).toBe(DEFAULT_SETTINGS.idleMinutes);
  });
  it('normalizes and de-duplicates the whitelist', () => {
    const s = sanitizeSettings({ whitelist: ['Example.com', 'https://example.com/a', 'bad host', 42] });
    expect(s.whitelist).toEqual(['example.com']);
  });
  it('ignores wrongly typed booleans', () => {
    expect(sanitizeSettings({ suspendPinned: 'yes' }).suspendPinned).toBe(false);
  });
});

describe('grouping settings', () => {
  it('parses "host = name" lines, skipping invalid and duplicate hosts', () => {
    const rules = parseGroupRules('GitHub.com = Work\nbad line\n= nothing\nhttps://github.com/x = Dupe\nexample.com=  \nfoo.org = Foo');
    expect(rules).toEqual([{ host: 'github.com', name: 'Work' }, { host: 'foo.org', name: 'Foo' }]);
  });
  it('round-trips through format and parse', () => {
    const rules = [{ host: 'a.com', name: 'A' }, { host: 'b.com', name: 'B B' }];
    expect(parseGroupRules(formatGroupRules(rules))).toEqual(rules);
  });
  it('clamps minGroupSize and defaults autoGroup off', () => {
    expect(sanitizeSettings({ minGroupSize: 0 }).minGroupSize).toBe(2);
    expect(sanitizeSettings({ minGroupSize: 99 }).minGroupSize).toBe(10);
    expect(sanitizeSettings({}).autoGroup).toBe(false);
  });
  it('truncates long group names and rejects non-array rules', () => {
    expect(sanitizeSettings({ groupRules: [{ host: 'a.com', name: 'x'.repeat(100) }] }).groupRules[0]?.name).toHaveLength(30);
    expect(sanitizeSettings({ groupRules: 'nope' }).groupRules).toEqual([]);
  });
});
