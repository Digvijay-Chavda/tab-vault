export interface Settings {
  /** Minutes of inactivity before a tab is discarded. 0 disables auto-suspend. */
  idleMinutes: number;
  suspendPinned: boolean;
  suspendAudible: boolean;
  /** Hostnames (and their subdomains) that are never suspended. */
  whitelist: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  idleMinutes: 30,
  suspendPinned: false,
  suspendAudible: false,
  whitelist: [],
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
}
