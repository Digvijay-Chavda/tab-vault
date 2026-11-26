import { planGroups } from './grouping';
import { getSettings } from './settings';

export interface GroupResult {
  groups: number;
  tabs: number;
}

/** Applies smart grouping to one window. Safe to call repeatedly (idempotent). */
export async function groupWindow(windowId: number): Promise<GroupResult> {
  if (!chrome.tabGroups) return { groups: 0, tabs: 0 }; // browsers without tab groups
  const [tabs, existing, settings] = await Promise.all([
    chrome.tabs.query({ windowId }),
    chrome.tabGroups.query({ windowId }),
    getSettings(),
  ]);
  const plans = planGroups(tabs, existing, settings);
  let count = 0;
  for (const plan of plans) {
    const tabIds = plan.tabIds as [number, ...number[]];
    if (plan.existingGroupId !== undefined) {
      await chrome.tabs.group({ groupId: plan.existingGroupId, tabIds });
    } else {
      const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
      await chrome.tabGroups.update(groupId, { title: plan.name, color: plan.color });
    }
    count += plan.tabIds.length;
  }
  return { groups: plans.length, tabs: count };
}

/** Removes every tab group in the window (including ones you made by hand). Returns the tab count. */
export async function ungroupWindow(windowId: number): Promise<number> {
  if (!chrome.tabGroups) return 0;
  const tabs = await chrome.tabs.query({ windowId });
  const ids = tabs.flatMap((t) => (t.id !== undefined && t.groupId !== undefined && t.groupId !== -1 ? [t.id] : []));
  if (ids.length) await chrome.tabs.ungroup(ids as [number, ...number[]]);
  return ids.length;
}
