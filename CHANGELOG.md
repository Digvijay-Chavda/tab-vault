# Changelog

## Unreleased

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
