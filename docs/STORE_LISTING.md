# Chrome Web Store listing (copy/paste)

**Name:** TabVault: Tab & Session Manager
**Category:** Productivity
**Single purpose:** Manage and search browser tabs and sessions (suspend idle tabs, save/restore sessions, workspaces, search).

**Short description (≤132 chars):**
Suspend idle tabs, save sessions, organize workspaces and search everything. Private, local-first, open source.

**Detailed description:**
TabVault keeps a hundred tabs from slowing your browser down.

• Auto-suspend idle tabs to free memory (pinned, audible and whitelisted tabs are protected)
• Smart tab grouping: one click groups tabs by your rules, category or site (optional auto-grouping); your own groups and pinned tabs are never touched
• Workspaces: switch between sets of tabs; your current tabs are always saved first
• Sessions: save a window and restore it later; automatic snapshots every 15 minutes act as a safety net
• Instant fuzzy search across open tabs, saved sessions and workspaces, with keyboard navigation (Ctrl/Cmd+Shift+K opens the panel)
• Find and close duplicate tabs
• Export/import backups

Private by design: no account, no analytics, no servers, no remote code, no access to page content. Everything stays on your device.
Open source (MIT).

**Permission justifications**
- tabs: read tab titles/URLs to list and search them, and to suspend idle tabs.
- tabGroups: create and name tab groups for the smart grouping feature (group titles and colors only).
- storage: save settings, sessions and workspaces locally; settings sync uses the browser's sync.
- alarms: periodic idle check and snapshots (MV3 service workers cannot use timers).

**Privacy policy URL:** link to PRIVACY.md in the repository.

**Assets:** icon 128×128 (public/icon/128.png), screenshots in docs/screenshots (resize/pad to 1280×800 before upload).
