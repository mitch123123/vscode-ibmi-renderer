import {
  Range,
  TextDocument,
  Uri,
  window,
  workspace,
  WorkspaceEdit,
} from "vscode";
import { openDdsView } from "./editorSwitch";

const SAVE = `Save`;
const DONT_SAVE = `Don't Save`;

/** Brief pause so a disposing webview can flush debounced edits to the host. */
export const DESIGNER_CLOSE_FLUSH_MS = 75;

export function ddsFileLabel(uri: Uri): string {
  const path = (uri.path || ``).replace(/\\/g, `/`);
  const name = path.split(`/`).filter(Boolean).pop();
  return name || `DDS file`;
}

export type DesignerCloseSnapshot = {
  uri: Uri;
  document: TextDocument;
};

/**
 * If the designer closed while the TextDocument is still dirty (VS Code did
 * not already run its save/revert prompt), ask the user what to do.
 */
export async function confirmSaveOnDesignerClose(snapshot: DesignerCloseSnapshot): Promise<void> {
  const doc = liveDocument(snapshot.uri) ?? snapshot.document;
  if (!doc.isDirty) {
    return;
  }

  const unsavedText = doc.getText();
  const choice = await window.showWarningMessage(
    `Do you want to save the changes you made to ${ddsFileLabel(snapshot.uri)}?`,
    { modal: true },
    SAVE,
    DONT_SAVE
  );

  if (choice === SAVE) {
    await persistDirtyDocument(doc, unsavedText);
    return;
  }

  if (choice === DONT_SAVE) {
    await revertDirtyDocument(doc);
    return;
  }

  // Cancel / dismiss — restore the designer so unsaved edits are not dropped.
  await openDdsView(snapshot.uri, `designer`);
  const restored = liveDocument(snapshot.uri);
  if (restored && restored.getText() !== unsavedText) {
    await workspace.applyEdit(replaceDocumentText(restored, unsavedText));
  }
}

function liveDocument(uri: Uri): TextDocument | undefined {
  return workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
}

async function persistDirtyDocument(doc: TextDocument, unsavedText: string): Promise<void> {
  if (!doc.isClosed) {
    try {
      const ok = await doc.save();
      if (ok !== false) {
        return;
      }
    } catch (e) {
      console.error(`[ibmi-renderer] Failed to save ${ddsFileLabel(doc.uri)}`, e);
    }
  }

  try {
    await workspace.fs.writeFile(doc.uri, Buffer.from(unsavedText, `utf8`));
  } catch (e) {
    console.error(`[ibmi-renderer] Failed to write ${ddsFileLabel(doc.uri)}`, e);
    void window.showErrorMessage(`Could not save ${ddsFileLabel(doc.uri)}.`);
  }
}

async function revertDirtyDocument(doc: TextDocument): Promise<void> {
  if (doc.isClosed || !doc.isDirty) {
    return;
  }
  try {
    const bytes = await workspace.fs.readFile(doc.uri);
    const diskText = Buffer.from(bytes).toString(`utf8`);
    if (doc.getText() === diskText) {
      return;
    }
    await workspace.applyEdit(replaceDocumentText(doc, diskText));
  } catch (e) {
    console.error(`[ibmi-renderer] Failed to revert ${ddsFileLabel(doc.uri)}`, e);
  }
}

function replaceDocumentText(doc: TextDocument, text: string): WorkspaceEdit {
  const edit = new WorkspaceEdit();
  const fullRange = doc.lineCount > 0
    ? new Range(
      0,
      0,
      doc.lineCount - 1,
      doc.lineAt(doc.lineCount - 1).text.length
    )
    : new Range(0, 0, 0, 0);
  edit.replace(doc.uri, fullRange, text);
  return edit;
}
