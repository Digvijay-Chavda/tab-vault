import { forget, getAll, seed, touch } from '../core/activity';
import { shouldSuspend } from '../core/rules';
import { getSettings } from '../core/settings';

const SWEEP_ALARM = 'tabvault-sweep';

async function sweep(): Promise<number> {
  const [settings, tabs, activity] = await Promise.all([
    getSettings(),
    chrome.tabs.query({}),
    getAll(),
  ]);
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
  return count;
}

export default defineBackground(() => {
  // MV3: every listener must be registered synchronously at top level.
  chrome.runtime.onInstalled.addListener(async () => {
    await chrome.alarms.create(SWEEP_ALARM, { periodInMinutes: 1 });
    const tabs = await chrome.tabs.query({});
    await seed(tabs.flatMap((t) => (t.id === undefined ? [] : [t.id])));
  });

  chrome.runtime.onStartup.addListener(async () => {
    await chrome.alarms.create(SWEEP_ALARM, { periodInMinutes: 1 });
    const tabs = await chrome.tabs.query({});
    await seed(tabs.flatMap((t) => (t.id === undefined ? [] : [t.id])));
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SWEEP_ALARM) void sweep();
  });

  chrome.tabs.onActivated.addListener(({ tabId }) => void touch(tabId));
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === 'complete' || info.audible) void touch(tabId);
  });
  chrome.tabs.onRemoved.addListener((tabId) => void forget(tabId));

  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
