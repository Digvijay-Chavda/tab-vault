# Chrome Web Store listing (copy/paste)

**Name:** TabVault: Tab & Session Manager
**Category:** Productivity
**Single purpose:** Manage and search browser tabs and sessions (suspend idle tabs, save/restore sessions, workspaces, search).

**Short description (≤132 chars):**
Suspend idle tabs, stash tabs for later, save sessions, organize workspaces and search everything. Private and local-first.

**Detailed description:**
TabVault keeps a hundred tabs from slowing your browser down.

• Auto-suspend idle tabs to free memory (pinned, audible and whitelisted tabs are protected), plus a Panic button that suspends everything except the active tab
• Smart tab grouping: one click groups tabs by your rules, category or site (optional auto-grouping); your own groups and pinned tabs are never touched
• Workspaces: switch between sets of tabs (your current tabs are always saved first) and optionally open one automatically at a set time
• Sessions: save a window, with its tab groups, and restore it later; automatic snapshots every 15 minutes act as a safety net
• Stash: park a tab for later and close it in one click; add notes and #tags to any page
• Instant fuzzy search across open tabs, sessions, workspaces, the stash and your notes, with keyboard navigation and a command palette (Ctrl/Cmd+K inside the popup; Ctrl/Cmd+Shift+K opens TabVault)
• Select several tabs to stash, group, save or close them together; sort tabs, merge windows, move a tab to another window
• Find and close duplicate tabs, with a badge on the icon that counts them
• Recently closed tabs and windows, one click to reopen
• Insights: top sites and the tabs you have left alone the longest; optional archive of tabs you have not opened for weeks
• Light, dark or system theme, compact density
• Export/import backups, or an automatic backup file every few days

Private by design: no account, no analytics, no servers, no remote code, no access to page content. Everything stays on your device.
Open source (MIT).

**Permission justifications**
- tabs: read tab titles/URLs to list and search them, and to suspend idle tabs.
- tabGroups: create and name tab groups for the smart grouping feature (group titles and colors only).
- storage: save settings, sessions and workspaces locally; settings sync uses the browser's sync.
- sessions: list recently closed tabs/windows and reopen them (read from the browser's own list; nothing is stored or sent).
- downloads: save a backup file to the user's Downloads folder when they ask (or on their schedule); nothing is uploaded.
- alarms: periodic idle check and snapshots (MV3 service workers cannot use timers).

**Privacy policy URL:** link to PRIVACY.md in the repository.

**Assets:** icon 128×128 (public/icon/128.png), screenshots in docs/screenshots (resize/pad to 1280×800 before upload).
