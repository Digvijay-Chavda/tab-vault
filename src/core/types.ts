export interface Settings {
  /** Minutes of inactivity before a tab is discarded. 0 disables auto-suspend. */
  idleMinutes: number;
  suspendPinned: boolean;
  suspendAudible: boolean;
  /** Hostnames (and their subdomains) that are never suspended. */
  whitelist: string[];
  /** Automatically snapshot all open tabs every 15 minutes (keeps the latest 10). */
  autoSnapshots: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  idleMinutes: 30,
  suspendPinned: false,
  suspendAudible: false,
  whitelist: [],
  autoSnapshots: true,
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
}

export interface SavedTab {
  url: string;
  title: string;
  favIconUrl?: string;
  pinned?: boolean;
}

export interface Session {
  id?: number;
  name: string;
  createdAt: number;
  tabs: SavedTab[];
  /** 'auto' sessions are periodic snapshots and are pruned automatically. */
  kind?: 'manual' | 'auto';
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
