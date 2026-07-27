import * as vscode from "vscode";
import { VIEW_TYPE } from "./shared/messages";

export type EditorViewMode = "designer" | "source";

/** URIs currently being switched by openDdsView — skip auto-enforce for these. */
const switchingUris = new Set<string>();

function sameUri(a: vscode.Uri, b: vscode.Uri): boolean {
  return a.toString() === b.toString();
}

function isDesignerTab(tab: vscode.Tab): boolean {
  return tab.input instanceof vscode.TabInputCustom && tab.input.viewType === VIEW_TYPE;
}

function isTextTab(tab: vscode.Tab): boolean {
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
 * Ensures only one editor kind is open for that URI at a time.
 * Returns false if the user cancelled a dirty-tab save prompt (toggle aborted).
 */
export async function openDdsView(uri: vscode.Uri, mode: EditorViewMode): Promise<boolean> {
  const key = uri.toString();
  const existing = tabsForUri(uri);
  const column =
    existing[0]?.group.viewColumn ??
    vscode.window.tabGroups.activeTabGroup.viewColumn ??
    vscode.ViewColumn.Active;

  switchingUris.add(key);
  try {
    // Close the opposite view first. If the tab is dirty and the user hits Cancel
    // on the save dialog, close() returns false — abort without opening the other view.
    const closed = await closeOppositeDdsTabs(uri, mode);
    if (!closed) {
      return false;
    }

    await vscode.commands.executeCommand(
      `vscode.openWith`,
      uri,
      mode === `designer` ? VIEW_TYPE : `default`,
      { viewColumn: column, preview: false }
    );

    // Clean up any leftover opposite tabs (should already be gone)
    const closedAgain = await closeOppositeDdsTabs(uri, mode);
    if (!closedAgain) {
      // Rare: opposite reappeared dirty / cancel on second close — revert new view
      await closeTabsOfKind(uri, mode);
      return false;
    }

    const sameKind = tabsForUri(uri)
      .filter(({ tab }) => (mode === `designer` ? isDesignerTab(tab) : isTextTab(tab)))
      .map(({ tab }) => tab);
    if (sameKind.length > 1) {
      await vscode.window.tabGroups.close(sameKind.slice(1));
    }

    return true;
  } finally {
    switchingUris.delete(key);
  }
}

export function isSwitchingDdsView(uri: vscode.Uri): boolean {
  return switchingUris.has(uri.toString());
}

/**
 * Close text tabs when opening designer, or designer tabs when opening source.
 * @returns false if the user cancelled closing a dirty tab
 */
export async function closeOppositeDdsTabs(uri: vscode.Uri, mode: EditorViewMode): Promise<boolean> {
  const opposite = tabsForUri(uri)
    .filter(({ tab }) => (mode === `designer` ? isTextTab(tab) : isDesignerTab(tab)))
    .map(({ tab }) => tab);
  if (opposite.length === 0) {
    return true;
  }
  return vscode.window.tabGroups.close(opposite);
}

async function closeTabsOfKind(uri: vscode.Uri, mode: EditorViewMode): Promise<void> {
  const tabs = tabsForUri(uri)
    .filter(({ tab }) => (mode === `designer` ? isDesignerTab(tab) : isTextTab(tab)))
    .map(({ tab }) => tab);
  if (tabs.length > 0) {
    await vscode.window.tabGroups.close(tabs);
  }
}
