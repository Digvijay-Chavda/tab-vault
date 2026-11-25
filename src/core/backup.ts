import { sanitizeSettings } from './settings-schema';
import type { SavedTab, Session, Settings, Workspace } from './types';

export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: 'tabvault';
  version: number;
  exportedAt: number;
  settings: Settings;
  sessions: Session[];
  workspaces: Workspace[];
}

export function buildBackup(settings: Settings, sessions: Session[], workspaces: Workspace[], now = Date.now()): BackupFile {
  return { app: 'tabvault', version: BACKUP_VERSION, exportedAt: now, settings, sessions, workspaces };
}

function safeUrl(u: unknown): string | null {
  if (typeof u !== 'string') return null;
  try {
    const p = new URL(u).protocol;
    return p === 'http:' || p === 'https:' ? u : null; // never import javascript:, data:, file: ...
  } catch {
    return null;
  }
}

function cleanTabs(raw: unknown): SavedTab[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedTab[] = [];
  for (const t of raw) {
    const url = safeUrl((t as { url?: unknown })?.url);
    if (!url) continue;
    const title = (t as { title?: unknown }).title;
    out.push({
      url,
      title: typeof title === 'string' && title ? title.slice(0, 300) : url,
      favIconUrl: safeUrl((t as { favIconUrl?: unknown }).favIconUrl) ?? undefined,
      pinned: (t as { pinned?: unknown }).pinned === true,
    });
  }
  return out;
}

const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : fallback);
const ts = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Parses and validates untrusted backup JSON. Throws a readable Error when it is not a TabVault backup. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  const r = raw as Partial<BackupFile> | null;
  if (!r || r.app !== 'tabvault') throw new Error('This is not a TabVault backup file.');
  if (typeof r.version !== 'number' || r.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of TabVault.');
  }
  const now = Date.now();
  return {
    app: 'tabvault',
    version: BACKUP_VERSION,
    exportedAt: ts(r.exportedAt, now),
    settings: sanitizeSettings(r.settings),
    sessions: (Array.isArray(r.sessions) ? r.sessions : [])
      .map((s) => ({
        name: str((s as Session)?.name, 'Imported session'),
        createdAt: ts((s as Session)?.createdAt, now),
        tabs: cleanTabs((s as Session)?.tabs),
        kind: (s as Session)?.kind === 'auto' ? ('auto' as const) : ('manual' as const),
      }))
      .filter((s) => s.tabs.length > 0),
    workspaces: (Array.isArray(r.workspaces) ? r.workspaces : [])
      .map((w) => ({
        name: str((w as Workspace)?.name, 'Imported workspace'),
        createdAt: ts((w as Workspace)?.createdAt, now),
        updatedAt: ts((w as Workspace)?.updatedAt, now),
        tabs: cleanTabs((w as Workspace)?.tabs),
      })),
  };
}
