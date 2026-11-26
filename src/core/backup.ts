import { sanitizeSettings } from './settings-schema';
import { sanitizeNote } from './notes';
import type { NoteEntry, SavedTab, Session, Settings, StashItem, Workspace } from './types';

export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: 'tabvault';
  version: number;
  exportedAt: number;
  settings: Settings;
  sessions: Session[];
  workspaces: Workspace[];
  stash: StashItem[];
  notes: NoteEntry[];
}

export function buildBackup(
  settings: Settings, sessions: Session[], workspaces: Workspace[], now = Date.now(), stash: StashItem[] = [], notes: NoteEntry[] = [],
): BackupFile {
  return { app: 'tabvault', version: BACKUP_VERSION, exportedAt: now, settings, sessions, workspaces, stash, notes };
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

const COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

function cleanGroup(raw: unknown): { group?: { title: string; color: string } } {
  const g = raw as { title?: unknown; color?: unknown } | null;
  if (!g || typeof g !== 'object') return {};
  const title = typeof g.title === 'string' ? g.title.trim().slice(0, 30) : '';
  const color = typeof g.color === 'string' && COLORS.includes(g.color) ? g.color : 'grey';
  return { group: { title, color } };
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
      ...cleanGroup((t as { group?: unknown }).group),
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
        kind: (['auto', 'archive'] as const).find((k) => k === (s as Session)?.kind) ?? ('manual' as const),
      }))
      .filter((s) => s.tabs.length > 0),
    workspaces: (Array.isArray(r.workspaces) ? r.workspaces : [])
      .map((w) => ({
        name: str((w as Workspace)?.name, 'Imported workspace'),
        createdAt: ts((w as Workspace)?.createdAt, now),
        updatedAt: ts((w as Workspace)?.updatedAt, now),
        tabs: cleanTabs((w as Workspace)?.tabs),
      })),
    stash: (Array.isArray(r.stash) ? r.stash : []).flatMap((x) => {
      const url = safeUrl((x as StashItem)?.url);
      const title = (x as StashItem)?.title;
      return url ? [{ url, title: typeof title === 'string' && title ? title.slice(0, 300) : url, favIconUrl: safeUrl((x as StashItem)?.favIconUrl) ?? undefined, createdAt: ts((x as StashItem)?.createdAt, now) }] : [];
    }),
    notes: (Array.isArray(r.notes) ? r.notes : []).flatMap((n) => {
      const e = sanitizeNote(n);
      return e ? [e] : [];
    }),
  };
}
