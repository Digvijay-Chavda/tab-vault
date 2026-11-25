import { describe, expect, it } from 'vitest';
import { normalizeHost, sanitizeSettings } from '../../src/core/settings-schema';
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
