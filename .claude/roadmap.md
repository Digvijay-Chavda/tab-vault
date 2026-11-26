# Roadmap and open ideas

Suggestions, not commitments. Ask the owner before starting anything large. Everything from the first two feature lists
(recently closed, duplicate badge, stash, group persistence, command palette, multi-select, switch-to-existing, notes and
tags, sort and merge, move to window, rename, auto-archive, scheduled workspaces, panic, whitelist from the popup, insights,
theme and density, shortcuts, Firefox build, scheduled backups) is already built.

## Do first: close verification gaps

1. **Publish 1.3.0**: tag and release (see `conventions.md`), then check the Release workflow and the zip.
2. Test that a **schedule fires** and **auto-archive runs** end to end. Needs a way to inject time or a short test hook in
   `runSchedules()` / `archiveStale()`; keep the production path unchanged.
3. Load the Firefox build in a real Firefox and fix what breaks (tab groups, `sessions`, badge, downloads). Then decide
   whether to publish it and update the README claim.
4. Cover the three `chrome.commands` shortcuts and the keyboard shortcuts in the popup.
5. Check the popup on a small laptop screen and at 200% zoom (fixed 420x580 box).

## Good next features

- **Undo for bulk actions**: a toast with Undo after "Close" on a selection, "Clear stash", archive. Stash already saves
  first, so this is mostly UI.
- **Session detail view**: expand a session to see its tabs, restore a single tab, edit notes on saved tabs.
- **Schedules in the settings page** (list, edit, remove) instead of only the workspace menu.
- **Per-site rules**: custom idle times, "never archive", per-site group colors.
- **Stash tools**: restore all, export stash as a list, "stash all tabs in this group".
- **Bulk move to window** for multi-selected tabs.
- **Search filters** (`site:`, `tag:`, `in:stash`) and keyboard Delete/Backspace to close the highlighted tab.
- **Import from other tab managers** (OneTab-style text lists, browser bookmarks).
- **Localization** (strings are inline English today).
- **Web Store publication**: screenshots at 1280x800, listing text in `docs/STORE_LISTING.md`, privacy policy link.

## Deliberately not done

- Real per-tab memory numbers: not exposed to extensions in stable browsers (only an estimate is shown).
- Reading page content or any network calls: the project's privacy promise is no host permissions and no servers.
- A UI framework: plain DOM keeps the bundle small; split `popup/main.ts` into per-view modules if it grows past about 1,000 lines.
