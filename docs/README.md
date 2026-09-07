# Documents

| Document                           | What it holds                                       |
| ---------------------------------- | --------------------------------------------------- |
| [architecture.md](architecture.md) | The modules, the flow, the record, the constraints  |
| [decisions/](decisions/)           | Why each part works that way, and what was rejected |
| [testing.md](testing.md)           | Suite coverage, and the checks that need a browser  |
| [roadmap.md](roadmap.md)           | What is next, and the open questions                |

Installing and driving the extension is the [README](../README.md).

## Where plan.md went

`docs/plan.md` held all of the above in one file and was removed on 2026-09-08.
Commits before that date carry `Refs: docs/plan.md`. Its parts went here:

| Section in plan.md             | Now in                                                              |
| ------------------------------ | ------------------------------------------------------------------- |
| Premises, Files                | [architecture.md](architecture.md)                                  |
| Decisions table                | [decisions/0001](decisions/0001-the-shape-of-the-extension.md)      |
| Why the shortcut replaced blur | [decisions/0002](decisions/0002-clipboard-capture-on-a-keypress.md) |
| Export field choice            | [decisions/0003](decisions/0003-choosing-what-an-export-carries.md) |
| Site allow-list                | [decisions/0004](decisions/0004-recording-only-on-listed-sites.md)  |
| Phase 1 (done)                 | [README](../README.md)                                              |
| Phases 2 to 4, Open questions  | [roadmap.md](roadmap.md)                                            |
| Testing notes                  | [testing.md](testing.md)                                            |
