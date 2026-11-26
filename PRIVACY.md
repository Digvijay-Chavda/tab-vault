# TabVault privacy policy

_Last updated: 2026-11-26 (v1.3.0)_

TabVault does not collect, transmit, sell or share any data. It has no server, no accounts, no analytics and no remote code.

## What TabVault stores, and where

| Data | Where | Why |
|---|---|---|
| Settings (idle time, whitelist, grouping rules, toggles) | `chrome.storage.local`, and `chrome.storage.sync` | So your preferences persist. `storage.sync` is your browser's own sync service (e.g. your Google account); TabVault never sees or controls it. |
| Saved sessions, workspaces, automatic snapshots, archived and stashed tabs (titles, URLs, favicon URLs, tab group names and colors) | IndexedDB on your device | Restore and search. |
| Notes and tags you add to pages | IndexedDB on your device | Find pages again. |
| Workspace schedules and the time of the last backup | `chrome.storage.local` | Open workspaces on time and run scheduled backups. |
| Per-tab "last active" timestamps | `chrome.storage.session` (memory only, cleared when the browser closes) | Decide which tabs are idle. |
| A counter of how many tabs were suspended | `chrome.storage.local` | Shown in the popup footer. |

## Permissions

- `tabs`: read tab titles and URLs and suspend (discard) tabs.
- `tabGroups`: create and name tab groups (smart grouping). Grouping decisions are made on your device from tab URLs and your own rules; nothing is sent anywhere.
- `storage`: save the data above.
- `sessions`: list your recently closed tabs and windows so you can reopen them. This reads the browser's own list on your device; nothing is stored or sent.
- `downloads`: write a backup file to your Downloads folder when you press "Back up now" or turn on scheduled backups. Files are created locally and never uploaded.
- `alarms`: wake the background worker once a minute to check for idle tabs and every 15 minutes for snapshots.

TabVault requests **no host permissions** and never reads page content.

## Your control

Delete any session or workspace in the panel. Remove all data by uninstalling the extension. Export your data at any time from the settings page; the file is created locally and never uploaded.

## Contact

Open an issue on the project's GitHub repository.
