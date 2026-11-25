import Dexie, { type EntityTable } from 'dexie';
import type { Session } from '../core/types';

class TabVaultDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;

  constructor() {
    super('tabvault');
    // Always add a new .version(n) with an upgrade function; never edit an old one.
    this.version(1).stores({ sessions: '++id, createdAt, name' });
  }
}

export const db = new TabVaultDB();
