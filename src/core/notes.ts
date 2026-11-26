import { dedupeKey } from './duplicates';
import type { NoteEntry } from './types';

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 24;
export const MAX_NOTE_LENGTH = 500;

/** "Read later, client-X  urgent" -> ['read', 'later', 'client-x', 'urgent']. Lowercase, unique, bounded. */
export function parseTags(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\s,;#]+/)) {
    const t = raw.toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, MAX_TAG_LENGTH);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export const formatTags = (tags: string[]) => tags.map((t) => `#${t}`).join(' ');

export function sanitizeNote(raw: unknown): NoteEntry | null {
  const r = raw as Partial<NoteEntry> | null;
  if (!r || typeof r.key !== 'string' || !r.key) return null;
  const note = typeof r.note === 'string' ? r.note.trim().slice(0, MAX_NOTE_LENGTH) : '';
  const tags = Array.isArray(r.tags) ? parseTags(r.tags.filter((x): x is string => typeof x === 'string').join(' ')) : [];
  if (!note && tags.length === 0) return null;
  return { key: r.key.slice(0, 2000), note, tags, updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Date.now() };
}

export const noteKey = (url: string) => dedupeKey(url);
