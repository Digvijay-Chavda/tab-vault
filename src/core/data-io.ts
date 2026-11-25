import { db } from '../storage/db';
import { buildBackup, parseBackup, type BackupFile } from './backup';
import { getSettings, saveSettings } from './settings';

export async function exportBackup(): Promise<BackupFile> {
  const [settings, sessions, workspaces] = await Promise.all([getSettings(), db.sessions.toArray(), db.workspaces.toArray()]);
  return buildBackup(settings, sessions, workspaces);
}

/** Merges (never replaces) a backup into local data. Returns counts for the UI. */
export async function importBackup(text: string): Promise<{ sessions: number; workspaces: number }> {
  const b = parseBackup(text);
  await db.transaction('rw', db.sessions, db.workspaces, async () => {
    await db.sessions.bulkAdd(b.sessions);
    await db.workspaces.bulkAdd(b.workspaces);
  });
  await saveSettings(b.settings);
  return { sessions: b.sessions.length, workspaces: b.workspaces.length };
}
