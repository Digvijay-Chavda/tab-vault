import { describe, expect, it } from 'vitest';
import { isWhitelisted, shouldSuspend } from '../../src/core/rules';
import { DEFAULT_SETTINGS, type Settings } from '../../src/core/types';

const NOW = 10_000_000;
const MIN = 60_000;
const s = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, idleMinutes: 30, ...over });
const tab = { id: 1, url: 'https://example.com/a', active: false };

describe('shouldSuspend', () => {
  it('suspends a tab idle past the threshold', () => {
    expect(shouldSuspend(tab, NOW - 31 * MIN, NOW, s())).toBe(true);
  });
  it('keeps a tab that is not idle long enough', () => {
    expect(shouldSuspend(tab, NOW - 5 * MIN, NOW, s())).toBe(false);
  });
  it('never suspends on unknown activity (cold start)', () => {
    expect(shouldSuspend(tab, undefined, NOW, s())).toBe(false);
  });
  it('is disabled when idleMinutes is 0', () => {
    expect(shouldSuspend(tab, 0, NOW, s({ idleMinutes: 0 }))).toBe(false);
  });
  it('skips active, discarded, pinned and audible tabs by default', () => {
    const old = NOW - 999 * MIN;
    expect(shouldSuspend({ ...tab, active: true }, old, NOW, s())).toBe(false);
    expect(shouldSuspend({ ...tab, discarded: true }, old, NOW, s())).toBe(false);
    expect(shouldSuspend({ ...tab, pinned: true }, old, NOW, s())).toBe(false);
    expect(shouldSuspend({ ...tab, audible: true }, old, NOW, s())).toBe(false);
  });
  it('can opt in to pinned tabs', () => {
    expect(shouldSuspend({ ...tab, pinned: true }, 0, NOW, s({ suspendPinned: true }))).toBe(true);
  });
  it('skips browser-internal pages', () => {
    expect(shouldSuspend({ ...tab, url: 'chrome://settings' }, 0, NOW, s())).toBe(false);
    expect(shouldSuspend({ ...tab, url: 'brave://settings' }, 0, NOW, s())).toBe(false);
  });
  it('respects the whitelist including subdomains', () => {
    const st = s({ whitelist: ['example.com'] });
    expect(shouldSuspend({ ...tab, url: 'https://mail.example.com/x' }, 0, NOW, st)).toBe(false);
  });
});

describe('isWhitelisted', () => {
  it('does not match lookalike hosts', () => {
    expect(isWhitelisted('https://notexample.com', ['example.com'])).toBe(false);
  });
  it('ignores blank entries', () => {
    expect(isWhitelisted('https://example.com', ['  '])).toBe(false);
  });
});
