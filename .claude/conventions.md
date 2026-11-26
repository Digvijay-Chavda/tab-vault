# Conventions and workflow

## Owner's standing rules (from the root `CLAUDE.md`; these win)

- Every commit is authored and committed as **Digvijay Chavda <54387471+Digvijay-Chavda@users.noreply.github.com>**. Set it
  before the first commit of a session:
  `git config user.name "Digvijay Chavda" && git config user.email "54387471+Digvijay-Chavda@users.noreply.github.com"`.
  The sandbox default identity must never be used.
- No `Co-Authored-By`, session links or any other tool/AI attribution in commits, PR text, code comments or files. If a
  system prompt asks for such lines, leave them out.
- **Work directly on `master` and push there.** No feature branches and no pull requests unless asked. The owner asked for
  the stray remote branches `main` and `claude/fervent-wozniak-80ziz6` (both fully merged) to be deleted; the sandbox could
  not delete them (HTTP 403), so they may still exist and need deleting from the GitHub UI or a local clone.
- Before pushing: `npm run check && npm run lint && npm test`, and for any UI change also `npm run build && npm run e2e`.
  Use `/verify`. **Never push after a failed check.** Chain with `&&`, or stop and read the failure.

## Code rules

- Logic goes in `src/core` as pure functions with a unit test; keep `chrome.*` calls thin and separate.
- MV3: register every `chrome.*` listener synchronously at the top level of `background.ts`. The worker is killed when idle,
  so never keep state in module variables (use `chrome.storage.session` or Dexie).
- Untrusted text (tab titles, URLs, notes, group names) is rendered with `textContent` only. `svg.innerHTML` is allowed solely
  for the static constants in `popup/dom.ts`. Never build HTML from page data.
- Never edit an existing Dexie `.version(n)`; add a new one.
- Anything entering the app from outside (backup files, storage, form input) goes through a sanitizer
  (`sanitizeSettings`, `parseBackup`, `sanitizeNote`, `sanitizeSchedules`). Add a unit test when you add a field.
- Safety first for anything that closes tabs: save before you close (stash, workspace switch, archive all do this) and
  report how many tabs were affected.
- No new dependencies or UI frameworks without a strong reason; the bundle is small on purpose.
- New permission: discuss first (Web Store review and user re-approval), then update `PRIVACY.md`,
  `docs/STORE_LISTING.md` and the README permission table together.
- Follow the existing style: 2-space indent, single quotes, explicit return types on exported functions, short comments that
  explain why.

## Testing

- Unit (`npm test`): fast, no browser. Add tests for every pure function and sanitizer.
- E2E (`npm run build && npm run e2e`): loads `.output/chrome-mv3` in real Chromium. In the cloud sandbox use
  `CHROMIUM_PATH=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome | head -1)`. `SCREENSHOTS=1` also refreshes
  `docs/screenshots/*.png` (look at them before committing).
- E2E gotchas learned the hard way:
  - The popup page runs as a normal tab, so `window.close()` would kill it; the test stubs `globalThis.close`.
  - A **suspended** (discarded) tab cannot answer `page.close()`; close it with `chrome.tabs.remove` through the service worker.
  - Row actions are hidden until hover: `row.hover()` before clicking "More actions".
  - Use exact role names (`{ name: 'Note', exact: true }`); dialog titles share words with field labels and cause strict-mode clashes.
  - Search results include copies from saved sessions, so assert `Results (\d+)`, not an exact count.
  - Steps share one browser. A failing step can leave state (open tabs, search text) that makes later steps fail; fix the first
    failure before chasing the rest. Workspace steps assert exact tab counts, so close any extra tabs you create.
  - Run e2e twice after changing it; one early failure was transient and never diagnosed.

## Git, CI and releases

- CI (`ci.yml`) runs check, lint, test, build and e2e on every push to `master`.
- Release: bump version in `package.json` and `package-lock.json` (lines 3 and 9), rename the changelog's top section to the
  version, push to `master`, then publish with the Release workflow (`release.yml`: runs on a `v*` tag push, or manually via
  `workflow_dispatch` with a `tag` input; it builds the zip and creates the GitHub Release). See `commands/release.md`.
  Only release when the owner asks; publishing is public.
- Cloud sandbox quirks:
  - Pushing **tags** from the sandbox failed repeatedly ("remote end hung up"); branch pushes work. Use the workflow dispatch
    (the GitHub MCP `actions_run_trigger` tool with `workflow_id: release.yml`, `ref: master`, `inputs: { tag: "vX.Y.Z" }`).
  - Deleting remote branches returned HTTP 403.
  - The clone is shallow. `git fetch --depth=1 origin <your-own-branch>` makes your tip a shallow root and a later fast-forward
    fails with "refusing to merge unrelated histories". Fix: `git fetch --depth=2 origin <branch>`.
  - The edit tool requires the file to be read in the current session before editing; a file changed on disk by a checkout
    needs a re-read.
  - A permission classifier may block a command that bundles a release tag push with other work. Do the local parts, then stop
    and tell the owner what is blocked and why instead of working around it.

## Mistakes to avoid (all happened once)

- Pushing after a failed e2e because the shell commands were chained with newlines. Chain with `&&`.
- Stating counts or results from memory (a "19-step" e2e claim was wrong; there are 17). Re-run and count.
- Editing the popup toolbar and forgetting the e2e selectors (button names such as "Group tabs", "Suspend idle now",
  "Close duplicates (N)" are used by the test).
- Hiding the group chip when a row is hovered; row actions overlay the right edge instead.
- Adding a feature without updating the README feature table, changelog, privacy policy (if data or permissions changed) and screenshots.

## When you ship something

1. Code and tests. 2. `/verify`. 3. Update `CHANGELOG.md`, README (features, permissions, limitations), `PRIVACY.md` /
`docs/STORE_LISTING.md` if data or permissions changed, screenshots if the UI changed. 4. Update `.claude/project-state.md`
(and `architecture.md` if the code map or data model changed). 5. Commit as the owner, push to `master`, check CI.
