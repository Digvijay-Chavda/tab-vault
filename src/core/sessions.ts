import { db } from '../storage/db';
import { isSuspendableUrl } from './rules';
import type { SavedTab, Session } from './types';

export function toSavedTabs(tabs: chrome.tabs.Tab[]): SavedTab[] {
  return tabs
    .filter((t) => isSuspendableUrl(t.url))
    .map((t) => ({ url: t.url!, title: t.title ?? t.url!, favIconUrl: t.favIconUrl, pinned: t.pinned }));
}

export async function saveCurrentWindow(name?: string): Promise<Session> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const createdAt = Date.now();
  const session: Session = {
    name: name?.trim() || `Session ${new Date(createdAt).toLocaleString()}`,
    createdAt,
    tabs: toSavedTabs(tabs),
  };
  session.id = await db.sessions.add(session);
  return session;
}

export const listSessions = () => db.sessions.orderBy('createdAt').reverse().toArray();
export const deleteSession = (id: number) => db.sessions.delete(id);

/** Opens every saved tab in a new window. */
export async function restoreSession(id: number): Promise<void> {
  const s = await db.sessions.get(id);
  if (!s || s.tabs.length === 0) return;
  const win = await chrome.windows.create({ url: s.tabs[0]!.url, focused: true });
  const windowId = win?.id;
  if (windowId === undefined) return;
  for (const t of s.tabs.slice(1)) {
    await chrome.tabs.create({ windowId, url: t.url, pinned: t.pinned, active: false });
  }
}
