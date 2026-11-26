import Dexie, { type EntityTable } from 'dexie';
import type { NoteEntry, Session, StashItem, Workspace } from '../core/types';

class TabVaultDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  workspaces!: EntityTable<Workspace, 'id'>;
  stash!: EntityTable<StashItem, 'id'>;
  notes!: EntityTable<NoteEntry, 'key'>;

  constructor() {
    super('tabvault');
    // Never edit an existing .version(n); add a new one (with .upgrade if data must change).
    this.version(1).stores({ sessions: '++id, createdAt, name' });
    this.version(2).stores({ sessions: '++id, createdAt, name, kind', workspaces: '++id, name, updatedAt' });
    this.version(3).stores({ stash: '++id, createdAt, url', notes: 'key, updatedAt' });
  }
}

export const db = new TabVaultDB();
