---
description: Bump the version and publish a TabVault release (only when the owner asks)
argument-hint: <new version, e.g. 1.4.0>
---

Publishing is public, so only do this when the owner has asked for a release. Version to ship: $ARGUMENTS

1. Confirm the working tree is clean and on `master`, then run `/verify`.
2. Bump the version in `package.json` (line 3) and `package-lock.json` (lines 3 and 9).
3. In `CHANGELOG.md`, rename the top "Unreleased" heading (or add one) to `## $ARGUMENTS` with the changes listed.
4. Update `.claude/project-state.md` (version table and verification status).
5. Commit as the owner (see `CLAUDE.md`), push to `master`, and confirm the CI run for that commit passes.
6. Publish: try `git tag v$ARGUMENTS && git push origin v$ARGUMENTS`. If the tag push fails (it has failed from the cloud sandbox),
   run the Release workflow by hand instead: workflow `release.yml`, ref `master`, input `tag` = `v$ARGUMENTS`.
7. Verify the GitHub Release exists, is not a draft, and has `tabvault-$ARGUMENTS-chrome.zip` attached. Tell the owner the link.

Do not publish to the Chrome Web Store from here; hand the zip and `docs/STORE_LISTING.md` to the owner.
