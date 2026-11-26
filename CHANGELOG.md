# Changelog

## 1.3.1

- Documentation and screenshots brought up to date with 1.3.0: README (removed the outdated "tab groups are not saved" limitation, corrected the size, refreshed the architecture tree), the Web Store listing text and the privacy policy.
- Fresh screenshots of every view (Tabs, Stash, Command palette, Workspaces, Sessions, Closed, Insights) and the full Settings page, without stale toast messages.
- Added `.claude/` project notes for AI assistants (current state, architecture, conventions, roadmap, `/verify` and `/release` commands).
- No change to extension behavior or permissions.

## 1.3.0

- **Stash.** Save a tab for later and close it in one click (Alt+Shift+S). A new Stash view lists them; click to reopen.
- **Notes and tags** on any page, searchable (`#work`) and shown on tabs, the stash and saved results.
- **Command palette** (Ctrl/Cmd+K, or type `>`): run any action by name. A shortcut list is one `?` away.
- **Multi-select** with Ctrl/Cmd-click and Shift-click, then stash, group, save as a session or close.
- **Sort tabs** by title, site or recent use (pinned tabs and groups keep their place), **merge windows**, and **move a tab to another window**.
- **Panic** button (Alt+Shift+P): suspend every tab except the active one in each window.
- **Tab groups are now saved** in sessions, workspaces and snapshots and come back when restored.
- **Scheduled workspaces:** open a workspace at a set time on chosen days, in a new window.
- **Archive stale tabs** (opt-in): tabs unopened for N days are saved into an Archive session and closed.
- **Insights** view: counts, top sites and the tabs left alone longest.
- **Duplicates:** opt in to switching to the existing tab instead of opening a copy.
- **Rename** workspaces and sessions; **never suspend this site** from the tab menu or palette.
- **Appearance:** light, dark or system theme and a compact density in Settings.
- **Scheduled backups** to your Downloads folder, plus a "Back up now" button. Backups now include the stash and notes. Adds the `downloads` permission.
- Experimental Firefox (MV3) build via `npm run build:firefox`; untested in Firefox itself.

## 1.2.0

- **Recently closed tabs.** A new **Closed** view lists tabs and windows you closed lately; click one to reopen it. Adds the `sessions` permission, which only reads the browser's own list on your device.
- **Duplicate tab warning.** The toolbar icon shows a badge with how many tabs repeat another tab's address in the same window. Turn it off under Settings > Duplicate tabs.
- **Toolbar popup replaces the side panel.** Clicking the TabVault icon (or Ctrl/Cmd+Shift+K) opens a compact popup; nothing docks beside your page any more. The `sidePanel` permission is gone, so the extension asks for less.
- Redesigned UI: brand header with search icon, tab counts on every view, icon buttons, pills for active / suspended / pinned / playing / muted / duplicate tabs, themed light and dark.
- Tab filters: All, Suspended, Playing, Pinned, Duplicates, each with a live count.
- Per-tab quick actions on hover: pin, mute / unmute, suspend, close.
- The popup remembers your last view and filter, keeps scroll position on refresh, and closes itself after you jump to a tab, switch workspace or restore a session.
- "Suspend idle now" reports how many tabs it suspended.

## 1.1.1

- Fixed: text typed in the "New workspace name" box could be wiped when a tab changed in the background. The side panel no longer rebuilds the Workspaces and Sessions views on tab events, and keeps your draft.
- CI now runs on `master` as well as `main`.

## 1.1.0

- **Smart tab grouping.** One click (or automatically, opt-in) groups a window's tabs into native browser tab groups, by your own rules first, then built-in categories (Dev, Docs, Mail, Social, Video, Shopping, News, AI...), then by site.
  - Never touches pinned tabs, tabs already in a group, or browser pages; joins an existing group with the same name.
  - Settings: auto-group new tabs (off by default), minimum tabs per site group, custom `site = group name` rules.
  - Side panel: **Group tabs** / **Ungroup all** buttons and group chips on each tab.
- New permission: `tabGroups` (group names and colors only; no extra install warning).

## 1.0.0

First public release.

- Auto-suspend idle tabs (configurable idle time, whitelist, pinned/audible opt-in)
- Workspaces: named tab sets; switching always saves your current tabs first
- Sessions: save and restore windows; automatic snapshots every 15 minutes (latest 10 kept)
- Instant fuzzy search across open tabs, sessions and workspaces, with keyboard navigation
- Duplicate tab finder
- Backup: export/import sessions, workspaces and settings (imports are validated; non-http(s) URLs are dropped)
- Settings sync via the browser's own sync
- Chrome and Brave (Manifest V3), side panel UI, light/dark themes
