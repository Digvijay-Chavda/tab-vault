import type { Settings, TabLike } from './types';

const SKIP_PROTOCOLS = ['chrome:', 'chrome-extension:', 'brave:', 'about:', 'edge:', 'moz-extension:'];

export function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isWhitelisted(url: string | undefined, whitelist: string[]): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return whitelist.some((entry) => {
    const e = entry.trim().toLowerCase();
    return e !== '' && (host === e || host.endsWith('.' + e));
  });
}

export function isSuspendableUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return !SKIP_PROTOCOLS.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Decide whether a tab should be discarded now.
 * `lastActive` is epoch ms of the last time the tab was active/updated; `now` is epoch ms.
 */
export function shouldSuspend(tab: TabLike, lastActive: number | undefined, now: number, s: Settings): boolean {
  if (s.idleMinutes <= 0) return false;
  if (tab.active || tab.discarded) return false;
  if (tab.pinned && !s.suspendPinned) return false;
  if (tab.audible && !s.suspendAudible) return false;
  if (!isSuspendableUrl(tab.url)) return false;
  if (isWhitelisted(tab.url, s.whitelist)) return false;
  // Unknown activity: treat as just seen so we never suspend on a cold start.
  if (lastActive === undefined) return false;
  return now - lastActive >= s.idleMinutes * 60_000;
}
