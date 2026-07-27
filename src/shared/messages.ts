import type { FieldInfoData, Keyword } from "./dspf-types";

/** Messages from extension host → webview */
export type HostToWebviewMessage =
  | { command: "load"; dds: unknown; documentType: "dds.dspf" | "dds.prtf" }
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
    };

/** Messages from webview → extension host */
export type WebviewToHostMessage =
  | { command: "showSource" }
  | { command: "deleteField"; recordFormat: string; fieldName: string }
  | { command: "deleteFields"; recordFormat: string; fieldNames: string[] }
  | { command: "newField"; recordFormat: string; fieldInfo: FieldInfoData }
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
      /** Format to select after insert (webview also tracks this locally). */
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
    };

export const VIEW_TYPE = "ibmi.dspfDesigner";
