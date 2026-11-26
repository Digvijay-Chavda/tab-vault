import { db } from '../storage/db';
import { isSuspendableUrl } from './rules';
import type { SavedGroup, SavedTab, Session } from './types';

export const MAX_AUTO_SNAPSHOTS = 10;

/** Group id -> title/color for every tab group (empty where the browser has no tab groups). */
export async function groupInfo(): Promise<Map<number, SavedGroup>> {
  if (!chrome.tabGroups) return new Map();
  try {
    return new Map((await chrome.tabGroups.query({})).map((g) => [g.id, { title: g.title ?? '', color: g.color }]));
  } catch {
    return new Map();
  }
}

export function toSavedTabs(tabs: chrome.tabs.Tab[], groups: Map<number, SavedGroup> = new Map()): SavedTab[] {
  return tabs
    .filter((t) => isSuspendableUrl(t.url))
    .map((t) => {
      const group = t.groupId !== undefined && t.groupId !== -1 ? groups.get(t.groupId) : undefined;
      return { url: t.url!, title: t.title ?? t.url!, favIconUrl: t.favIconUrl, pinned: t.pinned, ...(group ? { group } : {}) };
    });
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
    tabs: toSavedTabs(tabs, await groupInfo()),
    kind: 'manual',
  };
  session.id = await db.sessions.add(session);
  return session;
}

/** Saves every open tab (all windows) as an auto snapshot unless nothing changed since the last one. */
export async function saveSnapshot(): Promise<boolean> {
  const tabs = toSavedTabs(await chrome.tabs.query({}), await groupInfo());
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

export async function renameSession(id: number, name: string): Promise<void> {
  const n = name.trim().slice(0, 120);
  if (n) await db.sessions.update(id, { name: n });
}

/** Saves tabs as a named session. 'archive' sessions are never pruned automatically. */
export async function saveTabsAsSession(tabs: chrome.tabs.Tab[], name: string, kind: 'manual' | 'archive' = 'manual'): Promise<number> {
  const saved = toSavedTabs(tabs, await groupInfo());
  if (saved.length === 0) return 0;
  await db.sessions.add({ name, createdAt: Date.now(), tabs: saved, kind });
  return saved.length;
}

export const saveArchive = (tabs: chrome.tabs.Tab[], name: string) => saveTabsAsSession(tabs, name, 'archive');

/** Opens every saved tab in a new window. */
export async function restoreSession(id: number): Promise<void> {
  const s = await db.sessions.get(id);
  if (!s || s.tabs.length === 0) return;
  const win = await chrome.windows.create({ url: s.tabs[0]!.url, focused: true });
  const windowId = win?.id;
  if (windowId === undefined) return;
  const created: Array<{ tabId: number | undefined; group?: SavedGroup }> = [{ tabId: win?.tabs?.[0]?.id, group: s.tabs[0]!.group }];
  if (s.tabs[0]!.pinned && created[0]!.tabId !== undefined) await chrome.tabs.update(created[0]!.tabId, { pinned: true });
  for (const t of s.tabs.slice(1)) {
    const tab = await chrome.tabs.create({ windowId, url: t.url, pinned: t.pinned, active: false });
    created.push({ tabId: tab.id, group: t.group });
  }
  await regroup(windowId, created);
}

const GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

/** Puts restored tabs back into tab groups (same title and color). Silently does nothing where groups are unsupported. */
export async function regroup(windowId: number, created: Array<{ tabId: number | undefined; group?: SavedGroup }>): Promise<void> {
  if (!chrome.tabGroups) return;
  const buckets = new Map<string, { group: SavedGroup; ids: number[] }>();
  for (const c of created) {
    if (c.tabId === undefined || !c.group) continue;
    const key = `${c.group.title}\u0000${c.group.color}`;
    const b = buckets.get(key) ?? { group: c.group, ids: [] };
    b.ids.push(c.tabId);
    buckets.set(key, b);
  }
  for (const { group, ids } of buckets.values()) {
    try {
      const groupId = await chrome.tabs.group({ tabIds: ids as [number, ...number[]], createProperties: { windowId } });
      await chrome.tabGroups.update(groupId, {
        title: group.title,
        color: GROUP_COLORS.includes(group.color) ? (group.color as chrome.tabGroups.Color) : 'grey',
      });
    } catch {
      // A tab closed mid-restore; the rest still come back.
    }
  }
}
