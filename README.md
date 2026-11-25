# TabVault

Fast, open-source, **local-first** tab and session manager for Chrome and Brave.
Suspends idle tabs, saves sessions, and searches everything you have open or saved.

> Status: early development (v0.1). Nothing leaves your browser: no accounts, no analytics, no backend.

## Features (v0.1)

- Auto-suspend idle tabs (native `tabs.discard`), skipping active, pinned, audible and whitelisted tabs
- Save the current window as a session and restore it later
- Side panel with instant fuzzy search across open tabs and saved sessions
- Keyboard shortcut: `Ctrl/Cmd+Shift+K`

See [docs/PLAN.md](docs/PLAN.md) for the roadmap (workspaces, command palette, opt-in content indexing, sync).

## Develop

```bash
npm install
npm run dev        # launches Chrome with the extension and hot reload
npm run check && npm run lint && npm test
npm run build      # output in .output/chrome-mv3
```

Load unpacked in Chrome or Brave: `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3`.

## Permissions

| Permission | Why |
|---|---|
| `tabs` | Read tab titles/URLs and discard idle tabs |
| `storage` | Save settings and per-tab activity |
| `alarms` | Periodic idle check (the MV3 service worker is ephemeral) |
| `sidePanel` | The main UI |

No host permissions are requested.

## Architecture notes

- All `chrome.*` listeners are registered synchronously at the top level of the service worker; state lives in `chrome.storage.session` / IndexedDB, never in memory.
- The suspend decision is a pure function (`src/core/rules.ts`) with unit tests.
- Sessions are stored in IndexedDB via Dexie with versioned schemas.

## License

MIT
