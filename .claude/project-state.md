# Project state

_Snapshot: version 1.3.1 on `master`. Update this file whenever you ship._

## Versions and release status

| Version | State |
|---|---|
| 1.2.0 | Released on GitHub (tag `v1.2.0`, zip attached). Popup UI, Closed view, duplicate badge. |
| 1.3.1 | **Released** (patch). Docs, store listing, privacy text, screenshots and `.claude/` only; extension behavior identical to 1.3.0. |
| 1.3.0 | **Released** on GitHub (tag `v1.3.0` at the commit that added `.claude/`, `tabvault-1.3.0-chrome.zip` attached, about 114 KB). Published via the manual Release workflow because tag pushes fail from the cloud sandbox. |

Chrome Web Store: nothing published from here; `docs/STORE_LISTING.md` has the listing text and permission justifications.

## What is built (all in 1.3.0, unchanged in 1.3.1)

Popup (`src/entrypoints/popup/`): six views (Tabs, Stash, Workspaces, Sessions, Closed, Insights) plus a Help view and a
command palette (`>` prefix or Ctrl/Cmd+K).

- **Tabs**: filters (All, Suspended, Playing, Pinned, Duplicates), toolbar (Group, Ungroup, Suspend idle, Close
  duplicates, Organize menu for sort and merge, Panic), per-row pin / more-menu / close, multi-select (Ctrl/Cmd-click,
  Shift-click) with a bulk bar (Stash, Group, Save session, Close).
- **Row menu**: stash and close, note and tags, move to window, suspend, mute, never suspend this site.
- **Stash**: park a tab (saved first, then closed), reopen, note it, remove, clear.
- **Notes and tags**: keyed by normalized URL (`dedupeKey`), shared by every tab, saved copy or stash entry for that page.
  Searchable (`#tag` works).
- **Workspaces**: switch (saves outgoing tabs first), rename, update from window, schedule to open at a time on chosen
  days (opens in a **new** window), delete.
- **Sessions**: save, restore in a new window, rename, delete. Kinds: `manual`, `auto` (pruned to 10), `archive` (never pruned).
- **Closed**: recently closed tabs/windows via `chrome.sessions`.
- **Insights**: counts, top sites, longest-unopened tabs. Memory is an estimate (50 MB per loaded tab).
- **Search**: MiniSearch over open tabs, sessions, workspaces and stash, including notes and tags.

Background (`src/entrypoints/background.ts`): idle sweep (every minute), housekeeping every 15 minutes (auto snapshot,
archive stale tabs, scheduled backup), workspace schedules (checked by the minute alarm), toolbar duplicate badge, opt-in
"switch to existing tab", auto-grouping on page load, three keyboard commands (stash, panic, group).

Settings page (`src/entrypoints/options/`): auto-suspend, smart grouping, duplicate warning and action, archive days,
appearance (theme, density), snapshots, backup (export, import, scheduled days, back up now).

Saved tabs keep their tab group (title and color) and regroup on restore (sessions, workspaces, snapshots, schedules).

## Verification status

| Check | Result when last run |
|---|---|
| `npm run check` (tsc) | pass |
| `npm run lint` | pass |
| `npm test` | 93 unit tests in 11 files, pass |
| `npm run build` + `npm run e2e` | 17 e2e steps, pass (run twice in a row) |
| GitHub CI on `master` | passed for the release commit (check, lint, test, build and e2e on a hosted runner). A run for the previous commit stayed listed as "in progress" in the API; it was stale, the later run superseded it |

### E2E coverage (`tests/e2e/smoke.mjs`, real Chromium with the extension loaded)

lists tabs, typo-tolerant search, suspend on demand, duplicate detection and badge, recently closed, save session and search
inside it, smart grouping (rules, manual, ungroup, auto), **session restore keeps tab groups**, notes and tag search, stash,
multi-select and bulk save, command palette sort and panic, insights, merge windows, schedule form (valid and invalid time),
opt-in switch-to-existing-tab, workspace create/switch/draft-preservation, settings persistence, export/import, back up now.

### NOT covered by any automated test (treat as less certain)

- A schedule or auto-archive actually **firing** (only the pure logic in `schedule.ts` / `tab-plans.ts` is unit tested).
- Scheduled backup firing on its own (the "Back up now" button is e2e tested).
- Keyboard shortcuts from `chrome.commands` (Alt+Shift+S/P/G); the popup shortcuts (Alt+1..6, Ctrl+K, `?`) are only partly exercised.
- Theme and density rendering in the popup (settings persistence is tested, visuals are not).
- **Firefox**: `npm run build:firefox` produces an MV3 build and the manifest was inspected, but it was never loaded in Firefox.
- Incognito behavior (merge skips windows with a different incognito state by design; not tested).

## Known limitations (also in README)

- Suspending discards the page: unsaved form input is lost. Whitelist protects sites.
- Memory numbers are estimates; browsers do not expose per-tab memory to extensions.
- Schedules, archive and scheduled backups only run while the browser is open (MV3 alarms).
- `tab.lastAccessed` (Chrome 121+) drives auto-archive; tabs without it are never archived.
- Popup is a fixed 420x580 box; it closes when focus leaves it, so long actions must not depend on it staying open.
- Text input uses inline dialogs (`askForm`) because `prompt()` is unreliable in extension popups; `confirm()` is still used for destructive actions.

## Tests, numbers and sizes at this snapshot

About 2,500 lines of TypeScript in `src/`. Largest file: `popup/main.ts` (about 740 lines). Build output about 300 KB total,
release zip about 100 KB.
