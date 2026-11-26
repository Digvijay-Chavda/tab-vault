<div align="center">

<img src="public/icon/128.png" width="96" alt="TabVault logo" />

# TabVault

**Fast, private tab and session manager for Chrome and Brave.**
Suspend idle tabs, switch workspaces, restore sessions, and search everything you have open or saved.

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)
![Manifest V3](https://img.shields.io/badge/manifest-v3-4f46e5)

</div>

<p align="center">
  <img src="docs/screenshots/tabs.png" width="23%" alt="Tabs view" />
  <img src="docs/screenshots/workspaces.png" width="23%" alt="Workspaces view" />
  <img src="docs/screenshots/sessions.png" width="23%" alt="Sessions view" />
</p>

## Why TabVault

- **Local-first and private.** No account, no server, no analytics, no remote code. It never reads page content and asks for **no host permissions**.
- **Safe by default.** Switching workspaces always saves your current tabs first; automatic snapshots every 15 minutes are your undo button.
- **Fast.** Native `tabs.discard` suspending, a tiny bundle (~125 KB), and typo-tolerant search over thousands of tabs.
- **Open source** (MIT) and tested: unit tests plus an end-to-end test that drives the real extension in Chromium.

## Features

| | |
|---|---|
| **Auto-suspend** | Discards tabs idle for N minutes (default 30). Skips the active tab, pinned and audible tabs (both opt-in), browser pages and a site whitelist. |
| **Smart grouping** | One click (or automatic, opt-in) groups tabs into native tab groups: your rules first, then categories (Dev, Mail, Video…), then by site. Pinned and already-grouped tabs are never touched. Runs entirely on-device, no AI service. |
| **Workspaces** | Named tab sets. Click to switch; the outgoing tabs are saved into the old workspace (or an auto snapshot) before anything is closed. |
| **Sessions** | Save a window and restore it later. Automatic snapshots (latest 10 kept) protect against crashes and accidents. |
| **Tab list** | Filter open tabs (Suspended, Playing, Pinned, Duplicates) and pin, mute, suspend or close any tab from its row. Status labels show what each tab is doing. The popup remembers your last view. |
| **Search** | Fuzzy search across open tabs, sessions and workspaces with ↑ ↓ Enter navigation. |
| **Duplicates** | The toolbar icon shows a badge with the number of duplicate tabs (turn it off in settings). One click closes tabs whose URL is already open in the same window. |
| **Recently closed** | The Closed tab lists tabs and windows you closed lately; click to reopen them. |
| **Backup** | Export/import sessions, workspaces and settings as JSON. Imports are validated and only http(s) URLs are accepted. |
| **Sync** | Settings follow you via your browser's own sync (`chrome.storage.sync`), if enabled. |
| **Theming and a11y** | Light/dark, keyboard friendly, ARIA roles. |

Shortcut: **Ctrl/Cmd + Shift + K** opens the TabVault popup.

## Install

**From a release (works in Chrome and Brave):**
1. Download `tabvault-*-chrome.zip` from the [Releases](../../releases) page and unzip it.
2. Open `chrome://extensions` (or `brave://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**From source:**

```bash
git clone https://github.com/Digvijay-Chavda/tab-vault && cd tab-vault
npm install
npm run build        # output in .output/chrome-mv3
```

Chrome Web Store listing text and permission justifications are in [docs/STORE_LISTING.md](docs/STORE_LISTING.md).

## Permissions

| Permission | Why |
|---|---|
| `tabs` | Read tab titles/URLs for the list and search; suspend idle tabs |
| `tabGroups` | Create and name tab groups for smart grouping (group titles and colors only) |
| `storage` | Save settings locally (and via browser sync) |
| `sessions` | List recently closed tabs/windows so you can reopen them |
| `alarms` | Idle check every minute, snapshots every 15 minutes (MV3 workers can't use timers) |

Read the full [privacy policy](PRIVACY.md).

## Known limitations

- Suspending discards the page, so **unsaved form input in a suspended tab is lost** (the same as Chrome's own memory saver). Whitelist sites where this matters, or turn off auto-suspend in settings.
- The "MB freed" figure in the footer is a rough estimate (≈50 MB per tab), not a measurement.
- Smart grouping uses a built-in list of well-known sites plus your own rules; it does not read page content, so it can't group by topic.
- Group titles and colors are not stored in sessions or workspaces yet; restored tabs come back ungrouped.
- Brave and Chrome are supported; Firefox is not yet (the popup works, but tab-group APIs differ).

## Develop

```bash
npm install
npm run dev                          # Chrome with hot reload
npm run check && npm run lint && npm test
npm run build && npm run e2e         # set CHROMIUM_PATH to use your own Chromium
npm run zip                          # store-ready zip in .output/
```

### Architecture

```
src/
  entrypoints/
    background.ts     # MV3 service worker: alarms (idle sweep, snapshots), tab activity tracking
    popup/            # Toolbar popup: Tabs / Workspaces / Sessions / Closed views + search (plain TypeScript, textContent only)
    options/          # Settings, backup export/import
  core/
    rules.ts          # pure suspend decision (unit tested)
    activity.ts       # last-active timestamps in storage.session (the worker is ephemeral)
    workspaces.ts     # switch = save outgoing tabs first, open new, then close old
    sessions.ts       # sessions + auto snapshots + pruning
    search.ts         # MiniSearch index
    grouping.ts       # pure smart-grouping planner (rules > category > site), unit tested
    grouping-apply.ts # applies a plan with chrome.tabGroups
    backup.ts         # validate/sanitize untrusted import files
    settings*.ts      # settings schema, sync-with-local-fallback storage
  storage/db.ts       # Dexie (IndexedDB) with versioned schemas
tests/unit            # Vitest
tests/e2e             # Playwright drives the built extension
```

Key design rules: every `chrome.*` listener is registered synchronously at the top level of the worker; no state lives in memory; untrusted page text is only rendered with `textContent`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
