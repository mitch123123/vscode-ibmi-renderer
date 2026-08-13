import * as vscode from "vscode";
import { VIEW_TYPE } from "./shared/messages";
import type { SourceRevealLines } from "./shared/messages";

export type EditorViewMode = "designer" | "source";

export interface OpenDdsViewOptions {
  /** When opening source, select and reveal these inclusive 0-based lines. */
  revealLines?: SourceRevealLines;
}

function sameUri(a: vscode.Uri, b: vscode.Uri): boolean {
  return a.toString() === b.toString();
}

export function isDesignerTab(tab: vscode.Tab): boolean {
  return tab.input instanceof vscode.TabInputCustom && tab.input.viewType === VIEW_TYPE;
}

export function isTextTab(tab: vscode.Tab): boolean {
  return tab.input instanceof vscode.TabInputText;
}

function tabsForUri(uri: vscode.Uri): { tab: vscode.Tab; group: vscode.TabGroup }[] {
  const found: { tab: vscode.Tab; group: vscode.TabGroup }[] = [];
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputText && sameUri(tab.input.uri, uri)) {
        found.push({ tab, group });
      } else if (
        tab.input instanceof vscode.TabInputCustom &&
        sameUri(tab.input.uri, uri)
      ) {
        found.push({ tab, group });
      }
    }
  }
  return found;
}

/**
 * Open the DDS file as designer or default text editor.
 * Does not close the other kind — designer and text may stay open side by side
 * and stay in sync through the shared TextDocument.
 */
export async function openDdsView(
  uri: vscode.Uri,
  mode: EditorViewMode,
  options?: OpenDdsViewOptions
): Promise<boolean> {
  const existing = tabsForUri(uri);
  const sameKind = existing.filter(({ tab }) =>
    mode === `designer` ? isDesignerTab(tab) : isTextTab(tab)
  );
  const opposite = existing.filter(({ tab }) =>
    mode === `designer` ? isTextTab(tab) : isDesignerTab(tab)
  );

  let column: vscode.ViewColumn;
  if (sameKind.length > 0) {
    column = sameKind[0].group.viewColumn ?? vscode.ViewColumn.Active;
  } else if (opposite.length > 0) {
    column = vscode.ViewColumn.Beside;
  } else {
    column =
      existing[0]?.group.viewColumn ??
      vscode.window.tabGroups.activeTabGroup.viewColumn ??
      vscode.ViewColumn.Active;
  }

  await vscode.commands.executeCommand(
    `vscode.openWith`,
    uri,
    mode === `designer` ? VIEW_TYPE : `default`,
    { viewColumn: column, preview: false }
  );

  const after = tabsForUri(uri)
    .filter(({ tab }) => (mode === `designer` ? isDesignerTab(tab) : isTextTab(tab)))
    .map(({ tab }) => tab);
  if (after.length > 1) {
    await vscode.window.tabGroups.close(after.slice(1));
  }

  if (mode === `source` && options?.revealLines) {
    await revealSourceLines(uri, options.revealLines);
  }

  return true;
}

export async function revealSourceLines(uri: vscode.Uri, lines: SourceRevealLines): Promise<void> {
  if (!Number.isInteger(lines.startLine) || !Number.isInteger(lines.endLine)) {
    return;
  }
  if (lines.startLine < 0 || lines.endLine < lines.startLine) {
    return;
  }

  const document = await vscode.workspace.openTextDocument(uri);
  if (document.lineCount === 0) {
    return;
  }

  const startLine = Math.min(lines.startLine, document.lineCount - 1);
  const endLine = Math.min(Math.max(lines.endLine, startLine), document.lineCount - 1);
  const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);

  const existingText = tabsForUri(uri).find(({ tab }) => isTextTab(tab));
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false,
    viewColumn: existingText?.group.viewColumn,
  });
  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}
