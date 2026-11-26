# .claude: orientation for AI assistants

Read this folder before changing TabVault. It records what the project is, how it is built, what state it is in, and the
workflow rules the owner expects. Keep it current: when you ship something, update `project-state.md` and, if the shape of
the code changed, `architecture.md`.

| File | Read it for |
|---|---|
| [`project-state.md`](project-state.md) | What exists today, what is verified, version and release status, known gaps |
| [`architecture.md`](architecture.md) | Code map, data model, storage keys, background and popup flows, permissions |
| [`conventions.md`](conventions.md) | Coding rules, testing, git and release workflow, sandbox quirks, mistakes to avoid |
| [`roadmap.md`](roadmap.md) | Open ideas and unverified areas, in suggested order |
| [`commands/verify.md`](commands/verify.md) | `/verify`: run every pre-push check |
| [`commands/release.md`](commands/release.md) | `/release`: bump, tag and publish a version |

The repo root `CLAUDE.md` holds the owner's standing instructions (commit authorship, no attribution lines). It wins over
anything here if they ever disagree.

## One-paragraph summary

TabVault is a Chrome/Brave Manifest V3 extension (WXT + TypeScript, plain DOM, no UI framework) that manages tabs:
auto-suspend idle tabs, smart grouping, workspaces, sessions, stash, notes and tags, search, command palette, insights,
scheduled workspaces, auto-archive, scheduled backups. Everything stays on the device; there are no host permissions, no
servers and no analytics. The UI is a toolbar popup (420x580), not a side panel. Owner: Digvijay Chavda. Repo:
`Digvijay-Chavda/tab-vault`, default branch `master`, pushed to directly.
