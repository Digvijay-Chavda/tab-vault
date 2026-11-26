import { db } from '../storage/db';
import { saveSnapshotOf } from './snapshot-of';
import { groupInfo, regroup, toSavedTabs } from './sessions';
import type { Workspace } from './types';

const ACTIVE_KEY = 'activeWorkspaces'; // windowId -> workspaceId, in storage.session (window ids are per browser run)

type ActiveMap = Record<string, number>;

async function activeMap(): Promise<ActiveMap> {
  const res = await chrome.storage.session.get(ACTIVE_KEY);
  return (res[ACTIVE_KEY] as ActiveMap | undefined) ?? {};
}

export async function getActiveWorkspaceId(windowId: number): Promise<number | undefined> {
  return (await activeMap())[String(windowId)];
}

async function setActive(windowId: number, id: number): Promise<void> {
  const map = await activeMap();
  map[String(windowId)] = id;
  await chrome.storage.session.set({ [ACTIVE_KEY]: map });
}

export const listWorkspaces = () => db.workspaces.orderBy('name').toArray();

export async function createWorkspace(name: string, fromWindowId?: number): Promise<Workspace> {
  const now = Date.now();
  const tabs = fromWindowId === undefined ? [] : toSavedTabs(await chrome.tabs.query({ windowId: fromWindowId }), await groupInfo());
  const ws: Workspace = { name: name.trim().slice(0, 60) || 'Workspace', createdAt: now, updatedAt: now, tabs };
  const id = (await db.workspaces.add(ws)) as number;
  ws.id = id;
  if (fromWindowId !== undefined) await setActive(fromWindowId, id);
  return ws;
}

export const deleteWorkspace = (id: number) => db.workspaces.delete(id);

export async function renameWorkspace(id: number, name: string): Promise<void> {
  await db.workspaces.update(id, { name: name.trim().slice(0, 60) || 'Workspace', updatedAt: Date.now() });
}

/** Overwrites the workspace's saved tabs with what is open in the window right now. */
export async function updateWorkspaceFromWindow(id: number, windowId: number): Promise<void> {
  const tabs = toSavedTabs(await chrome.tabs.query({ windowId }), await groupInfo());
  await db.workspaces.update(id, { tabs, updatedAt: Date.now() });
}

/**
 * Switch a window to another workspace.
 * Safety first: the outgoing tabs are always persisted before anything is closed
 * (into the old workspace if there is one, otherwise into an auto snapshot).
 */
export async function switchWorkspace(windowId: number, targetId: number): Promise<void> {
  const target = await db.workspaces.get(targetId);
  if (!target) return;
  const currentId = await getActiveWorkspaceId(windowId);
  if (currentId === targetId) return;

  const oldTabs = await chrome.tabs.query({ windowId });
  if (currentId !== undefined && (await db.workspaces.get(currentId))) {
    await updateWorkspaceFromWindow(currentId, windowId);
  } else {
    await saveSnapshotOf(oldTabs, `Before switching to ${target.name}`);
  }

  // Open the new tabs first so the window never closes, then remove the old ones.
  const created: chrome.tabs.Tab[] = [];
  if (target.tabs.length === 0) {
    created.push(await chrome.tabs.create({ windowId, active: true }));
  } else {
    for (let i = 0; i < target.tabs.length; i++) {
      const t = target.tabs[i]!;
      created.push(await chrome.tabs.create({ windowId, url: t.url, pinned: t.pinned, active: i === 0 }));
    }
    await regroup(windowId, created.map((tab, i) => ({ tabId: tab.id, group: target.tabs[i]!.group })));
  }
  const oldIds = oldTabs.flatMap((t) => (t.id === undefined ? [] : [t.id]));
  if (oldIds.length) await chrome.tabs.remove(oldIds);
  // Don't let a large workspace load everything at once.
  for (const t of created.slice(1)) {
    if (t.id !== undefined) await chrome.tabs.discard(t.id).catch(() => undefined);
  }
  await setActive(windowId, targetId);
}

/** Opens a workspace's tabs in a new window without touching the current one (used by schedules). */
export async function openWorkspaceInNewWindow(id: number): Promise<boolean> {
  const ws = await db.workspaces.get(id);
  if (!ws || ws.tabs.length === 0) return false;
  const win = await chrome.windows.create({ url: ws.tabs[0]!.url, focused: true });
  if (win?.id === undefined) return false;
  const created: Array<{ tabId: number | undefined; group?: (typeof ws.tabs)[number]['group'] }> = [{ tabId: win.tabs?.[0]?.id, group: ws.tabs[0]!.group }];
  for (const t of ws.tabs.slice(1)) {
    const tab = await chrome.tabs.create({ windowId: win.id, url: t.url, pinned: t.pinned, active: false });
    created.push({ tabId: tab.id, group: t.group });
  }
  await regroup(win.id, created);
  return true;
}
