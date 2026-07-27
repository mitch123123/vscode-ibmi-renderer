import * as vscode from "vscode";

const DESIGNER_EXTENSIONS = new Set([
  `dspf`,
  `prtf`,
  `dspf38`,
  `prtf38`,
]);

/** Loose shape of Code for IBM i Object Browser / IFS Browser tree nodes. */
export type BrowserNode = {
  path?: string;
  resourceUri?: vscode.Uri;
  filter?: string | { name?: string; protected?: boolean };
  protected?: boolean;
  parent?: BrowserNode;
  member?: {
    asp?: string;
    library: string;
    file: string;
    name: string;
    extension: string;
  };
};

function isDesignerExtension(ext: string | undefined): boolean {
  if (!ext) {
    return false;
  }
  return DESIGNER_EXTENSIONS.has(ext.replace(/^\./, ``).toLowerCase());
}

function extensionFromPath(path: string): string | undefined {
  const base = path.split(`/`).pop() ?? path;
  const dot = base.lastIndexOf(`.`);
  if (dot <= 0 || dot === base.length - 1) {
    return undefined;
  }
  return base.slice(dot + 1);
}

/**
 * Resolve a URI suitable for `vscode.openWith` from:
 * - a plain Uri (command palette / editor title / explorer)
 * - Code for IBM i Object Browser member nodes
 * - Code for IBM i IFS Browser streamfile nodes
 */
export function resolveDesignerUri(arg?: unknown): vscode.Uri | undefined {
  if (!arg) {
    return vscode.window.activeTextEditor?.document.uri;
  }

  if (arg instanceof vscode.Uri) {
    return arg;
  }

  const node = arg as BrowserNode;

  if (node.resourceUri instanceof vscode.Uri) {
    return node.resourceUri;
  }

  if (node.member?.library && node.member.file && node.member.name) {
    const ext = (node.member.extension || ``).replace(/^\./, ``);
    if (ext && !isDesignerExtension(ext)) {
      return undefined;
    }
    const memberName = ext ? `${node.member.name}.${ext}` : node.member.name;
    const path = node.member.asp
      ? `/${node.member.asp}/${node.member.library}/${node.member.file}/${memberName}`
      : `/${node.member.library}/${node.member.file}/${memberName}`;
    return vscode.Uri.from({ scheme: `member`, path });
  }

  if (typeof node.path === `string` && node.path.length > 0) {
    const ext = extensionFromPath(node.path);
    if (ext && !isDesignerExtension(ext)) {
      return undefined;
    }
    if (node.path.startsWith(`/`)) {
      return vscode.Uri.from({ scheme: `streamfile`, path: node.path });
    }
  }

  return undefined;
}

export function asBrowserNode(arg?: unknown): BrowserNode | undefined {
  if (!arg || arg instanceof vscode.Uri) {
    return undefined;
  }
  return arg as BrowserNode;
}

export function uriLooksLikeDesignerSource(uri: vscode.Uri): boolean {
  const ext = extensionFromPath(uri.path);
  if (isDesignerExtension(ext)) {
    return true;
  }
  const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  return open?.languageId === `dds.dspf` || open?.languageId === `dds.prtf`;
}
