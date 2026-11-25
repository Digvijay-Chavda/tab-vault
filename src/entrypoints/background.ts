import { forget, getAll, seed, touch } from '../core/activity';
import { shouldSuspend } from '../core/rules';
import { groupWindow } from '../core/grouping-apply';
import { saveSnapshot } from '../core/sessions';
import { getSettings } from '../core/settings';
import { addSuspended } from '../core/stats';

const SWEEP_ALARM = 'tabvault-sweep';
const SNAPSHOT_ALARM = 'tabvault-snapshot';

async function sweep(): Promise<void> {
  const [settings, tabs, activity] = await Promise.all([getSettings(), chrome.tabs.query({}), getAll()]);
  const now = Date.now();
  let count = 0;
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    if (shouldSuspend(tab, activity[String(tab.id)], now, settings)) {
      try {
        await chrome.tabs.discard(tab.id);
        count++;
      } catch {
        // Tab closed between query and discard; ignore.
      }
    }
  }
  await addSuspended(count);
}

// Auto-grouping: coalesce bursts of page loads into one pass per window, one window at a time.
const pendingGroupWindows = new Set<number>();
let groupChain: Promise<unknown> = Promise.resolve();

function scheduleAutoGroup(windowId: number): void {
  if (pendingGroupWindows.has(windowId)) return;
  pendingGroupWindows.add(windowId);
  groupChain = groupChain
    .then(async () => {
      await new Promise((r) => setTimeout(r, 500)); // let a burst of tabs finish loading
      pendingGroupWindows.delete(windowId);
      if ((await getSettings()).autoGroup) await groupWindow(windowId);
    })
    .catch(() => pendingGroupWindows.delete(windowId)); // window closed mid-flight, etc.
}

async function init(): Promise<void> {
  await chrome.alarms.create(SWEEP_ALARM, { periodInMinutes: 1 });
  await chrome.alarms.create(SNAPSHOT_ALARM, { periodInMinutes: 15 });
  const tabs = await chrome.tabs.query({});
  await seed(tabs.flatMap((t) => (t.id === undefined ? [] : [t.id])));
}

export default defineBackground(() => {
  // MV3: every listener must be registered synchronously at top level.
  chrome.runtime.onInstalled.addListener(() => void init());
  chrome.runtime.onStartup.addListener(() => void init());

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SWEEP_ALARM) void sweep();
    if (alarm.name === SNAPSHOT_ALARM) {
      void getSettings().then((s) => (s.autoSnapshots ? saveSnapshot() : undefined));
    }
  });

  chrome.tabs.onActivated.addListener(({ tabId }) => void touch(tabId));
  chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status === 'complete' || info.audible) void touch(tabId);
    // Only page loads trigger grouping; the group change itself fires a groupId update, which is ignored (no loop).
    if (info.status === 'complete' && tab.windowId !== undefined) {
      void getSettings().then((s) => (s.autoGroup ? scheduleAutoGroup(tab.windowId) : undefined));
    }
  });
  chrome.tabs.onRemoved.addListener((tabId) => void forget(tabId));

  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
