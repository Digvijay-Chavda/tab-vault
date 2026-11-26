import { exportBackup } from './data-io';

const KEY = 'lastBackupAt';

/** Pure: is a scheduled backup due? `days` of 0 means never. */
export function backupDue(lastAt: number | undefined, days: number, now: number): boolean {
  if (days <= 0) return false;
  return lastAt === undefined || now - lastAt >= days * 86_400_000;
}

export const getLastBackup = async (): Promise<number | undefined> =>
  (await chrome.storage.local.get(KEY))[KEY] as number | undefined;

function toDataUrl(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:application/json;base64,${btoa(bin)}`;
}

/** Writes a backup file into the browser's download folder (TabVault/ subfolder). */
export async function backupNow(): Promise<string> {
  const now = new Date();
  const filename = `TabVault/tabvault-backup-${now.toISOString().slice(0, 10)}.json`;
  await chrome.downloads.download({ url: toDataUrl(JSON.stringify(await exportBackup(), null, 2)), filename, saveAs: false, conflictAction: 'uniquify' });
  await chrome.storage.local.set({ [KEY]: now.getTime() });
  return filename;
}
