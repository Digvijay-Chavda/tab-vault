export type DupeAction = 'badge' | 'switch';
export type Theme = 'system' | 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

export interface Settings {
  /** Minutes of inactivity before a tab is discarded. 0 disables auto-suspend. */
  idleMinutes: number;
  suspendPinned: boolean;
  suspendAudible: boolean;
  /** Hostnames (and their subdomains) that are never suspended. */
  whitelist: string[];
  /** Automatically snapshot all open tabs every 15 minutes (keeps the latest 10). */
  autoSnapshots: boolean;
  /** Automatically put newly loaded tabs into smart groups (off by default). */
  autoGroup: boolean;
  /** A site-based group is only created when at least this many tabs share it. */
  minGroupSize: number;
  /** Show the number of duplicate tabs as a badge on the toolbar icon. */
  warnDuplicates: boolean;
  /** What to do when a page you open is already open in the same window. */
  dupeAction: DupeAction;
  /** Save and close tabs not opened for this many days into an archive session. 0 turns it off. */
  archiveDays: number;
  /** Download a backup file every this many days. 0 turns it off. */
  backupDays: number;
  theme: Theme;
  density: Density;
  /** User rules that name the group for a site; they win over built-in categories. */
  groupRules: GroupRule[];
}

export interface GroupRule {
  /** Hostname; subdomains match too. */
  host: string;
  /** Group title. */
  name: string;
}

export const DEFAULT_SETTINGS: Settings = {
  idleMinutes: 30,
  suspendPinned: false,
  suspendAudible: false,
  whitelist: [],
  autoSnapshots: true,
  autoGroup: false,
  minGroupSize: 2,
  warnDuplicates: true,
  dupeAction: 'badge',
  archiveDays: 0,
  backupDays: 0,
  theme: 'system',
  density: 'comfortable',
  groupRules: [],
};

/** Minimal tab shape the rules engine needs; keeps logic testable without chrome.*. */
export interface TabLike {
  id?: number;
  url?: string;
  title?: string;
  active?: boolean;
  pinned?: boolean;
  audible?: boolean;
  discarded?: boolean;
  windowId?: number;
  index?: number;
  /** -1 (TAB_GROUP_ID_NONE) or undefined means the tab is not in a group. */
  groupId?: number;
  /** Epoch ms of the last time the tab was in the foreground (Chrome 121+). */
  lastAccessed?: number;
}

/** A tab parked in the stash (read-later list). */
export interface StashItem {
  id?: number;
  url: string;
  title: string;
  favIconUrl?: string;
  createdAt: number;
}

/** A note and tags attached to an address (shared by every tab with that address). */
export interface NoteEntry {
  key: string;
  note: string;
  tags: string[];
  updatedAt: number;
}

export interface SavedTab {
  url: string;
  title: string;
  favIconUrl?: string;
  pinned?: boolean;
  /** Tab group this tab belonged to when it was saved. */
  group?: SavedGroup;
}

export interface SavedGroup {
  title: string;
  color: string;
}

export interface Session {
  id?: number;
  name: string;
  createdAt: number;
  tabs: SavedTab[];
  /** 'auto' sessions are periodic snapshots and are pruned automatically. */
  kind?: 'manual' | 'auto' | 'archive';
}

export interface Workspace {
  id?: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  tabs: SavedTab[];
}

export interface Stats {
  /** Lifetime number of tabs TabVault has suspended. */
  suspendedTotal: number;
}

export const DEFAULT_STATS: Stats = { suspendedTotal: 0 };

/** Rough per-tab memory estimate (MB) used only for the friendly counter in the UI. */
export const EST_MB_PER_TAB = 50;
