# Security Policy

## Supported versions

Security fixes are applied to the latest release on `main` and published via
GitHub Releases / Marketplace / Open VSX when practical.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Prefer one of:

1. **[GitHub Security Advisories](https://github.com/codefori/vscode-ibmi-renderer/security/advisories/new)**
   for this repository (private disclosure).
2. Contact the Code for IBM i / Halcyon maintainers through the
   [codefori](https://github.com/codefori) organization if advisories are
   unavailable.

Include:

- VS Code version and OS
- Extension version (or commit)
- Whether the DDS file was local or remote (`member` / `streamfile`)
- Steps to reproduce and impact (e.g. unexpected source mutation, dialog spoofing)

We will acknowledge reports as soon as maintainers can triage them and
coordinate a fix and disclosure timeline.

## Scope notes

This extension:

- Runs a **scripted custom editor webview** with a Content Security Policy and
  host-side validation of edit messages before applying `WorkspaceEdit`s.
- Does **not** store IBM i credentials; remote auth is owned by
  [Code for IBM i](https://marketplace.visualstudio.com/items?itemName=HalcyonTechLtd.code-for-ibmi).
- Issues SQL against `QSYS2.SYSCOLUMNS` only through Code for IBM i `runSQL`,
  with identifier validation — reports about SQL injection or privilege
  escalation via that path are in scope for this repo when they involve our
  query construction.
