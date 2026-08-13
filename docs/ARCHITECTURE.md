# Architecture

This document describes how the IBM i Display File Designer is put together, so
contributors can extend it without breaking round-trip DDS editing.

## Table of contents

1. [High-level layout](#high-level-layout)
2. [Two processes: extension host vs. webview](#two-processes-extension-host-vs-webview)
3. [The DDS model (`src/ui/dspf.ts`)](#the-dds-model-srcuidspfts)
4. [`DdsUpdate` semantics — the insert-vs-replace convention](#ddsupdate-semantics--the-insert-vs-replace-convention)
5. [Applying edits from host to `TextDocument`](#applying-edits-from-host-to-textdocument)
6. [Message protocol](#message-protocol)
7. [Round-trip and passthrough](#round-trip-and-passthrough)
8. [Remote (`member` / `streamfile`) lifecycle](#remote-member--streamfile-lifecycle)
9. [Database field browsing (SDA F10)](#database-field-browsing-sda-f10)
10. [Testing](#testing)

---

## High-level layout

```
src/
  extension.ts              Activation, command registration
  editorSwitch.ts           Open designer and/or text editor for the same DDS URI
  editPreviewCodeLens.ts    CodeLens entry points on DDS text
  ibmiLifecycle.ts          React to Code-for-IBMi connect / disconnect
  protectedSource.ts        Read-only guard for DDS from certain sources
  uri.ts                    URI / browser-node helpers
  dbBrowse.ts               SDA-F10 style database-field browser (SYSCOLUMNS)
  shared/
    dspf-types.ts           Types shared with the webview (via structured cloning)
    messages.ts             Message channel contracts + custom-editor viewType
  ui/
    index.ts                CustomTextEditorProvider + DspfDesignerSession
    dspf.ts                 Pure DDS model: parse, generate, edit spans
  tests/
    dspf.test.ts            Vitest coverage for the model
webui/
  index.html                Webview host document
  main.js                   Bundled webview entry (esbuild output)
  src/                      Webview modules (renderer, sidebar, …)
  scripts/                  Copied vendor assets (Konva, VS Code elements, codicons)
```

## Two processes: extension host vs. webview

- **Extension host** (`src/**`) runs Node in the VS Code extension host. It owns
  the `TextDocument` and is the only side that can mutate it via
  `WorkspaceEdit`.
- **Webview** (`webui/**`) is a sandboxed browser context. It receives a
  serialised snapshot of the parsed `DisplayFile` after every edit and sends
  edit intents back through `postMessage`.

State flow (edit cycle):

1. User acts in the webview (drag, keyword change, palette drop, tab rename…).
2. Webview sends a typed message from `WebviewToHostMessage`.
3. `DspfDesignerSession` in `src/ui/index.ts` computes a `DdsUpdate` via the
   pure model in `src/ui/dspf.ts`.
4. Session translates the `DdsUpdate` into a `WorkspaceEdit` and applies it.
5. VS Code fires `onDidChangeTextDocument`. The session ignores its own echo
   (via `ignoreDocumentChanges`), reparses, and posts a `load` / `update`
   message back to the webview.

## The DDS model (`src/ui/dspf.ts`)

`DisplayFile.parse(lines)` walks the 80-column DDS source and produces:

- `formats: RecordInfo[]` — one entry per record, plus a synthetic `_GLOBAL`
  record that owns file-level keywords (everything before the first `R` line).
- Per-record: `fields: FieldInfo[]`, `keywords: Keyword[]`,
  `passthroughLines: PassthroughLine[]`, `ownedHeaderLines: number[]`.
- `sourceLines` — the exact original text, kept for round-trip.

Two concepts are important:

- **Owned lines** — lines the model would rewrite when the field / header is
  regenerated. Tracked per field (`FieldInfo.ownedLines`) and per record header
  (`RecordInfo.ownedHeaderLines`).
- **Passthrough lines** — comments (`*` in column 7) and blank lines. Recorded
  on the enclosing record so we can re-emit them at their relative positions
  after regeneration, and so field edits never rewrite unrelated commentary.

## `DdsUpdate` semantics — the insert-vs-replace convention

Every model-level edit produces a `DdsUpdate`:

```ts
interface DdsUpdate {
  newLines: string[];
  range?: DdsLineRange;    // { start, end, endHeader? }
}
```

`range` uses a **0-based inclusive** span with two possible shapes:

| Shape           | Meaning                                              |
|-----------------|------------------------------------------------------|
| `end >= start`  | Replace / delete the inclusive `start..end` span.    |
| `end === start - 1` | Pure insert *before* line `start`; deletes nothing. |

The insert form (`end < start`) is used by:

- `updateField` when `originalFieldName` is `undefined` (new field append at
  the end of the record body).
- `insertFormats` and `copyFormat` (append at EOF).
- `updateFormatHeader` when the record has no header lines yet (typically
  first-ever `_GLOBAL` keyword block).

`applyUpdateToLines(lines, update)` in the model implements this convention
in-memory (used by tests and by any future headless code path).
`DspfDesignerSession.insertLinesAt` in `src/ui/index.ts` implements the same
convention against a real VS Code `TextDocument` — including the case where
the file has no trailing newline and `start >= lineCount`.

## Applying edits from host to `TextDocument`

The session distinguishes two edit primitives:

- **Replace**: `workspaceEdit.replace(uri, fullLinesRange(start, end), text)`,
  where `fullLinesRange` produces `Range(start, 0, endExclusive, 0)` so we
  overwrite entire lines including their trailing newline.
- **Insert**: `insertLinesAt(edit, lineIndex, newLines, label)`. Handles three
  cases: empty document, past-EOF insert, and mid-file insert.

`insertLinesAt` exists because `workspaceEdit.insert(uri, Position(lineIndex, 0), …)`
does not add a leading EOL when the document lacks a trailing newline. Routing
all inserts through `insertLinesAt` keeps that quirk contained.

After a successful `applyEdit`, the session:

1. Refreshes its `TextDocument` reference (VS Code may swap the instance).
2. Reparses the current text.
3. Posts either `"load"` (full re-render — layout / structure changed) or
   `"update"` (soft update — same layout, just data) back to the webview.

## Message protocol

Defined in `src/shared/messages.ts`.

- **Host → Webview** (`HostToWebviewMessage`): `load`, `update`,
  `connectionStatus`, `databaseFields`, `editFailed`, `showError`,
  `requestInputResult`, `requestConfirmResult`, `selectFormat`,
  `flushPendingEdits`.
- **Webview → Host** (`WebviewToHostMessage`):
  `deleteField[s]`, `newField[s]`, `updateField[s]`, `updateFormat`,
  `newFormats`, `deleteFormat`, `renameFormat`, `copyFormat`,
  `browseDatabaseFields`, `placeDatabaseFields`, `requestInput`,
  `requestConfirm`, `showError`.

The designer custom editor and the default DDS text editor may stay open at
the same time for one URI. Both bind to the same `TextDocument`: designer edits
apply `WorkspaceEdit`s (text updates live), and external text changes reload
the designer via `onDidChangeTextDocument` (debounced while typing).

The host processes webview messages through a FIFO queue
(`DspfDesignerSession.drainQueue`) — one edit at a time, awaiting each
`applyEdit` — so we never interleave two `WorkspaceEdit`s against the same
document.

### Trust boundary

The webview is an untrusted scripted context. Mitigations:

- HTML is served with a **Content Security Policy** (nonce-backed `script-src`,
  `default-src 'none'`) from `DspfDesignerProvider.getBaseHtml`.
- `enableCommandUris` is **false**; `localResourceRoots` is limited to `webui/`.
- Document-mutating payloads are validated in `src/shared/editValidation.ts`
  before a `WorkspaceEdit` is built (field names/lengths/positions, keywords,
  const values, format keywords such as `SFLPAG` / `WINDOW`).
- Dialog proxies (`showError`, `requestInput`, `requestConfirm`) sanitize and
  length-clamp strings so a compromised webview cannot freely spoof VS Code UI.
- The extension declares `untrustedWorkspaces.supported: false` — the designer
  requires a trusted workspace.

## Round-trip and passthrough

Guarantees the parser aims to preserve:

- Comment lines (`*` in column 7) and blank lines inside a record are
  re-emitted in their relative slot after a regeneration.
- Unrelated fields, formats, and file-level keywords are never rewritten by a
  single-field edit.
- Record names preserve casing on the `R` line via
  `DisplayFile.replaceRecordNameOnRLine`, which pads column 19 to 10 chars.
- `SFLCTL` / `SFLMSGRCD` references are retargeted on rename via
  `DisplayFile.retargetFormatRefsInLine` (regex-escaping IBM name characters
  `$ # @`).

Deletion has a referential-integrity guard:
`DisplayFile.deleteFormat` returns `undefined` when
`formatsReferencing(recordFormat)` finds a CTL still pointing at the target,
so a subfile pair cannot be broken from the tab context menu.

## Remote (`member` / `streamfile`) lifecycle

`ibmiLifecycle.ts` listens for connect / disconnect events emitted by
`halcyontechltd.code-for-ibmi` (soft dependency) and calls
`DspfDesignerProvider.setRemoteSessionsReadonly(true|false)`. Remote sessions
gate all edits on `connectionReadonly`; local files are never locked because of
IBM i state.

`protectedSource.ts` additionally blocks the designer for sources we should
not round-trip (e.g. read-only object browser entries), falling back to the
plain text editor with a warning.

## Database field browsing (SDA F10)

`dbBrowse.ts` implements the equivalent of SDA's F10 (add reference field):

1. Prompt for library + file, validated with `IBMI_IDENTIFIER`
   (1–10 chars, `A–Z @ # $` then `A–Z 0–9 @ # $`).
2. Query `QSYS2.SYSCOLUMNS` via Code for IBM i's `runSQL`.
3. Map DB2 types to DDS types with `mapSqlType`.
4. Emit `DbFieldDef[]` back to the webview.

Names are re-validated before SQL construction as defense-in-depth (the SQL
still single-quote-escapes values, so the combined guard leaves no injection
surface).

## Testing

- `npm test` runs Vitest against the model. The model is deliberately
  free of VS Code imports so tests never spin up the extension host.
- New model-level features must arrive with a `describe` in
  `src/tests/dspf.test.ts` covering both the happy path and at least one
  edge case (insert at EOF, mid-span comment, referential integrity, etc.).
- Webview logic that has meaningful state should be extracted into a pure
  helper (see `webui/src/palette.js#isValidRecordName`) so it stays testable
  from Vitest.
