import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackup } from '../../src/core/backup';
import { DEFAULT_SETTINGS } from '../../src/core/types';

const tab = { url: 'https://a.com', title: 'A' };

describe('backup round trip', () => {
  it('export then import yields the same data', () => {
    const b = buildBackup(DEFAULT_SETTINGS, [{ name: 's', createdAt: 1, tabs: [tab], kind: 'manual' }], [{ name: 'w', createdAt: 1, updatedAt: 2, tabs: [tab] }], 5);
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.sessions[0]?.tabs[0]?.url).toBe('https://a.com');
    expect(parsed.workspaces[0]?.name).toBe('w');
    expect(parsed.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('parseBackup rejects and sanitizes untrusted input', () => {
  it('rejects non-JSON and foreign files', () => {
    expect(() => parseBackup('nope')).toThrow(/valid JSON/);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/not a TabVault/);
  });
  it('rejects backups from the future', () => {
    expect(() => parseBackup('{"app":"tabvault","version":999}')).toThrow(/newer/);
  });
  it('drops non-http(s) URLs such as javascript: and data:', () => {
    const raw = JSON.stringify({
      app: 'tabvault', version: 1,
      sessions: [{ name: 'x', createdAt: 1, tabs: [
        { url: 'javascript:alert(1)', title: 'bad' },
        { url: 'data:text/html,<script>', title: 'bad' },
        { url: 'file:///etc/passwd', title: 'bad' },
        { url: 'https://ok.com', title: 'ok' },
      ] }],
    });
    const tabs = parseBackup(raw).sessions[0]!.tabs;
    expect(tabs.map((t) => t.url)).toEqual(['https://ok.com']);
  });
  it('drops sessions that end up with no valid tabs', () => {
    const raw = JSON.stringify({ app: 'tabvault', version: 1, sessions: [{ name: 'x', tabs: [{ url: 'javascript:1' }] }] });
    expect(parseBackup(raw).sessions).toEqual([]);
  });
  it('survives missing fields and wrong types', () => {
    const p = parseBackup(JSON.stringify({ app: 'tabvault', version: 1, sessions: 'x', workspaces: [null, 3] }));
    expect(p.sessions).toEqual([]);
    expect(p.workspaces.every((w) => w.tabs.length === 0)).toBe(true);
  });
});
