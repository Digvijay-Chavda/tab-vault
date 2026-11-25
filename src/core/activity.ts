// The MV3 service worker is killed after ~30s idle, so activity timestamps
// live in chrome.storage.session, never in module-level variables.
const KEY = 'lastActive';

type ActivityMap = Record<string, number>;

async function load(): Promise<ActivityMap> {
  const res = await chrome.storage.session.get(KEY);
  return (res[KEY] as ActivityMap | undefined) ?? {};
}

export async function touch(tabId: number, at = Date.now()): Promise<void> {
  const map = await load();
  map[String(tabId)] = at;
  await chrome.storage.session.set({ [KEY]: map });
}

export async function forget(tabId: number): Promise<void> {
  const map = await load();
  delete map[String(tabId)];
  await chrome.storage.session.set({ [KEY]: map });
}

export async function getAll(): Promise<ActivityMap> {
  return load();
}

/** Seed unknown tabs as "active now" so a browser/worker restart never mass-suspends. */
export async function seed(tabIds: number[], at = Date.now()): Promise<void> {
  const map = await load();
  let changed = false;
  for (const id of tabIds) {
    if (map[String(id)] === undefined) {
      map[String(id)] = at;
      changed = true;
    }
  }
  if (changed) await chrome.storage.session.set({ [KEY]: map });
}
