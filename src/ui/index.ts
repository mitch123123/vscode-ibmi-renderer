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
import { confirmSaveOnDesignerClose, DESIGNER_CLOSE_FLUSH_MS } from "../unsavedChanges";
import { isProtectedDdsSource, protectedSourceMessage } from "../protectedSource";
import { DisplayFile, FieldInfo, splitDocumentLines } from "./dspf";
import { browseDatabaseFieldsInteractive, DbFieldDef, fetchFileFieldsByName } from "../dbBrowse";
import { VIEW_TYPE, WebviewToHostMessage } from "../shared/messages";
import { isValidRecordName, RECORD_NAME_HINT, uniquifyNewFieldNames } from "../shared/recordName";
import { validateFieldEditPayload, validateFormatKeywords, sanitizeDialogString } from "../shared/editValidation";
import type { DdsUpdate } from "../shared/dspf-types";

export { VIEW_TYPE };

const REMOTE_SCHEMES = new Set([`member`, `streamfile`, `object`]);

/**
 * Tab label for the designer custom editor.
 * VS Code 1.106+ honors `WebviewPanel.title` on custom editors; older builds keep the filename.
 */
export function designerTabTitle(resourcePath: string): string {
  const name = resourcePath.replace(/\\/g, `/`).split(`/`).filter(Boolean).pop() || `DDS`;
  return `${name} [IBM i DDS]`;
}

function applyDesignerTabIdentity(webviewPanel: WebviewPanel, document: TextDocument, extensionUri: Uri): void {
  webviewPanel.title = designerTabTitle(document.uri.path);
  webviewPanel.iconPath = {
    light: Uri.joinPath(extensionUri, `media`, `designer-tab-light.svg`),
    dark: Uri.joinPath(extensionUri, `media`, `designer-tab-dark.svg`),
  };
}

/**
 * Parse a DDS file spec (as it appears inside `REF(...)` or as the second
 * token of `REFFLD(...)`) into a library / file pair.
 *
 * Accepts `LIBRARY/FILE`, `*LIBL/FILE`, bare `FILE`, and returns `undefined`
 * for special values we can't resolve (`*SRC`). Any trailing tokens
 * (record-format name on REF) are ignored — SYSCOLUMNS is keyed by file.
 */
function parseFileSpec(raw: string | undefined): { library?: string; file: string } | undefined {
  const value = (raw || ``).trim();
  if (!value) {
    return undefined;
  }
  // First whitespace-delimited token holds the file spec; drop trailing
  // record-format-name / other tokens.
  const first = value.split(/\s+/)[0];
  if (!first || first.toUpperCase() === `*SRC`) {
    return undefined;
  }
  const slash = first.indexOf(`/`);
  if (slash < 0) {
    return { file: first };
  }
  const library = first.substring(0, slash);
  const file = first.substring(slash + 1);
  if (!file) {
    return undefined;
  }
  return { library, file };
}

/**
 * Compute the SYSCOLUMNS lookup coordinates (library, file, target field
 * name) for a reference field, combining REFFLD (field-level) with the
 * file-level REF default.
 *
 * Returns `undefined` when we have no file to look up against — e.g. a bare
 * `R` field with no REF and no REFFLD.
 */
function parseReferenceTarget(
  field: FieldInfo,
  defaultRef: { library?: string; file: string } | undefined
): { library: string | undefined; file: string; lookupName: string } | undefined {
  const own = (field.name || ``).trim().toUpperCase();
  const raw = (field.reference || ``).trim();

  let refName = own;
  let fileSpec = defaultRef;

  if (raw) {
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      const first = parts[0];
      if (first.toUpperCase() !== `*SRC` && first !== `*N`) {
        refName = first.toUpperCase();
      }
    }
    if (parts.length > 1) {
      const parsed = parseFileSpec(parts.slice(1).join(` `));
      if (parsed) {
        fileSpec = parsed;
      }
    }
  }

  if (!refName || !fileSpec) {
    return undefined;
  }

  return {
    library: fileSpec.library,
    file: fileSpec.file,
    lookupName: refName,
  };
}

export class DspfDesignerProvider implements CustomTextEditorProvider {
  public static readonly viewType = VIEW_TYPE;

  private static readonly sessions = new Set<DspfDesignerSession>();
  private static remoteSessionsReadonly = false;
  /** Format to select when a designer session is next created for a URI. */
  private static readonly pendingSelectFormatByUri = new Map<string, string>();

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

  /**
   * Remember which record format to activate when the designer opens for `uri`.
   * Used when opening the designer from CodeLens Edit.
   */
  public static setPendingSelectFormat(uri: Uri, formatName: string): void {
    const name = (formatName || ``).trim();
    if (!name) {
      return;
    }
    DspfDesignerProvider.pendingSelectFormatByUri.set(uri.toString(), name);
  }

  /**
   * Select a record format in a live designer session.
   * Returns true when a session handled the request.
   */
  public static requestSelectFormat(uri: Uri, formatName: string): boolean {
    const name = (formatName || ``).trim();
    if (!name) {
      return false;
    }
    for (const session of DspfDesignerProvider.sessions) {
      if (session.documentUri.toString() === uri.toString()) {
        DspfDesignerProvider.pendingSelectFormatByUri.delete(uri.toString());
        session.selectFormat(name);
        return true;
      }
    }
    return false;
  }

  private static takePendingSelectFormat(uri: Uri): string | undefined {
    const key = uri.toString();
    const name = DspfDesignerProvider.pendingSelectFormatByUri.get(key);
    if (name) {
      DspfDesignerProvider.pendingSelectFormatByUri.delete(key);
    }
    return name;
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

    applyDesignerTabIdentity(webviewPanel, document, this.context.extensionUri);

    webviewPanel.webview.options = {
      enableScripts: true,
      enableCommandUris: false,
      localResourceRoots: [
        Uri.joinPath(this.context.extensionUri, "webui"),
      ],
    };

    webviewPanel.webview.html = this.getBaseHtml(webviewPanel.webview);

    const editor = new DspfDesignerSession(this.context, document, webviewPanel);
    DspfDesignerProvider.sessions.add(editor);
    const pendingSelect = DspfDesignerProvider.takePendingSelectFormat(document.uri);
    if (pendingSelect) {
      editor.setPendingSelectFormat(pendingSelect);
    }
    editor.load(true);
    editor.applyConnectionReadonly(DspfDesignerProvider.remoteSessionsReadonly);

    /** Coalesce rapid text-editor keystrokes into one designer reload. */
    let externalReloadTimer: ReturnType<typeof setTimeout> | undefined;
    const EXTERNAL_RELOAD_MS = 150;

    const changeDocSub = workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        if (editor.consumeIgnoredDocumentChange()) {
          return;
        }
        if (externalReloadTimer) {
          clearTimeout(externalReloadTimer);
        }
        externalReloadTimer = setTimeout(() => {
          externalReloadTimer = undefined;
          editor.load(true);
        }, EXTERNAL_RELOAD_MS);
      }
    });

    const viewStateSub = webviewPanel.onDidChangeViewState((e) => {
      if (!e.webviewPanel.visible) {
        editor.requestFlushPendingEdits();
      }
    });

    webviewPanel.onDidDispose(() => {
      if (externalReloadTimer) {
        clearTimeout(externalReloadTimer);
        externalReloadTimer = undefined;
      }
      const snapshot = { uri: editor.documentUri, document: editor.textDocument };
      changeDocSub.dispose();
      viewStateSub.dispose();
      DspfDesignerProvider.sessions.delete(editor);
      void (async () => {
        editor.requestFlushPendingEdits();
        await delay(DESIGNER_CLOSE_FLUSH_MS);
        await editor.waitUntilIdle();
        editor.dispose();
        await editor.waitUntilIdle();
        await confirmSaveOnDesignerClose(snapshot);
      })();
    });
  }

  private getBaseHtml(webview: Webview) {
    const basePath = Uri.joinPath(this.context.extensionUri, "webui", "index.html");
    let content = readFileSync(basePath.fsPath, "utf-8");

    const nonce = getWebviewNonce();
    const csp = [
      `default-src 'none'`,
      `script-src 'nonce-${nonce}' ${webview.cspSource}`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} data:`,
    ].join(`; `);

    const replacements: Record<string, string> = {
      "{csp}": csp,
      "{nonce}": nonce,
      "{main}": webview.asWebviewUri(Uri.joinPath(this.context.extensionUri, "webui", "main.js")).toString(),
      "{elements}": webview
        .asWebviewUri(Uri.joinPath(this.context.extensionUri, "webui", "scripts", "vscode-elements.js"))
        .toString(),
      "{styles}": webview.asWebviewUri(Uri.joinPath(this.context.extensionUri, "webui", "styles.css")).toString(),
      "{codicon}": webview
        .asWebviewUri(Uri.joinPath(this.context.extensionUri, "webui", "scripts", "codicon.css"))
        .toString(),
      "{konva}": webview
        .asWebviewUri(Uri.joinPath(this.context.extensionUri, "webui", "scripts", "konva.min.js"))
        .toString(),
    };

    for (const [key, value] of Object.entries(replacements)) {
      content = content.replace(new RegExp(key.replace(/[{}]/g, `\\$&`), "g"), value);
    }

    return content;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWebviewNonce(): string {
  const chars = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`;
  let nonce = ``;
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
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
  /**
   * Cache of SYSCOLUMNS lookups keyed by `LIB/FILE` (or just `FILE` when the
   * library is unknown). `null` means the lookup was attempted and failed (or
   * returned no columns) — we memo that so we don't hammer the host on every
   * reparse when a REF target simply doesn't exist.
   */
  private refFileCache = new Map<string, Map<string, DbFieldDef> | null>();
  private refResolveGeneration = 0;
  private disposed = false;
  /** Consumed by the next `load` so CodeLens Edit can open on a specific format. */
  private pendingSelectFormat: string | undefined;
  /** `TextDocument.version` last parsed into `this.dds`. */
  private parsedDocumentVersion: number | undefined;

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
      if (this.disposed) {
        return;
      }
      this.messageQueue.push(msg);
      void this.drainQueue();
    });
  }

  get documentUri(): Uri {
    return this.document.uri;
  }

  get textDocument(): TextDocument {
    return this.document;
  }

  /** Ask the webview to immediately send any debounced nudge edits. */
  requestFlushPendingEdits() {
    try {
      this.panel.webview.postMessage({ command: `flushPendingEdits` });
    } catch {
      // Panel may already be gone (dispose-time flush).
    }
  }

  /**
   * Wait until the in-flight webview message queue has drained.
   * After dispose, only wait for an apply already inside `handleMessage`.
   */
  async waitUntilIdle(): Promise<void> {
    const deadline = Date.now() + 2000;
    while (this.processingQueue || (!this.disposed && this.messageQueue.length > 0)) {
      if (Date.now() >= deadline) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  /** Queue a format selection for the next `load`, and/or notify a live webview. */
  setPendingSelectFormat(formatName: string) {
    const name = (formatName || ``).trim();
    if (!name) {
      return;
    }
    this.pendingSelectFormat = name;
  }

  /** Switch the webview to Design mode and activate the named record format. */
  selectFormat(formatName: string) {
    const name = (formatName || ``).trim();
    if (!name) {
      return;
    }
    this.pendingSelectFormat = name;
    this.panel.webview.postMessage({ command: `selectFormat`, recordFormat: name });
  }

  dispose() {
    this.disposed = true;
    this.refResolveGeneration++;
    this.messageQueue.length = 0;
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
    const wasReadonly = this.connectionReadonly;
    this.connectionReadonly = readonly;
    this.panel.webview.postMessage({
      command: `connectionStatus`,
      connected: !readonly,
    });
    if (wasReadonly && !readonly) {
      this.refFileCache.clear();
      void this.resolveReferenceFieldLengths();
    }
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

  /** Field names already present on a record format (including TEXT* constants). */
  private existingFieldNames(recordFormat: string): string[] {
    const format = this.dds?.findFormat(recordFormat);
    if (!format) {
      return [];
    }
    return format.fields.map((f) => f.name).filter((n): n is string => !!n);
  }

  /**
   * Auto-increment colliding names on incoming fields so a new FIELD1 / REFFLD
   * never overwrites an existing field's DDS source (lookups are by name).
   */
  private uniquifyIncomingFields(
    recordFormat: string,
    fields: Array<{ name?: string; displayType?: string }>,
  ): void {
    uniquifyNewFieldNames(fields, this.existingFieldNames(recordFormat));
  }

  /**
   * Insert DDS lines at a 0-based line index. When the index is past EOF
   * (common when the file has no trailing newline), append after the last
   * line with a leading EOL so text is not concatenated onto that line.
   */
  private insertLinesAt(
    workspaceEdit: WorkspaceEdit,
    lineIndex: number,
    newLines: string[],
    label: string
  ) {
    const body = newLines.join(this.eol) + this.eol;
    if (this.document.lineCount === 0) {
      workspaceEdit.insert(this.document.uri, new Position(0, 0), body, {
        label,
        needsConfirmation: false,
      });
      return;
    }
    if (lineIndex >= this.document.lineCount) {
      const last = this.document.lineCount - 1;
      const lastLine = this.document.lineAt(last);
      workspaceEdit.insert(
        this.document.uri,
        new Position(last, lastLine.text.length),
        this.eol + body,
        { label, needsConfirmation: false }
      );
      return;
    }
    workspaceEdit.insert(this.document.uri, new Position(lineIndex, 0), body, {
      label,
      needsConfirmation: false,
    });
  }

  load(rerender = true) {
    this.parseDocument();

    const selectFormat = this.pendingSelectFormat;
    this.pendingSelectFormat = undefined;

    this.panel.webview.postMessage({
      command: rerender ? "load" : "update",
      dds: this.dds,
      documentType: this.documentType,
      ...(selectFormat ? { selectFormat } : {}),
    });
    void this.resolveReferenceFieldLengths();
  }

  private refreshAfterEdit(rerender: boolean, selectFormat?: string) {
    this.parseDocument();

    this.panel.webview.postMessage({
      command: rerender ? "load" : "update",
      dds: this.dds,
      documentType: this.documentType,
      ...(selectFormat ? { selectFormat } : {}),
    });
    void this.resolveReferenceFieldLengths();
  }

  /** Reparse `this.dds` from the live TextDocument and record its version. */
  private parseDocument() {
    this.document = workspace.textDocuments.find((d) => d.uri.toString() === this.document.uri.toString())
      ?? this.document;
    this.dds = new DisplayFile();
    this.dds.parse(splitDocumentLines(this.document.getText()));
    this.parsedDocumentVersion = this.document.version;
  }

  /**
   * If the TextDocument changed since the last parse (side-by-side source
   * edits during the 150ms webview reload debounce), refresh `this.dds`
   * so WorkspaceEdit ranges match the live file.
   */
  private syncModelFromDocument() {
    if (this.dds && this.document.version === this.parsedDocumentVersion) {
      return;
    }
    this.parseDocument();
  }

  /**
   * Reject renaming a named field onto another named field on the same format.
   * Constants and empty names are allowed (they do not occupy the DDS name column uniquely).
   */
  private fieldRenameCollision(
    recordFormat: string,
    originalFieldName: string,
    fieldInfo: { name?: string; displayType?: string },
  ): string | undefined {
    if (fieldInfo.displayType === `const` || !fieldInfo.name) {
      return undefined;
    }
    const next = fieldInfo.name.trim().toUpperCase();
    const orig = originalFieldName.trim().toUpperCase();
    if (!next || next === orig) {
      return undefined;
    }
    const taken = this.existingFieldNames(recordFormat).map((n) => n.toUpperCase());
    if (taken.includes(next)) {
      return `Cannot rename ${orig} to ${next}: a field with that name already exists.`;
    }
    return undefined;
  }

  /**
   * Resolve display length for reference fields whose DDS source leaves the
   * length column blank (type R with no explicit length). Uses SYSCOLUMNS via
   * Code for IBM i; skips silently when unavailable so the designer still
   * works offline (fields just keep their previously-rendered width of 1).
   *
   * The `field.length` model value is **not** mutated — we only populate the
   * side-channel `resolvedLength` so round-trip emission keeps the source
   * column blank.
   */
  private async resolveReferenceFieldLengths(): Promise<void> {
    if (!this.dds) {
      return;
    }
    const generation = ++this.refResolveGeneration;

    // File-level REF keyword: default library/file for unqualified REFFLD /
    // bare type-R fields. Value is the raw text inside REF(...), e.g.
    // `MYLIB/CUSTMAST` or `CUSTMAST` (with optional record-format name).
    const globalFormat = this.dds.formats.find((f) => f.name === `_GLOBAL`);
    const refKeyword = globalFormat?.keywords.find((k) => k.name === `REF`);
    const defaultRef = parseFileSpec(refKeyword?.value);

    interface Pending {
      field: FieldInfo;
      library: string | undefined;
      file: string;
      lookupName: string;
    }
    const pending: Pending[] = [];

    for (const format of this.dds.formats) {
      for (const field of format.fields) {
        if (!field.isReference) {
          continue;
        }
        if (field.length && field.length > 0) {
          continue; // explicit length in source — trust it
        }
        if (field.resolvedLength !== undefined) {
          continue;
        }

        const target = parseReferenceTarget(field, defaultRef);
        if (!target) {
          continue;
        }
        pending.push({ field, ...target });
      }
    }

    if (pending.length === 0) {
      return;
    }

    // Group by file spec so each unique file is fetched once per session.
    const groups = new Map<string, Pending[]>();
    for (const item of pending) {
      const key = `${(item.library || ``).toUpperCase()}/${item.file.toUpperCase()}`;
      const list = groups.get(key);
      if (list) {
        list.push(item);
      } else {
        groups.set(key, [item]);
      }
    }

    let anyResolved = false;
    for (const [key, items] of groups) {
      if (this.disposed || generation !== this.refResolveGeneration) {
        return;
      }
      let cached = this.refFileCache.get(key);
      if (cached === undefined) {
        const fetched = await fetchFileFieldsByName(items[0].library, items[0].file);
        if (fetched === undefined) {
          // Transport / offline — do not cache; retry after reconnect.
          continue;
        }
        cached = fetched.size > 0 ? fetched : null;
        this.refFileCache.set(key, cached);
      }
      if (!cached) {
        continue;
      }
      for (const item of items) {
        const info = cached.get(item.lookupName.toUpperCase());
        if (info && info.length > 0 && item.field.resolvedLength !== info.length) {
          item.field.resolvedLength = info.length;
          anyResolved = true;
        }
      }
    }

    if (this.disposed || generation !== this.refResolveGeneration || !anyResolved) {
      return;
    }

    this.panel.webview.postMessage({
      command: `update`,
      dds: this.dds,
      documentType: this.documentType,
    });
  }

  private async applyEdit(edit: WorkspaceEdit): Promise<boolean> {
    if (this.disposed) {
      return false;
    }
    const versionBefore = this.document.version;
    // One document-change echo expected per applyEdit
    this.ignoreDocumentChanges++;
    try {
      const ok = await workspace.applyEdit(edit);
      if (!ok || this.disposed) {
        this.ignoreDocumentChanges = Math.max(0, this.ignoreDocumentChanges - 1);
        return false;
      }
      this.document = workspace.textDocuments.find((d) => d.uri.toString() === this.document.uri.toString())
        ?? this.document;
      if (this.document.version === versionBefore) {
        // No-op / coalesced replace — no change event will consume the token.
        this.ignoreDocumentChanges = Math.max(0, this.ignoreDocumentChanges - 1);
      } else if (this.ignoreDocumentChanges > 1) {
        this.ignoreDocumentChanges = 1;
      }
      return true;
    } catch (e) {
      this.ignoreDocumentChanges = Math.max(0, this.ignoreDocumentChanges - 1);
      throw e;
    }
  }

  /**
   * Surface a failed edit to the user and resync the webview to the document.
   * Used when WorkspaceEdit is rejected, the connection is down, or a throw escapes.
   */
  private reportEditFailure(message: string, cause?: unknown) {
    if (cause !== undefined) {
      console.error(`[ibmi-renderer] ${message}`, cause);
    } else {
      console.error(`[ibmi-renderer] ${message}`);
    }
    void window.showWarningMessage(message);
    this.panel.webview.postMessage({ command: `editFailed`, reason: message });
    // Push authoritative document state so the canvas drops any optimistic UI.
    this.load(true);
  }

  private async drainQueue() {
    if (this.processingQueue) {
      return;
    }
    this.processingQueue = true;
    try {
      while (this.messageQueue.length > 0) {
        if (this.disposed) {
          this.messageQueue.length = 0;
          break;
        }
        const message = this.messageQueue.shift()!;
        try {
          await this.handleMessage(message);
        } catch (e) {
          this.reportEditFailure(
            `Edit failed: ${e instanceof Error ? e.message : String(e)}`,
            e
          );
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /** Apply one or more scoped line updates in reverse document order. */
  private applyDdsUpdates(workspaceEdit: WorkspaceEdit, updates: DdsUpdate[], label: string) {
    const ordered = [...updates]
      .filter((u) => u.range)
      .sort((a, b) => b.range!.start - a.range!.start);
    for (const update of ordered) {
      const { start, end } = update.range!;
      if (end < start) {
        this.insertLinesAt(workspaceEdit, start, update.newLines, label);
      } else {
        const text = update.newLines.length > 0
          ? update.newLines.join(this.eol) + this.eol
          : ``;
        workspaceEdit.replace(
          this.document.uri,
          this.fullLinesRange(start, end),
          text,
          { label, needsConfirmation: false }
        );
      }
    }
  }

  private async handleRequestInput(message: Extract<WebviewToHostMessage, { command: "requestInput" }>) {
    const title = sanitizeDialogString(message.title) || `IBM i DDS Designer`;
    const prompt = sanitizeDialogString(message.prompt) || undefined;
    const value = await window.showInputBox({
      title,
      prompt,
      value: sanitizeDialogString(message.value, 32) || undefined,
      validateInput: message.validate === `recordName`
        ? (v) => {
            const name = (v || ``).trim().toUpperCase();
            if (!name) {
              return `Name is required.`;
            }
            if (!isValidRecordName(name)) {
              return RECORD_NAME_HINT;
            }
            return undefined;
          }
        : undefined,
    });
    this.panel.webview.postMessage({
      command: `requestInputResult`,
      requestId: message.requestId,
      value: value === undefined ? undefined : value.trim().toUpperCase(),
    });
  }

  private async handleRequestConfirm(message: Extract<WebviewToHostMessage, { command: "requestConfirm" }>) {
    const body = sanitizeDialogString(message.message) || `Are you sure?`;
    const label = sanitizeDialogString(message.confirmLabel, 40) || `Delete`;
    const choice = await window.showWarningMessage(
      body,
      { modal: true },
      label
    );
    this.panel.webview.postMessage({
      command: `requestConfirmResult`,
      requestId: message.requestId,
      confirmed: choice === label,
    });
  }

  private async handleRequestSaveDiscard(message: Extract<WebviewToHostMessage, { command: "requestSaveDiscard" }>) {
    const body = sanitizeDialogString(message.message) || `Do you want to save your changes?`;
    const SAVE = `Save`;
    const DONT_SAVE = `Don't Save`;
    const picked = await window.showWarningMessage(
      body,
      { modal: true },
      SAVE,
      DONT_SAVE
    );
    const choice = picked === SAVE ? `save` : picked === DONT_SAVE ? `discard` : `cancel`;
    this.panel.webview.postMessage({
      command: `requestSaveDiscardResult`,
      requestId: message.requestId,
      choice,
    });
  }

  /** Exposed for unit tests. */
  async handleMessage(message: WebviewToHostMessage) {
    if (this.disposed) {
      return;
    }
    // Host-native dialogs / navigation are always allowed (they do not mutate the document).
    if (message.command === `requestInput`) {
      await this.handleRequestInput(message);
      return;
    }
    if (message.command === `requestConfirm`) {
      await this.handleRequestConfirm(message);
      return;
    }
    if (message.command === `requestSaveDiscard`) {
      await this.handleRequestSaveDiscard(message);
      return;
    }
    if (message.command === `showError`) {
      const text = sanitizeDialogString(message.message);
      if (text) {
        void window.showErrorMessage(text);
      }
      return;
    }
    if (message.command === `revealInSource`) {
      const { startLine, endLine } = message;
      if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) {
        return;
      }
      if (startLine < 0 || endLine < startLine) {
        return;
      }
      await openDdsView(this.document.uri, `source`, {
        revealLines: { startLine, endLine },
      });
      return;
    }

    if (this.connectionReadonly) {
      this.reportEditFailure(`Cannot edit: IBM i connection is disconnected.`);
      return;
    }

    this.syncModelFromDocument();
    if (!this.dds) {
      return;
    }

    switch (message.command) {
      case "deleteField": {
        const deleteFieldRange = this.dds.getRangeForField(message.recordFormat, message.fieldName);
        if (!deleteFieldRange) {
          this.reportEditFailure(`Could not delete field ${message.fieldName}.`);
          break;
        }
        const workspaceEdit = new WorkspaceEdit();
        workspaceEdit.delete(
          this.document.uri,
          this.fullLinesRange(deleteFieldRange.start, deleteFieldRange.end),
          { label: `Delete DDS Field`, needsConfirmation: false }
        );
        if (!(await this.applyEdit(workspaceEdit))) {
          this.reportEditFailure(`Could not delete field ${message.fieldName}.`);
          break;
        }
        this.refreshAfterEdit(true);
        break;
      }

      case "deleteFields": {
        const ranges = message.fieldNames
          .map((name) => this.dds!.getRangeForField(message.recordFormat, name))
          .filter((r): r is NonNullable<typeof r> => !!r)
          .sort((a, b) => b.start - a.start);

        if (ranges.length === 0) {
          this.reportEditFailure(`Could not delete selected fields.`);
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
        if (!(await this.applyEdit(workspaceEdit))) {
          this.reportEditFailure(`Could not delete selected fields.`);
          break;
        }
        this.refreshAfterEdit(true);
        break;
      }

      case "newField": {
        const fieldInfo = FieldInfo.fromData(message.fieldInfo);
        const fieldError = validateFieldEditPayload(fieldInfo);
        if (fieldError) {
          this.reportEditFailure(fieldError);
          break;
        }
        this.uniquifyIncomingFields(message.recordFormat, [fieldInfo]);
        const newField = this.dds.updateField(message.recordFormat, undefined, fieldInfo);
        if (!newField?.range) {
          this.reportEditFailure(`Could not add field.`);
          break;
        }
        const workspaceEdit = new WorkspaceEdit();
        this.insertLinesAt(workspaceEdit, newField.range.start, newField.newLines, `Add DDS Field`);
        if (!(await this.applyEdit(workspaceEdit))) {
          this.reportEditFailure(`Could not add field.`);
          break;
        }
        this.refreshAfterEdit(true);
        break;
      }

      case "newFields": {
        const format = this.dds.findFormat(message.recordFormat);
        if (!format || format.name === `_GLOBAL` || !message.fields?.length) {
          this.reportEditFailure(`Could not add fields.`);
          break;
        }
        for (const f of message.fields) {
          const fieldError = validateFieldEditPayload(f);
          if (fieldError) {
            this.reportEditFailure(fieldError);
            return;
          }
        }
        this.uniquifyIncomingFields(message.recordFormat, message.fields);
        const newLines: string[] = [];
        for (const f of message.fields) {
          newLines.push(...DisplayFile.getLinesForField(FieldInfo.fromData(f)));
        }
        const workspaceEdit = new WorkspaceEdit();
        this.insertLinesAt(workspaceEdit, format.range.end, newLines, `Add DDS Fields`);
        if (!(await this.applyEdit(workspaceEdit))) {
          this.reportEditFailure(`Could not add fields.`);
          break;
        }
        this.refreshAfterEdit(true);
        break;
      }

      case "updateField": {
        const fieldInfo = FieldInfo.fromData(message.fieldInfo);
        const fieldError = validateFieldEditPayload(fieldInfo);
        if (fieldError) {
          this.reportEditFailure(fieldError);
          break;
        }
        const renameError = this.fieldRenameCollision(
          message.recordFormat,
          message.originalFieldName,
          fieldInfo,
        );
        if (renameError) {
          this.reportEditFailure(renameError);
          break;
        }
        const fieldUpdate = this.dds.updateField(
          message.recordFormat,
          message.originalFieldName,
          fieldInfo
        );
        if (!fieldUpdate?.range) {
          this.reportEditFailure(`Could not update field ${message.originalFieldName}.`);
          break;
        }
        const workspaceEdit = new WorkspaceEdit();
        workspaceEdit.replace(
          this.document.uri,
          this.fullLinesRange(fieldUpdate.range.start, fieldUpdate.range.end),
          fieldUpdate.newLines.join(this.eol) + this.eol,
          { label: `Update DDS Field`, needsConfirmation: false }
        );
        if (!(await this.applyEdit(workspaceEdit))) {
          this.reportEditFailure(`Could not update field ${message.originalFieldName}.`);
          break;
        }
        this.refreshAfterEdit(false);
        break;
      }

      case "updateFields": {
        for (const u of message.updates) {
          const fieldError = validateFieldEditPayload(u.fieldInfo);
          if (fieldError) {
            this.reportEditFailure(fieldError);
            return;
          }
          const renameError = this.fieldRenameCollision(
            message.recordFormat,
            u.originalFieldName,
            u.fieldInfo,
          );
          if (renameError) {
            this.reportEditFailure(renameError);
            return;
          }
        }
        const prepared = message.updates
          .map((u) => {
            const fieldInfo = FieldInfo.fromData(u.fieldInfo);
            const update = this.dds!.updateField(message.recordFormat, u.originalFieldName, fieldInfo);
            return update?.range ? { update, originalFieldName: u.originalFieldName } : undefined;
          })
          .filter((x): x is NonNullable<typeof x> => !!x)
          .sort((a, b) => b.update.range!.start - a.update.range!.start);

        if (prepared.length === 0) {
          this.reportEditFailure(`Could not update fields.`);
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
        if (!(await this.applyEdit(workspaceEdit))) {
          this.reportEditFailure(`Could not update fields.`);
          break;
        }
        this.refreshAfterEdit(false);
        break;
      }

      case "updateFormat": {
        const kwError = validateFormatKeywords(message.newKeywords);
        if (kwError) {
          this.reportEditFailure(kwError);
          break;
        }
        const formatUpdate = this.dds.updateFormatHeader(message.recordFormat, message.newKeywords);
        if (!formatUpdate?.range) {
          this.reportEditFailure(`Could not update record format ${message.recordFormat}.`);
          break;
        }
        const { start, end } = formatUpdate.range;
        const workspaceEdit = new WorkspaceEdit();
        if (end < start) {
          // Pure insert (e.g. first-ever _GLOBAL keyword block); route through
          // insertLinesAt so we don't emit a bad position past EOF.
          this.insertLinesAt(workspaceEdit, start, formatUpdate.newLines, `Update DDS Format`);
        } else {
          const text = formatUpdate.newLines.length > 0
            ? formatUpdate.newLines.join(this.eol) + this.eol
            : ``;
          workspaceEdit.replace(
            this.document.uri,
            this.fullLinesRange(start, end),
            text,
            { label: `Update DDS Format`, needsConfirmation: false }
          );
        }
        if (!(await this.applyEdit(workspaceEdit))) {
          this.reportEditFailure(`Could not update record format ${message.recordFormat}.`);
          break;
        }
        this.refreshAfterEdit(true);
        break;
      }

      case "newFormats": {
        for (const fmt of message.formats || []) {
          const kwError = validateFormatKeywords(fmt.keywords);
          if (kwError) {
            this.reportEditFailure(kwError);
            return;
          }
        }
        const insert = this.dds.insertFormats(message.formats || []);
        if (!insert?.range) {
          this.reportEditFailure(`Could not add record format(s). Check names are valid and unique.`);
          break;
        }
        const workspaceEdit = new WorkspaceEdit();
        this.insertLinesAt(workspaceEdit, insert.range.start, insert.newLines, `Add DDS Record Format`);
        if (!(await this.applyEdit(workspaceEdit))) {
          this.reportEditFailure(`Could not add record format(s).`);
          break;
        }
        this.refreshAfterEdit(true, message.selectFormat);
        break;
      }

      case "deleteFormat": {
        const refs = this.dds.formatsReferencing(message.recordFormat);
        if (refs.length > 0) {
          window.showWarningMessage(
            `Cannot delete ${message.recordFormat}: still referenced by ${refs.join(`, `)} via SFLCTL.`
          );
          this.panel.webview.postMessage({
            command: `editFailed`,
            reason: `Cannot delete ${message.recordFormat}: still referenced.`,
          });
          this.load(true);
          break;
        }
        const del = this.dds.deleteFormat(message.recordFormat);
        if (!del?.range) {
          this.reportEditFailure(`Could not delete record format ${message.recordFormat}.`);
          break;
        }
        const workspaceEdit = new WorkspaceEdit();
        workspaceEdit.delete(
          this.document.uri,
          this.fullLinesRange(del.range.start, del.range.end),
          { label: `Delete DDS Record Format`, needsConfirmation: false }
        );
        if (!(await this.applyEdit(workspaceEdit))) {
          this.reportEditFailure(`Could not delete record format ${message.recordFormat}.`);
          break;
        }
        this.refreshAfterEdit(true);
        break;
      }

      case "renameFormat": {
        const renamed = this.dds.renameFormat(message.recordFormat, message.newName);
        if (!renamed?.length) {
          this.reportEditFailure(
            `Could not rename ${message.recordFormat} to ${message.newName}. Check the name is valid and unique.`
          );
          break;
        }
        const workspaceEdit = new WorkspaceEdit();
        this.applyDdsUpdates(workspaceEdit, renamed, `Rename DDS Record Format`);
        if (!(await this.applyEdit(workspaceEdit))) {
          this.reportEditFailure(
            `Could not rename ${message.recordFormat} to ${message.newName}.`
          );
          break;
        }
        this.refreshAfterEdit(true);
        break;
      }

      case "copyFormat": {
        const copied = this.dds.copyFormat(message.recordFormat, message.newName);
        if (!copied?.range) {
          this.reportEditFailure(
            `Could not copy ${message.recordFormat} as ${message.newName}. Check the name is valid and unique.`
          );
          break;
        }
        const workspaceEdit = new WorkspaceEdit();
        this.insertLinesAt(workspaceEdit, copied.range.start, copied.newLines, `Copy DDS Record Format`);
        if (!(await this.applyEdit(workspaceEdit))) {
          this.reportEditFailure(
            `Could not copy ${message.recordFormat} as ${message.newName}.`
          );
          break;
        }
        this.refreshAfterEdit(true);
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
        const format = this.dds.findFormat(message.recordFormat);
        if (!format || format.name === `_GLOBAL` || !message.fields?.length) {
          this.reportEditFailure(`Could not place database fields.`);
          break;
        }
        for (const f of message.fields) {
          const fieldError = validateFieldEditPayload(f);
          if (fieldError) {
            this.reportEditFailure(fieldError);
            return;
          }
        }
        this.uniquifyIncomingFields(message.recordFormat, message.fields);
        const newLines: string[] = [];
        for (const f of message.fields) {
          newLines.push(...DisplayFile.getLinesForField(FieldInfo.fromData(f)));
        }
        const workspaceEdit = new WorkspaceEdit();
        this.insertLinesAt(workspaceEdit, format.range.end, newLines, `Add Database Fields`);
        if (!(await this.applyEdit(workspaceEdit))) {
          this.reportEditFailure(`Could not place database fields.`);
          break;
        }
        this.refreshAfterEdit(true);
        break;
      }
    }
  }
}

/** Exported for unit tests. */
export { DspfDesignerSession };
