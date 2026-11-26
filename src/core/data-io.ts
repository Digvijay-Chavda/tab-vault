import { db } from '../storage/db';
import { buildBackup, parseBackup, type BackupFile } from './backup';
import { getSettings, saveSettings } from './settings';

export async function exportBackup(): Promise<BackupFile> {
  const [settings, sessions, workspaces, stash, notes] = await Promise.all([
    getSettings(), db.sessions.toArray(), db.workspaces.toArray(), db.stash.toArray(), db.notes.toArray(),
  ]);
  return buildBackup(settings, sessions, workspaces, Date.now(), stash, notes);
}

/** Merges (never replaces) a backup into local data. Returns counts for the UI. */
export async function importBackup(text: string): Promise<{ sessions: number; workspaces: number; stash: number; notes: number }> {
  const b = parseBackup(text);
  await db.transaction('rw', [db.sessions, db.workspaces, db.stash, db.notes], async () => {
    await db.sessions.bulkAdd(b.sessions);
    await db.workspaces.bulkAdd(b.workspaces);
    await db.stash.bulkAdd(b.stash);
    await db.notes.bulkPut(b.notes);
  });
  await saveSettings(b.settings);
  return { sessions: b.sessions.length, workspaces: b.workspaces.length, stash: b.stash.length, notes: b.notes.length };
}
