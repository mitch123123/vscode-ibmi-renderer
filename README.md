# IBM i Display File Designer

Visual designer for IBM i display files (`.dspf`) and printer files (`.prtf`) — a
VS Code custom editor aimed at Rational Developer for i Screen Designer
workflows.

> Still in active development. See the
> [project board](https://github.com/orgs/codefori/projects/7) for what's next.

---

## Contents

- [Highlights](#highlights)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Opening the designer](#opening-the-designer)
- [Works with the IBM i Development Pack](#works-with-the-ibm-i-development-pack)
- [Development](#development)
- [Testing](#testing)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

## Highlights

- Custom text editor (`ibmi.dspfDesigner`) with full document sync + undo.
- Round-trip edits: `*` comments and blank lines outside the edited field are
  preserved byte-for-byte.
- Drag/drop field palette, multi-select, marquee selection, keyboard move,
  copy/paste.
- Rulers + row/column cursor badge; Design / Preview modes; DS3 (24×80) and
  DS4 (27×132) screen sizes.
- Indicator toggle panel with conditioned field/keyword preview.
- Windows (incl. `WDWTITLE`), subfiles (`SFL` + `SFLCTL`), overlays,
  `EDTCDE` / `EDTWRD` preview, reference fields.
- Printer file (`.prtf`) support.
- Add fields directly from a database file (SDA F10 equivalent) via
  Code for IBM i's `runSQL`.
- Remote disconnect / reconnect lifecycle: locks tabs sourced from IBM i when
  the connection drops.

## Requirements

- **VS Code** 1.97 or newer.
- **Node.js** 18+ (for building from source).
- Optional: **[Code for IBM i](https://marketplace.visualstudio.com/items?itemName=HalcyonTechLtd.code-for-ibmi)**
  — required only for editing remote `member`/`streamfile` DDS and for the
  database-field browser.
- Optional: **IBMi Languages** (`barrettotte.ibmi-languages`) — supplies the
  `dds.dspf` / `dds.prtf` language IDs used for CodeLens and command
  visibility.

## Getting started

Clone and install:

```powershell
git clone https://github.com/codefori/vscode-ibmi-renderer.git
cd vscode-ibmi-renderer
npm install
npm run compile
```

Press **F5** to launch the Extension Development Host, then open
[`samples/DEMO.dspf`](samples/DEMO.dspf).

## Opening the designer

- From a DDS text editor: the title-bar **Edit / Preview** action, or the
  CodeLens at the top of the file.
- From Explorer, Object Browser, or IFS Browser: right-click →
  **Edit / Preview**.
- Anywhere: **Open With… → IBM i Display File Designer**.
- To flip between visual and text views: **Design | Source** control in the
  designer toolbar, or the editor-title icons.

Only one view stays open at a time for a given DDS URI (see
[`src/extension.ts`](src/extension.ts) `enforceExclusiveDdsTabs`).

The custom editor uses `priority: "option"`, so it does **not** steal the
default text editor for DDS sources.

## Works with the IBM i Development Pack

This extension is designed to sit alongside the
[IBM i Development Pack](https://marketplace.visualstudio.com/items?itemName=HalcyonTechLtd.ibm-i-development-pack):

| Extension | Relationship |
|-----------|--------------|
| **Code for IBM i** | Soft dependency. Remote `member` / `streamfile` URIs open and save through its FS providers. Disconnect/reconnect closes or locks remote designer tabs like other editors. |
| **IBMi Languages** (`barrettotte.ibmi-languages`) | Provides `dds.dspf` / `dds.prtf` language IDs and syntax highlighting. |
| **IBM i Renderer** (marketplace `vscode-displayfile`) | Older CodeLens preview still shipped in the pack. This repo is the newer real-time designer — both can be installed; use **Edit / Preview** / **Open With** for this editor. |
| RPGLE / CL / COBOL / Db2 / Project Explorer / Testing | No shared APIs; no conflicts expected. |

## Development

Common scripts (from `package.json`):

| Command                 | What it does                                          |
|-------------------------|-------------------------------------------------------|
| `npm run compile`       | Frontend copy → type-check → lint → esbuild bundle.   |
| `npm run watch`         | Type-check + esbuild in watch mode (via `npm-run-all`). |
| `npm run check-types`   | `tsc --noEmit` only.                                  |
| `npm run lint`          | ESLint on `src`.                                      |
| `npm run package`       | Production build (same as compile with `--production`). |
| `npm test`              | Vitest suite for the DDS model.                       |

The webview bundle is produced by `esbuild.js`; static vendor assets
(`@vscode-elements/elements`, `@vscode/codicons`, `konva`) are copied into
`webui/scripts/` by the `build:frontend` step.

## Testing

Model-level tests live in [`src/tests/dspf.test.ts`](src/tests/dspf.test.ts) and
run under Vitest:

```powershell
npm test
```

The DDS model in `src/ui/dspf.ts` is deliberately free of VS Code imports so
tests never load the extension host. New model features should ship with
Vitest coverage of both the happy path and one edge case (mid-span comments,
insert at EOF, referential integrity, etc.).

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for:

- how the extension host and webview cooperate,
- the `DdsUpdate` insert-vs-replace convention,
- how comments and blank lines survive round-tripping,
- the remote disconnect / reconnect lifecycle,
- and the database-field browser flow.

## Contributing

- Please open an issue before large changes so we can align on the DDS
  round-trip contract.
- Match the existing style: two-space indent, single backticks for string
  literals in `src/`, `@ts-check`-friendly JSDoc in the webview.
- Every model change needs a Vitest case.

## License

MIT — see [`LICENSE`](https://github.com/codefori/vscode-ibmi-renderer/blob/main/LICENSE)
in the repository (or the `license` field in `package.json`).
