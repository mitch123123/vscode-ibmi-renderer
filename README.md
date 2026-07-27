# IBM i Display File Designer

Visual designer for IBM i display files (`.dspf`) and printer files (`.prtf`) — a VS Code custom editor aimed at Rational Developer for i Screen Designer workflows.

⚠️ Still in development.

## Try it

```powershell
npm install
npm run compile
```

Press **F5** to launch the Extension Development Host, then open [`samples/DEMO.dspf`](samples/DEMO.dspf). From the DDS source editor use the title-bar **Edit / Preview** action (or the CodeLens at the top of the file), or **Open With… → IBM i Display File Designer**.

Use the **Design | Source** control in the designer toolbar (or the editor title icons) to switch between the visual designer and the normal text editor. Only one view stays open for a given DDS file at a time.

## Works with the IBM i Development Pack

This extension is designed to sit alongside the [IBM i Development Pack](https://marketplace.visualstudio.com/items?itemName=HalcyonTechLtd.ibm-i-development-pack):

| Extension | Relationship |
|-----------|----------------|
| **Code for IBM i** | Soft dependency. Remote `member` / `streamfile` URIs open and save through its FS providers. Disconnect/reconnect closes or locks remote designer tabs like other editors. |
| **IBMi Languages** (`barrettotte.ibmi-languages`) | Provides `dds.dspf` / `dds.prtf` language IDs and syntax highlighting. |
| **IBM i Renderer** (marketplace `vscode-displayfile`) | Older CodeLens preview still shipped in the pack. This repo is the newer real-time designer — both can be installed; use **Edit / Preview** / **Open With** for this editor. |
| RPGLE / CL / COBOL / Db2 / Project Explorer / Testing | No shared APIs; no conflicts expected. |

**Open paths**

- DDS source editor title **Edit / Preview** (primary), or CodeLens at the top of the file
- Explorer / Object Browser / IFS → right-click → **Edit / Preview**
- **Open With… → IBM i Display File Designer**

The custom editor uses `priority: "option"`, so it does **not** steal the default text editor for DDS sources.

## Features (this milestone)

- Custom text editor (`ibmi.dspfDesigner`) with document sync / undo
- Round-trip edits that preserve `*` comment and blank lines outside the edited field
- Drag/drop field palette, multi-select, marquee, keyboard move, copy/paste
- Rulers + row/col cursor badge; Design / Preview mode; screen size DS3/DS4
- Indicator toggle panel with conditioned field/keyword preview
- Windows (incl. WDWTITLE), subfiles, overlays, EDTCDE/EDTWRD preview, reference fields
- Printer file (`.prtf`) support
- Remote disconnect/reconnect lifecycle with Code for IBM i

## Tests

```powershell
npm test
```

[Project board](https://github.com/orgs/codefori/projects/7) for remaining functionality.
