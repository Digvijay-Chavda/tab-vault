import { sanitizeSettings } from './settings-schema';
import type { Settings } from './types';

const KEY = 'settings';

/** Prefers chrome.storage.sync (follows the user across devices), falls back to local. */
export async function getSettings(): Promise<Settings> {
  try {
    const s = await chrome.storage.sync.get(KEY);
    if (s[KEY]) return sanitizeSettings(s[KEY]);
  } catch {
    /* sync unavailable (e.g. signed out); use local */
  }
  const l = await chrome.storage.local.get(KEY);
  return sanitizeSettings(l[KEY]);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = sanitizeSettings({ ...(await getSettings()), ...patch });
  await chrome.storage.local.set({ [KEY]: next });
  try {
    await chrome.storage.sync.set({ [KEY]: next });
  } catch {
    // Quota or offline: drop the stale synced copy so local (newer) wins.
    await chrome.storage.sync.remove(KEY).catch(() => undefined);
  }
  return next;
}
