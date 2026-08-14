# Change Log

All notable changes to the **IBM i DDS Designer** extension are
documented here. The format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- Merging to `main` publishes to the VS Code Marketplace after CI is green, when
  `package.json` version has no matching `v*` git tag (`VSCE_PAT` required).
- Published as **IBM i DDS Designer** (`mitchfiedler.dds-designer`). Command
  ids, custom editor view type (`mitchfiedler.dspfDesigner`), CodeLens titles,
  tab suffix, and webview layout storage are namespaced so this fork can be
  installed next to `halcyontechltd.vscode-ibmi-renderer` and the older IBM i
  Renderer. Fork of the Code for IBM i / Halcyon Tech Ltd designer
  ([codefori/vscode-ibmi-renderer](https://github.com/codefori/vscode-ibmi-renderer)).

### Added

- Designer tabs show `[IBM i DDS]` in the title and a distinct layout icon so
  they can be told apart from the DDS source editor (VS Code 1.106+).
- Sidebar field Properties: live GUI limits while editing (Name max 10 / no
  spaces, Length/Decimals digit caps, indicator `Nxx` shape, const Value /
  Reference character limits) aligned with IBM i DDS hard limits.
- Webview Content Security Policy with script nonces; `enableCommandUris`
  disabled; `localResourceRoots` limited to `webui/`.
- Workspace trust: designer requires a trusted workspace
  (`untrustedWorkspaces.supported: false`).
- Host validation for `placeDatabaseFields`, keyword/const emission safety,
  and sanitized webview dialog strings.
- Contributor docs: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
  issue/PR templates; richer `samples/SUBFILE.dspf`.
- Marketplace packaging: extension icon + gallery banner; release workflow
  publishes to VS Code Marketplace and Open VSX (in addition to GitHub
  Releases).
- CI: `npm audit --audit-level=high`; Dependabot for npm and Actions.
- Fixed `npm run watch` (`watch:esbuild` / `watch:frontend`).
- Removed unused `@vscode/test-cli` / `@vscode/test-electron` leftovers.

### Fixed

- Closing the designer (or VS Code) with unsaved DDS edits now prompts to
  save. Pending source-pane / nudge edits are flushed first so the document
  is marked dirty before the prompt.

### Removed

- Stale Yeoman `vsc-extension-quickstart.md`.

## [0.2.1] - 2026-07-29

### Fixed

- Emitter: usage `M` (message) and `P` (program) fields no longer lose their
  definition line on edit; unknown col-38 usage is preserved verbatim.
- Emitter: printer-style blank row (`y === 0`) re-emits blank cols 39–41
  instead of inventing `0`.
- Emitter: blank length columns stay blank on re-emit (no invented `0`).
- Emitter: `fitColumn` truncates overflowing name/length/row/col/indicator/
  keyword segments so they cannot shift neighboring DDS columns.
- Parser: unrecognized col-17 lines (`H`/`J`/`K`/`O`, etc.) are kept as
  passthrough so format-header edits no longer destroy them.
- Canvas: arrow-key nudge respects WINDOW origin/bounds, preserves `y === 0`,
  and positions groups with the same origin offset as render.
- Canvas: multi-select drag clamps every member to screen/window bounds;
  paste and align-top no longer force printer `y === 0` onto normal fields.
- Canvas: pending nudge is cancelled on document reload, format switch, and
  Escape so a stale snapshot cannot overwrite a later property edit.
- Sidebar: length/decimals/SFLPAG/SFLSIZ/WINDOW/field-name inputs reject
  invalid values instead of writing corrupt DDS.
- Host: validates `newField(s)` / `updateField(s)` / `updateFormat` payloads
  before applying a WorkspaceEdit and reports failures via `editFailed`.

## [0.2.0] - 2026-07-29

### Added

- CI: `.github/workflows/ci.yaml` runs typecheck, lint, and tests on every PR
  and push to `main` (no longer path-filtered to `src/**` only).
- CI: bundle-freshness job rebuilds `webui/main.js` and fails if it drifts
  from committed output; `.gitattributes` pins the bundle to LF.
- Release: `@vscode/vsce` + `npm run vsix`; tag-triggered
  `.github/workflows/release.yaml` uploads the VSIX as a GitHub Release asset.
- Accessibility: format-tab keyboard navigation (Arrow/Home/End, roving
  `tabIndex`), Shift+F10 / ContextMenu for rename/copy/delete.
- Accessibility: focusable design surface (`#container`) with keyboard entry
  into the first field; Escape clears selection.
- Accessibility: polite live region (`#srStatus`) announces format switch,
  selection, nudge position, and `editFailed`.
- Accessibility: focus restore across sidebar rebuilds; `:focus-visible`
  styles; labelled property inputs and screen-size select.

### Fixed

- Format-tab context menu no longer leaks capture-phase `mousedown` listeners
  on repeated opens.

## [0.1.0] - 2026-07-29

### Added

- Docs: new [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) covering the
  parser, `DdsUpdate` insert-vs-replace convention, host/webview message flow,
  and remote-connection lifecycle.
- Docs: expanded `README.md` with Requirements, Development, Testing,
  Architecture, and Contributing sections.
- Model: `DisplayFile.findFormat` — case-insensitive record-format lookup used
  across the model to accept names from the webview regardless of casing.
- Model: `DisplayFile.formatsReferencing` — enumerates `SFLCTL` / `SFLMSGRCD`
  references, and blocks deletion of a subfile record while its CTL still
  references it.
- Model: `DisplayFile.escapeRegExp` — used by `retargetFormatRefsInLine` so
  DDS names containing `$`, `#`, or `@` are safely rewritten during rename.
- Host: `DspfDesignerSession.insertLinesAt` — a single insertion helper that
  handles empty documents and files without a trailing newline (previously a
  raw `insert()` at `Position(lineCount, 0)` could append onto the last line).
- Host: `editFailed` / `showError` messages so rejected edits and dialog
  errors surface to the user and the canvas resyncs to the document.
- Host-native dialogs for record rename / copy / delete and multi-field
  delete (`requestInput` / `requestConfirm` → `vscode.window.showInputBox` /
  `showWarningMessage`) replacing webview `prompt` / `alert` / `confirm`.
- Shared `isValidRecordName` grammar in `src/shared/recordName.ts` used by
  both host validation and the webview.
- Batched `newFields` message so Ctrl+V paste is a single undoable edit.
- Tests: Vitest coverage for referential integrity, scoped rename, single-line
  field updates, format deletion, regex escaping, and host session handlers
  (readonly lock, failed applyEdit, insert routing).

### Changed

- `DdsUpdate.range` now encodes pure inserts as `end === start - 1`. Previously
  `start === end` was overloaded to mean both "replace one line" and "insert
  before this line". `applyUpdateToLines` and the session helpers were
  updated in lockstep.
- `updateFormat` in `src/ui/index.ts` now routes pure inserts through
  `insertLinesAt` for correct behavior at EOF without a trailing newline.
- `renameFormat` emits scoped per-line updates (R-line + referencing
  `SFLCTL` / `SFLMSGRCD` lines) instead of rewriting the whole document.
- Arrow-key field nudges are debounced (~60 ms) so held keys produce one
  `WorkspaceEdit` per pause.
- `dbBrowse.ts` validates library and file names against the IBM i
  system-object grammar in the input box *and* again before building SQL
  (defense-in-depth against future validator regressions); prefers
  `SYSTEM_COLUMN_NAME` over `COLUMN_NAME` so `REFFLD` names are not
  truncated from SQL long names.
- Renderer clears the selection before destroying the Konva stage so we never
  touch nodes after their layer is disposed.
- Message queue `drainQueue` wraps each handler in `try/catch` so a thrown
  edit no longer stalls the queue.
- Package version bumped to `0.1.0`; `vitest` moved to `devDependencies`;
  `LICENSE` (MIT) added; `.vscodeignore` excludes `webui/src/**`.

### Fixed

- Renaming a record format whose name contains regex metacharacters
  (`$`, `#`, `@`) no longer produces an invalid `RegExp`.
- Renaming to the same name is now treated as a no-op instead of emitting a
  full-document rewrite.
- Deleting a subfile record that a `SFLCTL` still points at is now blocked
  with an actionable warning.
- Failed `WorkspaceEdit` applications and disconnected remote sessions no
  longer fail silently — the user gets a warning and the canvas reloads.
- Marquee selection null-checks `getPointerPosition()`; palette drop guards
  malformed JSON payloads.
- Canvas keyboard shortcuts are no longer swallowed by focused non-input
  `vscode-*` elements (buttons, tabs).
