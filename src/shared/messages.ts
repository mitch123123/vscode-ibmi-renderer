import type { FieldInfoData, Keyword } from "./dspf-types";

/** Inclusive 0-based line span to select in the text editor after opening source. */
export interface SourceRevealLines {
  startLine: number;
  endLine: number;
}

/** Messages from extension host → webview */
export type HostToWebviewMessage =
  | {
      command: "load";
      dds: unknown;
      documentType: "dds.dspf" | "dds.prtf";
      /** Select this record-format tab after load (e.g. CodeLens Edit). */
      selectFormat?: string;
    }
  | { command: "update"; dds: unknown; documentType: "dds.dspf" | "dds.prtf" }
  | { command: "connectionStatus"; connected: boolean }
  | {
      command: "databaseFields";
      library: string;
      file: string;
      recordFormat: string;
      fields: Array<{
        name: string;
        type: string;
        length: number;
        decimals: number;
        heading?: string;
      }>;
      error?: string;
    }
  | { command: "editFailed"; reason: string }
  | { command: "showError"; message: string }
  | { command: "requestInputResult"; requestId: string; value?: string }
  | { command: "requestConfirmResult"; requestId: string; confirmed: boolean }
  /** Switch to Design mode and activate the named record-format tab. */
  | { command: "selectFormat"; recordFormat: string }
  /** Ask the webview to immediately send any debounced nudge edits. */
  | { command: "flushPendingEdits" };

/** Messages from webview → extension host */
export type WebviewToHostMessage =
  | { command: "deleteField"; recordFormat: string; fieldName: string }
  | { command: "deleteFields"; recordFormat: string; fieldNames: string[] }
  | { command: "newField"; recordFormat: string; fieldInfo: FieldInfoData }
  | { command: "newFields"; recordFormat: string; fields: FieldInfoData[] }
  | { command: "updateField"; recordFormat: string; originalFieldName: string; fieldInfo: FieldInfoData }
  | {
      command: "updateFields";
      recordFormat: string;
      updates: Array<{ originalFieldName: string; fieldInfo: FieldInfoData }>;
    }
  | { command: "updateFormat"; recordFormat: string; newKeywords: Keyword[] }
  | {
      command: "newFormats";
      formats: Array<{ name: string; keywords?: Keyword[] }>;
      selectFormat?: string;
    }
  | { command: "deleteFormat"; recordFormat: string }
  | { command: "renameFormat"; recordFormat: string; newName: string }
  | { command: "copyFormat"; recordFormat: string; newName: string }
  | {
      command: "browseDatabaseFields";
      library?: string;
      file?: string;
      recordFormat?: string;
    }
  | {
      command: "placeDatabaseFields";
      recordFormat: string;
      fields: FieldInfoData[];
    }
  | {
      command: "requestInput";
      requestId: string;
      title: string;
      value?: string;
      prompt?: string;
      validate?: "recordName";
    }
  | {
      command: "requestConfirm";
      requestId: string;
      message: string;
      confirmLabel?: string;
    }
  | {
      command: "showError";
      message: string;
    }
  /** Open/focus the DDS text editor and select these inclusive 0-based lines. */
  | {
      command: "revealInSource";
      startLine: number;
      endLine: number;
    };

/** Upstream Code for IBM i designer. Kept so menus/CodeLens do not collide when both are installed. */
export const UPSTREAM_VIEW_TYPE = "ibmi.dspfDesigner";

export const VIEW_TYPE = "mitchfiedler.dspfDesigner";

export const COMMANDS = {
  launchRenderer: "mitchfiedler.ddsDesigner.launchRenderer",
  editRecordFormat: "mitchfiedler.ddsDesigner.editRecordFormat",
  showSource: "mitchfiedler.ddsDesigner.showSource",
  toggleEditorView: "mitchfiedler.ddsDesigner.toggleEditorView",
} as const;
