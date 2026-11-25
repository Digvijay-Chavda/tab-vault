# Contributing

```bash
npm install
npm run dev                 # Chrome with hot reload
npm run check && npm run lint && npm test
npm run build && npm run e2e   # needs Chromium; set CHROMIUM_PATH to use your own binary
```

Guidelines
- Keep logic in `src/core` as pure functions where possible and add a unit test.
- All `chrome.*` event listeners must be registered synchronously at the top level of the background script (MV3 service workers are ephemeral). Never keep state in module variables.
- Render untrusted text (tab titles, URLs) with `textContent` only.
- Never edit an existing Dexie `.version(n)`; add a new one with an upgrade.
- Don't add permissions without discussing the Web Store review impact first.
