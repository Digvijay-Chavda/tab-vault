import { db } from '../storage/db';
import { noteKey, parseTags, sanitizeNote } from './notes';
import type { NoteEntry } from './types';

export async function getNotes(): Promise<Map<string, NoteEntry>> {
  return new Map((await db.notes.toArray()).map((n) => [n.key, n]));
}

/** Saves a note/tags for an address; saving empty text and no tags removes the entry. */
export async function setNote(url: string, note: string, tagsText: string): Promise<void> {
  const key = noteKey(url);
  const entry = sanitizeNote({ key, note, tags: parseTags(tagsText), updatedAt: Date.now() });
  if (entry) await db.notes.put(entry);
  else await db.notes.delete(key);
}
