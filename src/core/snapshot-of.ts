import { db } from '../storage/db';
import { groupInfo, pruneIds, toSavedTabs } from './sessions';

/** Persists the given tabs as an auto snapshot with a custom name. */
export async function saveSnapshotOf(tabs: chrome.tabs.Tab[], name: string): Promise<void> {
  const saved = toSavedTabs(tabs, await groupInfo());
  if (saved.length === 0) return;
  await db.sessions.add({ name, createdAt: Date.now(), tabs: saved, kind: 'auto' });
  const stale = pruneIds(await db.sessions.where('kind').equals('auto').toArray());
  if (stale.length) await db.sessions.bulkDelete(stale);
}
