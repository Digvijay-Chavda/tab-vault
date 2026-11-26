---
description: Run every pre-push check for TabVault (types, lint, unit, build, end-to-end)
---

Run the full verification, stopping at the first failure and reporting it exactly (do not push or continue past a failure):

```bash
npm run check && npm run lint && npm test && npm run build && CHROMIUM_PATH=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome 2>/dev/null | head -1) npm run e2e
```

Notes:
- If no Chromium is found at that path, run `npm run e2e` with `CHROMIUM_PATH` set to a Chromium binary on this machine.
- Add `SCREENSHOTS=1` to the e2e command only when the UI changed, then open the new files in `docs/screenshots/` and look at them before committing.
- If e2e fails, fix the **first** failing step first; later failures are often leftovers of it (see `.claude/conventions.md`). Re-run twice before trusting a pass.
- Report the real numbers (unit test count, e2e step count) from the output, not from memory.
