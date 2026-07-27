import { readFileSync } from "fs";
import {
  CancellationToken,
  CustomTextEditorProvider,
  EndOfLine,
  ExtensionContext,
  Position,
  Range,
  TextDocument,
  Uri,
  Webview,
  WebviewPanel,
  WorkspaceEdit,
  window,
  workspace,
} from "vscode";
import { openDdsView } from "../editorSwitch";
import { isProtectedDdsSource, protectedSourceMessage } from "../protectedSource";
import { DisplayFile, FieldInfo, splitDocumentLines } from "./dspf";
import { browseDatabaseFieldsInteractive } from "../dbBrowse";
import { VIEW_TYPE, WebviewToHostMessage } from "../shared/messages";

export { VIEW_TYPE };

const REMOTE_SCHEMES = new Set([`member`, `streamfile`, `object`]);

export class DspfDesignerProvider implements CustomTextEditorProvider {
  public static readonly viewType = VIEW_TYPE;

  private static readonly sessions = new Set<DspfDesignerSession>();
  private static remoteSessionsReadonly = false;

  constructor(private readonly context: ExtensionContext) {}

  public static register(context: ExtensionContext) {
    const provider = new DspfDesignerProvider(context);
    return window.registerCustomEditorProvider(DspfDesignerProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    });
  }

  /** Lock/unlock editing for remote (member/streamfile/object) designer sessions. */
  public static setRemoteSessionsReadonly(readonly: boolean) {
    DspfDesignerProvider.remoteSessionsReadonly = readonly;
    for (const session of DspfDesignerProvider.sessions) {
      session.applyConnectionReadonly(readonly);
    }
  }

  async resolveCustomTextEditor(
    document: TextDocument,
    webviewPanel: WebviewPanel,
    _token: CancellationToken
  ): Promise<void> {
    if (await isProtectedDdsSource(document.uri)) {
      const message = protectedSourceMessage(document.uri);
      // Close designer and fall back to the normal text editor (browse-only).
      setTimeout(() => {
        webviewPanel.dispose();
        void openDdsView(document.uri, `source`);
        void window.showWarningMessage(message);
      }, 0);
      return;
    }

    webviewPanel.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [
        this.context.extensionUri,
        Uri.joinPath(this.context.extensionUri, "webui"),
        Uri.joinPath(this.context.extensionUri, "webui", "scripts"),
      ],
    };

    webviewPanel.webview.html = this.getBaseHtml(webviewPanel.webview);

    const editor = new DspfDesignerSession(this.context, document, webviewPanel);
    DspfDesignerProvider.sessions.add(editor);
    editor.load(true);
    editor.applyConnectionReadonly(DspfDesignerProvider.remoteSessionsReadonly);

    const changeDocSub = workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        if (editor.consumeIgnoredDocumentChange()) {
          return;
        }
        editor.load(true);
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocSub.dispose();
      DspfDesignerProvider.sessions.delete(editor);
      editor.dispose();
    });
  }

  private getBaseHtml(webview: Webview) {
    const basePath = Uri.joinPath(this.context.extensionUri, "webui", "index.html");
    let content = readFileSync(basePath.fsPath, "utf-8");

    const fileVariables: Record<string, Uri> = {
      "{main}": webview.asWebviewUri(Uri.joinPath(this.context.extensionUri, "webui", "main.js")),
      "{elements}": webview.asWebviewUri(
        Uri.joinPath(this.context.extensionUri, "webui", "scripts", "vscode-elements.js")
      ),
      "{styles}": webview.asWebviewUri(Uri.joinPath(this.context.extensionUri, "webui", "styles.css")),
      "{codicon}": webview.asWebviewUri(
        Uri.joinPath(this.context.extensionUri, "webui", "scripts", "codicon.css")
      ),
      "{konva}": webview.asWebviewUri(
        Uri.joinPath(this.context.extensionUri, "webui", "scripts", "konva.min.js")
      ),
    };

    for (const [key, value] of Object.entries(fileVariables)) {
      content = content.replace(new RegExp(key, "g"), value.toString());
    }

    return content;
  }
}

class DspfDesignerSession {
  private dds: DisplayFile | undefined;
  private messageSub: { dispose(): void };
  /** Document-change events to ignore after our own WorkspaceEdit */
  private ignoreDocumentChanges = 0;
  private messageQueue: WebviewToHostMessage[] = [];
  private processingQueue = false;
  /** True when IBM i connection is down for a remote member/streamfile document */
  private connectionReadonly = false;

  /** @deprecated use consumeIgnoredDocumentChange — kept for provider compatibility */
  public get isApplyingEdit(): boolean {
    return this.ignoreDocumentChanges > 0 || this.processingQueue;
  }

  constructor(
    private readonly context: ExtensionContext,
    private document: TextDocument,
    private readonly panel: WebviewPanel
  ) {
    this.messageSub = panel.webview.onDidReceiveMessage((msg) => {
      this.messageQueue.push(msg);
      void this.drainQueue();
    });
  }

  dispose() {
    this.messageSub.dispose();
  }

  private isRemoteDocument(): boolean {
    return REMOTE_SCHEMES.has(this.document.uri.scheme);
  }

  /** Apply host-side disconnect lock; local files are never locked by IBM i state. */
  applyConnectionReadonly(readonly: boolean) {
    if (!this.isRemoteDocument()) {
      this.connectionReadonly = false;
      this.panel.webview.postMessage({ command: `connectionStatus`, connected: true });
      return;
    }
    this.connectionReadonly = readonly;
    this.panel.webview.postMessage({
      command: `connectionStatus`,
      connected: !readonly,
    });
  }

  /** Returns true if this change was caused by our edit and should be skipped. */
  consumeIgnoredDocumentChange(): boolean {
    if (this.ignoreDocumentChanges > 0) {
      this.ignoreDocumentChanges--;
      return true;
    }
    return false;
  }

  private get eol(): string {
    return this.document.eol === EndOfLine.CRLF ? `\r\n` : `\n`;
  }

  private get documentType(): "dds.dspf" | "dds.prtf" {
    const lang = this.document.languageId;
    if (lang === `dds.prtf`) {
      return `dds.prtf`;
    }
    const path = this.document.uri.path.toLowerCase();
    if (path.endsWith(`.prtf`)) {
      return `dds.prtf`;
    }
    return `dds.dspf`;
  }

  /** Inclusive start..end lines → Range that covers those lines and their trailing newlines. */
  private fullLinesRange(start: number, end: number): Range {
    const endExclusive = Math.min(end + 1, this.document.lineCount);
    return new Range(start, 0, endExclusive, 0);
  }

  load(rerender = true) {
    const content = this.document.getText();
    this.dds = new DisplayFile();
    this.dds.parse(splitDocumentLines(content));

    this.panel.webview.postMessage({
      command: rerender ? "load" : "update",
      dds: this.dds,
      documentType: this.documentType,
    });
  }

  private refreshAfterEdit(rerender: boolean) {
    this.document = workspace.textDocuments.find((d) => d.uri.toString() === this.document.uri.toString())
      ?? this.document;
    const content = this.document.getText();
    this.dds = new DisplayFile();
    this.dds.parse(splitDocumentLines(content));

    this.panel.webview.postMessage({
      command: rerender ? "load" : "update",
      dds: this.dds,
      documentType: this.documentType,
    });
  }

  private async applyEdit(edit: WorkspaceEdit): Promise<boolean> {
    // One document-change echo expected per applyEdit
    this.ignoreDocumentChanges++;
    try {
      const ok = await workspace.applyEdit(edit);
      if (!ok) {
        this.ignoreDocumentChanges = Math.max(0, this.ignoreDocumentChanges - 1);
      }
      return ok;
    } catch (e) {
      this.ignoreDocumentChanges = Math.max(0, this.ignoreDocumentChanges - 1);
      throw e;
    }
  }

  private async drainQueue() {
    if (this.processingQueue) {
      return;
    }
    this.processingQueue = true;
    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift()!;
        await this.handleMessage(message);
      }
    } finally {
      this.processingQueue = false;
    }
  }

  private async handleMessage(message: WebviewToHostMessage) {
    if (message.command === `showSource`) {
      await openDdsView(this.document.uri, `source`);
      return;
    }

    if (!this.dds) {
      return;
    }

    if (this.connectionReadonly) {
      return;
    }

    switch (message.command) {
      case "deleteField": {
        const deleteFieldRange = this.dds.getRangeForField(message.recordFormat, message.fieldName);
        if (deleteFieldRange) {
          const workspaceEdit = new WorkspaceEdit();
          workspaceEdit.delete(
            this.document.uri,
            this.fullLinesRange(deleteFieldRange.start, deleteFieldRange.end),
            { label: `Delete DDS Field`, needsConfirmation: false }
          );
          if (await this.applyEdit(workspaceEdit)) {
            this.refreshAfterEdit(true);
          }
        }
        break;
      }

      case "deleteFields": {
        const ranges = message.fieldNames
          .map((name) => this.dds!.getRangeForField(message.recordFormat, name))
          .filter((r): r is NonNullable<typeof r> => !!r)
          .sort((a, b) => b.start - a.start);

        if (ranges.length === 0) {
          break;
        }

        const workspaceEdit = new WorkspaceEdit();
        for (const range of ranges) {
          workspaceEdit.delete(
            this.document.uri,
            this.fullLinesRange(range.start, range.end),
            { label: `Delete DDS Fields`, needsConfirmation: false }
          );
        }
        if (await this.applyEdit(workspaceEdit)) {
          this.refreshAfterEdit(true);
        }
        break;
      }

      case "newField": {
        const fieldInfo = FieldInfo.fromData(message.fieldInfo);
        const newField = this.dds.updateField(message.recordFormat, undefined, fieldInfo);
        if (newField?.range) {
          const workspaceEdit = new WorkspaceEdit();
          workspaceEdit.insert(
            this.document.uri,
            new Position(newField.range.start, 0),
            newField.newLines.join(this.eol) + this.eol,
            { label: `Add DDS Field`, needsConfirmation: false }
          );
          if (await this.applyEdit(workspaceEdit)) {
            this.refreshAfterEdit(true);
          }
        }
        break;
      }

      case "updateField": {
        const fieldInfo = FieldInfo.fromData(message.fieldInfo);
        const fieldUpdate = this.dds.updateField(
          message.recordFormat,
          message.originalFieldName,
          fieldInfo
        );
        if (fieldUpdate?.range) {
          const workspaceEdit = new WorkspaceEdit();
          workspaceEdit.replace(
            this.document.uri,
            this.fullLinesRange(fieldUpdate.range.start, fieldUpdate.range.end),
            fieldUpdate.newLines.join(this.eol) + this.eol,
            { label: `Update DDS Field`, needsConfirmation: false }
          );
          if (await this.applyEdit(workspaceEdit)) {
            this.refreshAfterEdit(false);
          }
        }
        break;
      }

      case "updateFields": {
        const prepared = message.updates
          .map((u) => {
            const fieldInfo = FieldInfo.fromData(u.fieldInfo);
            const update = this.dds!.updateField(message.recordFormat, u.originalFieldName, fieldInfo);
            return update?.range ? { update, originalFieldName: u.originalFieldName } : undefined;
          })
          .filter((x): x is NonNullable<typeof x> => !!x)
          .sort((a, b) => b.update.range!.start - a.update.range!.start);

        if (prepared.length === 0) {
          break;
        }

        const workspaceEdit = new WorkspaceEdit();
        for (const item of prepared) {
          workspaceEdit.replace(
            this.document.uri,
            this.fullLinesRange(item.update.range!.start, item.update.range!.end),
            item.update.newLines.join(this.eol) + this.eol,
            { label: `Update DDS Fields`, needsConfirmation: false }
          );
        }
        // One applyEdit → typically one coalesced change event
        if (await this.applyEdit(workspaceEdit)) {
          this.refreshAfterEdit(false);
        }
        break;
      }

      case "updateFormat": {
        const formatUpdate = this.dds.updateFormatHeader(message.recordFormat, message.newKeywords);
        if (formatUpdate?.range) {
          const { start, end } = formatUpdate.range;
          const text = formatUpdate.newLines.length > 0
            ? formatUpdate.newLines.join(this.eol) + this.eol
            : ``;
          const workspaceEdit = new WorkspaceEdit();
          // end < start → insert before `start` (empty VS Code range)
          workspaceEdit.replace(
            this.document.uri,
            this.fullLinesRange(start, end < start ? start - 1 : end),
            text,
            { label: `Update DDS Format`, needsConfirmation: false }
          );
          if (await this.applyEdit(workspaceEdit)) {
            this.refreshAfterEdit(true);
          }
        }
        break;
      }

      case "newFormats": {
        const insert = this.dds.insertFormats(message.formats || []);
        if (insert?.range) {
          const workspaceEdit = new WorkspaceEdit();
          workspaceEdit.insert(
            this.document.uri,
            new Position(insert.range.start, 0),
            insert.newLines.join(this.eol) + this.eol,
            { label: `Add DDS Record Format`, needsConfirmation: false }
          );
          if (await this.applyEdit(workspaceEdit)) {
            this.refreshAfterEdit(true);
          }
        }
        break;
      }

      case "deleteFormat": {
        const del = this.dds.deleteFormat(message.recordFormat);
        if (del?.range) {
          const workspaceEdit = new WorkspaceEdit();
          workspaceEdit.delete(
            this.document.uri,
            this.fullLinesRange(del.range.start, del.range.end),
            { label: `Delete DDS Record Format`, needsConfirmation: false }
          );
          if (await this.applyEdit(workspaceEdit)) {
            this.refreshAfterEdit(true);
          }
        }
        break;
      }

      case "renameFormat": {
        const renamed = this.dds.renameFormat(message.recordFormat, message.newName);
        if (renamed?.range) {
          const workspaceEdit = new WorkspaceEdit();
          workspaceEdit.replace(
            this.document.uri,
            this.fullLinesRange(renamed.range.start, renamed.range.end),
            renamed.newLines.join(this.eol) + (renamed.newLines.length ? this.eol : ``),
            { label: `Rename DDS Record Format`, needsConfirmation: false }
          );
          if (await this.applyEdit(workspaceEdit)) {
            this.refreshAfterEdit(true);
          }
        }
        break;
      }

      case "copyFormat": {
        const copied = this.dds.copyFormat(message.recordFormat, message.newName);
        if (copied?.range) {
          const workspaceEdit = new WorkspaceEdit();
          workspaceEdit.insert(
            this.document.uri,
            new Position(copied.range.start, 0),
            copied.newLines.join(this.eol) + this.eol,
            { label: `Copy DDS Record Format`, needsConfirmation: false }
          );
          if (await this.applyEdit(workspaceEdit)) {
            this.refreshAfterEdit(true);
          }
        }
        break;
      }

      case "browseDatabaseFields": {
        const result = await browseDatabaseFieldsInteractive({
          library: message.library,
          file: message.file,
        });
        if (!result) {
          break;
        }
        this.panel.webview.postMessage({
          command: `databaseFields`,
          library: result.library,
          file: result.file,
          recordFormat: result.recordFormat,
          fields: result.fields,
          error: result.error,
        });
        break;
      }

      case "placeDatabaseFields": {
        const format = this.dds.formats.find((f) => f.name === message.recordFormat);
        if (!format || !message.fields?.length) {
          break;
        }
        const newLines: string[] = [];
        for (const f of message.fields) {
          newLines.push(...DisplayFile.getLinesForField(FieldInfo.fromData(f)));
        }
        const workspaceEdit = new WorkspaceEdit();
        workspaceEdit.insert(
          this.document.uri,
          new Position(format.range.end, 0),
          newLines.join(this.eol) + this.eol,
          { label: `Add Database Fields`, needsConfirmation: false }
        );
        if (await this.applyEdit(workspaceEdit)) {
          this.refreshAfterEdit(true);
        }
        break;
      }
    }
  }
}
