import { db } from '../storage/db';
import { isSuspendableUrl } from './rules';
import type { SavedTab, Session } from './types';

export const MAX_AUTO_SNAPSHOTS = 10;

export function toSavedTabs(tabs: chrome.tabs.Tab[]): SavedTab[] {
  return tabs
    .filter((t) => isSuspendableUrl(t.url))
    .map((t) => ({ url: t.url!, title: t.title ?? t.url!, favIconUrl: t.favIconUrl, pinned: t.pinned }));
}

/** Pure: which auto-snapshot ids should be deleted so only the newest `keep` remain. */
export function pruneIds(sessions: Pick<Session, 'id' | 'createdAt' | 'kind'>[], keep = MAX_AUTO_SNAPSHOTS): number[] {
  return sessions
    .filter((s) => s.kind === 'auto' && s.id !== undefined)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(keep)
    .map((s) => s.id!);
}

export async function saveCurrentWindow(name?: string): Promise<Session> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const createdAt = Date.now();
  const session: Session = {
    name: name?.trim() || `Session ${new Date(createdAt).toLocaleString()}`,
    createdAt,
    tabs: toSavedTabs(tabs),
    kind: 'manual',
  };
  session.id = await db.sessions.add(session);
  return session;
}

/** Saves every open tab (all windows) as an auto snapshot unless nothing changed since the last one. */
export async function saveSnapshot(): Promise<boolean> {
  const tabs = toSavedTabs(await chrome.tabs.query({}));
  if (tabs.length === 0) return false;
  const signature = tabs.map((t) => t.url).sort().join('\n');
  const last = (await db.sessions.where('kind').equals('auto').reverse().sortBy('createdAt'))[0];
  if (last && last.tabs.map((t) => t.url).sort().join('\n') === signature) return false;
  const createdAt = Date.now();
  await db.sessions.add({ name: `Auto snapshot ${new Date(createdAt).toLocaleString()}`, createdAt, tabs, kind: 'auto' });
  const all = await db.sessions.where('kind').equals('auto').toArray();
  const stale = pruneIds(all);
  if (stale.length) await db.sessions.bulkDelete(stale);
  return true;
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
