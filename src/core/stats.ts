import { DEFAULT_STATS, EST_MB_PER_TAB, type Stats } from './types';

const KEY = 'stats';

export async function getStats(): Promise<Stats> {
  const res = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_STATS, ...(res[KEY] as Partial<Stats> | undefined) };
}

export async function addSuspended(n: number): Promise<void> {
  if (n <= 0) return;
  const s = await getStats();
  await chrome.storage.local.set({ [KEY]: { suspendedTotal: s.suspendedTotal + n } });
}

export const estimateMb = (tabs: number) => tabs * EST_MB_PER_TAB;
