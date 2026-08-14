# Contributing

Thanks for contributing to IBM i DDS Designer.

This repository is a fork of
[codefori/vscode-ibmi-renderer](https://github.com/codefori/vscode-ibmi-renderer),
created by the [Code for IBM i](https://github.com/codefori) / Halcyon Tech Ltd
team.

## Prerequisites

- **Node.js 20** (CI uses Node 20; Node 18+ may work locally)
- **VS Code** 1.97 or newer
- Optional: [Code for IBM i](https://marketplace.visualstudio.com/items?itemName=HalcyonTechLtd.code-for-ibmi) for remote member/streamfile and database-field browse testing

## Setup

```powershell
git clone https://github.com/mitch123123/vscode-ibmi-renderer.git
cd vscode-ibmi-renderer
npm ci
npm run compile
```

Press **F5** (**Run Extension**) to launch an Extension Development Host, then open
[`samples/DEMO.dspf`](samples/DEMO.dspf) or [`samples/SUBFILE.dspf`](samples/SUBFILE.dspf).

## Day-to-day development

| Command | Purpose |
|---------|---------|
| `npm run watch` | Copy frontend assets once, then watch/rebuild extension + webview with esbuild |
| `npm run compile` | Full check: frontend copy, typecheck, lint, esbuild |
| `npm test` | Vitest unit tests |
| `npm run check-types` | `tsc --noEmit` |
| `npm run lint` | ESLint on `src/` |
| `npm run vsix` | Package a local `.vsix` |

After changing webview sources under `webui/src/`, rebuild (watch or compile) so
`webui/main.js` stays in sync. CI fails if the committed bundle drifts.

## Style and contracts

- Two-space indent; single backticks for string literals in `src/`.
- Prefer `@ts-check`-friendly JSDoc in the webview.
- **Open an issue before large DDS contract changes** (parser/emitter,
  `DdsUpdate` semantics, message protocol). Round-trip preservation is the
  core product promise — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- Model changes need Vitest coverage (happy path + at least one edge case).

## Pull requests

Use the PR template. Before requesting review:

1. `npm run compile` and `npm test` pass locally.
2. Update [`CHANGELOG.md`](CHANGELOG.md) under **Unreleased** when behavior changes.
3. If you touch `webui/src/`, commit the rebuilt `webui/main.js`.
4. Keep diffs focused; avoid drive-by refactors.

## Release runbook (maintainers)

1. Ensure `main` is green (CI: typecheck, lint, tests, bundle freshness, audit).
2. Bump `"version"` in [`package.json`](package.json).
3. Move **Unreleased** notes in [`CHANGELOG.md`](CHANGELOG.md) into a dated
   `[x.y.z]` section.
4. Commit, then tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
5. The [Release workflow](.github/workflows/release.yaml) will:
   - Build `dds-designer.vsix`
   - Attach it to a GitHub Release
   - Publish to the VS Code Marketplace (`VSCE_PAT` secret)
   - Publish to Open VSX (`OVSX_PAT` secret)

### Required repository secrets

| Secret | Purpose |
|--------|---------|
| `VSCE_PAT` | Azure DevOps Personal Access Token with **Marketplace → Manage** for publisher `mitchfiedler` |
| `OVSX_PAT` | Open VSX personal access token for the same publisher identity |

Without these secrets, the GitHub Release still uploads the VSIX and the
Marketplace / Open VSX steps print a skip message (they do not fail the job).
Configure both secrets before tagging a release you want published to the
stores.

## Code of conduct

See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Security

See [`SECURITY.md`](SECURITY.md) for private vulnerability reporting.
