/** Minimal shape of chrome.sessions.Session so the mapping stays testable without chrome.*. */
export interface RawClosed {
  lastModified: number;
  tab?: { sessionId?: string; title?: string; url?: string; favIconUrl?: string };
  window?: { sessionId?: string; tabs?: Array<{ title?: string; url?: string; favIconUrl?: string }> };
}

export interface ClosedEntry {
  sessionId: string;
  kind: 'tab' | 'window';
  title: string;
  url: string;
  favIconUrl?: string;
  /** Number of tabs for a closed window; 1 for a tab. */
  tabs: number;
  /** Milliseconds since epoch. */
  closedAt: number;
}

/** Normalizes the browser's recently-closed list: drops entries that cannot be restored or have no address. */
export function toClosedEntries(raw: RawClosed[]): ClosedEntry[] {
  const out: ClosedEntry[] = [];
  for (const r of raw) {
    // Chrome reports lastModified in seconds.
    const closedAt = r.lastModified * 1000;
    if (r.tab?.sessionId && r.tab.url) {
      out.push({ sessionId: r.tab.sessionId, kind: 'tab', title: r.tab.title || r.tab.url, url: r.tab.url, favIconUrl: r.tab.favIconUrl, tabs: 1, closedAt });
    } else if (r.window?.sessionId && r.window.tabs?.length) {
      const first = r.window.tabs[0]!;
      const n = r.window.tabs.length;
      out.push({ sessionId: r.window.sessionId, kind: 'window', title: `Window with ${n} tab${n === 1 ? '' : 's'}`, url: first.url ?? '', favIconUrl: first.favIconUrl, tabs: n, closedAt });
    }
  }
  return out.sort((a, b) => b.closedAt - a.closedAt);
}

export async function listClosed(max = 25): Promise<ClosedEntry[]> {
  return toClosedEntries(await chrome.sessions.getRecentlyClosed({ maxResults: max }));
}

export const restoreClosed = (sessionId: string) => chrome.sessions.restore(sessionId);

/** "just now", "5 min ago", "3 h ago", "2 d ago". */
export function timeAgo(then: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
