import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Host-session tests. vscode and side-effect modules are mocked so we can
 * drive `DspfDesignerSession.handleMessage` without an Extension Host.
 */

const vscodeMocks = vi.hoisted(() => ({
  showWarningMessage: vi.fn(() => Promise.resolve(undefined)),
  showErrorMessage: vi.fn(() => Promise.resolve(undefined)),
  showInputBox: vi.fn(() => Promise.resolve(undefined)),
  applyEdit: vi.fn(() => Promise.resolve(true)),
}));

const editorSwitchMocks = vi.hoisted(() => ({
  openDdsView: vi.fn(() => Promise.resolve(true)),
}));

vi.mock(`vscode`, () => {
  class Position {
    constructor(public line: number, public character: number) {}
  }
  class Range {
    start: Position;
    end: Position;
    constructor(a: number | Position, b: number | Position, c?: number, d?: number) {
      if (typeof a === `number` && typeof b === `number` && typeof c === `number` && typeof d === `number`) {
        this.start = new Position(a, b);
        this.end = new Position(c, d);
      } else {
        this.start = a as Position;
        this.end = b as Position;
      }
    }
  }
  class WorkspaceEdit {
    inserts: Array<{ line: number; text: string }> = [];
    replaces: Array<{ start: number; end: number; text: string }> = [];
    deletes: Array<{ start: number; end: number }> = [];

    insert(_uri: unknown, position: { line: number }, text: string) {
      this.inserts.push({ line: position.line, text });
    }
    replace(_uri: unknown, range: { start: { line: number }; end: { line: number } }, text: string) {
      this.replaces.push({ start: range.start.line, end: range.end.line, text });
    }
    delete(_uri: unknown, range: { start: { line: number }; end: { line: number } }) {
      this.deletes.push({ start: range.start.line, end: range.end.line });
    }
  }

  return {
    Position,
    Range,
    WorkspaceEdit,
    EndOfLine: { LF: 1, CRLF: 2 },
    Uri: {
      file: (p: string) => ({ fsPath: p, scheme: `file`, path: p, toString: () => `file://${p}` }),
      joinPath: (...parts: { path?: string; fsPath?: string }[]) => parts[parts.length - 1],
    },
    window: {
      showWarningMessage: vscodeMocks.showWarningMessage,
      showErrorMessage: vscodeMocks.showErrorMessage,
      showInputBox: vscodeMocks.showInputBox,
      registerCustomEditorProvider: vi.fn(),
    },
    workspace: {
      applyEdit: vscodeMocks.applyEdit,
      textDocuments: [] as unknown[],
      onDidChangeTextDocument: vi.fn(() => ({ dispose: () => {} })),
      fs: {
        writeFile: vi.fn(),
        readFile: vi.fn(),
      },
    },
  };
});

vi.mock(`../editorSwitch`, () => ({
  openDdsView: editorSwitchMocks.openDdsView,
}));
vi.mock(`../protectedSource`, () => ({
  isProtectedDdsSource: vi.fn(async () => false),
  protectedSourceMessage: vi.fn(() => ``),
}));
vi.mock(`../dbBrowse`, () => ({
  browseDatabaseFieldsInteractive: vi.fn(),
  fetchFileFieldsByName: vi.fn(async () => null),
}));
vi.mock(`fs`, () => ({
  readFileSync: vi.fn(() => ``),
}));

import { WorkspaceEdit } from "vscode";
import { designerTabTitle, DspfDesignerSession } from "../ui/index";

function makeDocument(lines: string[]) {
  let current = [...lines];
  let version = 1;
  return {
    uri: {
      scheme: `file`,
      path: `/test.dspf`,
      toString: () => `file:///test.dspf`,
    },
    languageId: `dds.dspf`,
    eol: 1,
    get version() {
      return version;
    },
    get lineCount() {
      return current.length;
    },
    getText: () => current.join(`\n`),
    lineAt: (i: number) => ({
      text: current[i] ?? ``,
      range: { start: { line: i, character: 0 }, end: { line: i, character: (current[i] ?? ``).length } },
    }),
    replaceLines(next: string[]) {
      current = [...next];
      version += 1;
    },
  };
}

function makePanel() {
  const posted: unknown[] = [];
  return {
    posted,
    webview: {
      postMessage: (msg: unknown) => {
        posted.push(msg);
      },
      onDidReceiveMessage: () => ({ dispose: () => {} }),
    },
  };
}

function makeSession(lines: string[]) {
  const document = makeDocument(lines) as any;
  const panel = makePanel();
  const session = new DspfDesignerSession({} as any, document, panel as any);
  session.load(false);
  return { session, panel, document };
}

describe(`DspfDesignerSession`, () => {
  beforeEach(() => {
    vscodeMocks.showWarningMessage.mockClear();
    vscodeMocks.showErrorMessage.mockClear();
    vscodeMocks.showInputBox.mockClear();
    vscodeMocks.applyEdit.mockReset();
    vscodeMocks.applyEdit.mockResolvedValue(true);
    editorSwitchMocks.openDdsView.mockReset();
    editorSwitchMocks.openDdsView.mockResolvedValue(true);
  });

  it(`routes pure-insert updateFormat through insert (not replace)`, async () => {
    // Empty document: first _GLOBAL keywords are a pure insert (end < start).
    const lines: string[] = [];
    const { session } = makeSession(lines);

    const captured: WorkspaceEdit[] = [];
    vscodeMocks.applyEdit.mockImplementation(async (edit: WorkspaceEdit) => {
      captured.push(edit);
      return true;
    });

    await session.handleMessage({
      command: `updateFormat`,
      recordFormat: `_GLOBAL`,
      newKeywords: [{ name: `DSPSIZ`, value: `24 80 *DS3`, conditions: [] }],
    });

    expect(captured.length).toBe(1);
    const edit = captured[0] as any;
    expect(edit.inserts.length).toBeGreaterThan(0);
    expect(edit.replaces.length).toBe(0);
    expect(edit.inserts[0].text).toContain(`DSPSIZ`);
  });

  it(`posts editFailed when connection is readonly`, async () => {
    const lines = [`     A          R HEAD`, `     A                                  1  2'Hi'`];
    const { session, panel } = makeSession(lines);

    // Force remote + disconnected
    (session as any).document = {
      ...(session as any).document,
      uri: { scheme: `member`, path: `/QSYS.LIB/X.LIB/Y.FILE/Z.MBR`, toString: () => `member:/x` },
    };
    session.applyConnectionReadonly(true);
    panel.posted.length = 0;

    await session.handleMessage({
      command: `deleteFormat`,
      recordFormat: `HEAD`,
    });

    expect(vscodeMocks.applyEdit).not.toHaveBeenCalled();
    expect(vscodeMocks.showWarningMessage).toHaveBeenCalled();
    expect(panel.posted.some((m: any) => m.command === `editFailed`)).toBe(true);
  });

  it(`applies scoped renameFormat updates (not a full-file replace)`, async () => {
    const lines = [
      `     A          R SFL01`,
      `     A                                      SFL`,
      `     A            F1             5A  O  1  2`,
      `     A          R CTL01`,
      `     A                                      SFLCTL(SFL01)`,
      `     A                                      SFLPAG(5)`,
      `     A          R OTHER`,
      `     A                                  1  2'x'`,
    ];
    const { session } = makeSession(lines);

    const captured: WorkspaceEdit[] = [];
    vscodeMocks.applyEdit.mockImplementation(async (edit: WorkspaceEdit) => {
      captured.push(edit);
      return true;
    });

    await session.handleMessage({
      command: `renameFormat`,
      recordFormat: `SFL01`,
      newName: `SFL99`,
    });

    expect(captured.length).toBe(1);
    const edit = captured[0] as any;
    // Two single-line replaces: R-line + SFLCTL line. Full-file would be one replace of 0..EOF.
    expect(edit.replaces.length).toBe(2);
    expect(edit.replaces.every((r: any) => r.end === r.start + 1)).toBe(true);
    expect(edit.replaces.some((r: any) => r.text.includes(`SFL99`))).toBe(true);
    expect(edit.replaces.some((r: any) => r.text.includes(`SFLCTL(SFL99)`))).toBe(true);
  });

  it(`rejects deleteFormat when SFLCTL still references the format`, async () => {
    const lines = [
      `     A          R SFL01`,
      `     A                                      SFL`,
      `     A            F1             5A  O  1  2`,
      `     A          R CTL01`,
      `     A                                      SFLCTL(SFL01)`,
    ];
    const { session, panel } = makeSession(lines);
    panel.posted.length = 0;

    await session.handleMessage({
      command: `deleteFormat`,
      recordFormat: `SFL01`,
    });

    expect(vscodeMocks.applyEdit).not.toHaveBeenCalled();
    expect(vscodeMocks.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining(`still referenced`)
    );
    expect(panel.posted.some((m: any) => m.command === `editFailed`)).toBe(true);
  });

  it(`reports failure when applyEdit returns false`, async () => {
    const lines = [`     A          R HEAD`, `     A                                  1  2'Hi'`];
    const { session, panel } = makeSession(lines);
    vscodeMocks.applyEdit.mockResolvedValue(false);
    panel.posted.length = 0;

    await session.handleMessage({
      command: `deleteFormat`,
      recordFormat: `HEAD`,
    });

    expect(vscodeMocks.showWarningMessage).toHaveBeenCalled();
    expect(panel.posted.some((m: any) => m.command === `editFailed`)).toBe(true);
  });

  it(`rejects placeDatabaseFields with invalid payloads`, async () => {
    const lines = [`     A          R HEAD`, `     A                                  1  2'Hi'`];
    const { session, panel } = makeSession(lines);
    panel.posted.length = 0;

    await session.handleMessage({
      command: `placeDatabaseFields`,
      recordFormat: `HEAD`,
      fields: [
        {
          name: `BAD NAME`,
          displayType: `both`,
          position: { x: 1, y: 3 },
          length: 5,
          decimals: 0,
          conditions: [],
          keywords: [],
          startRange: 0,
        },
      ],
    });

    expect(vscodeMocks.applyEdit).not.toHaveBeenCalled();
    expect(panel.posted.some((m: any) => m.command === `editFailed`)).toBe(true);
  });

  it(`auto-increments newField names that already exist on the format`, async () => {
    const lines = [`     A          R HEAD`, `     A            FIELD1        5A  B  1  2`];
    const { session } = makeSession(lines);
    const captured: WorkspaceEdit[] = [];
    vscodeMocks.applyEdit.mockImplementation(async (edit: WorkspaceEdit) => {
      captured.push(edit);
      return true;
    });

    await session.handleMessage({
      command: `newField`,
      recordFormat: `HEAD`,
      fieldInfo: {
        name: `FIELD1`,
        displayType: `both`,
        type: `A`,
        length: 10,
        decimals: 0,
        position: { x: 1, y: 3 },
        conditions: [],
        keywords: [],
        startRange: 0,
      },
    });

    expect(captured.length).toBe(1);
    const edit = captured[0] as any;
    expect(edit.replaces.length).toBe(0);
    expect(edit.inserts.length).toBeGreaterThan(0);
    expect(edit.inserts[0].text).toContain(`FIELD2`);
    expect(edit.inserts[0].text).not.toMatch(/FIELD1\s/);
  });

  it(`auto-increments placeDatabaseFields names that collide with existing DDS fields`, async () => {
    const lines = [`     A          R HEAD`, `     A            CUSTNAME      10A  O  2  5`];
    const { session } = makeSession(lines);
    const captured: WorkspaceEdit[] = [];
    vscodeMocks.applyEdit.mockImplementation(async (edit: WorkspaceEdit) => {
      captured.push(edit);
      return true;
    });

    await session.handleMessage({
      command: `placeDatabaseFields`,
      recordFormat: `HEAD`,
      fields: [
        {
          name: `CUSTNAME`,
          displayType: `both`,
          type: `R`,
          isReference: true,
          reference: `CUSTNAME MYLIB/CUSTFILE`,
          length: 30,
          decimals: 0,
          position: { x: 2, y: 4 },
          conditions: [],
          keywords: [{ name: `REFFLD`, value: `CUSTNAME MYLIB/CUSTFILE`, conditions: [] }],
          startRange: 0,
        },
        {
          name: `CUSTNAME`,
          displayType: `both`,
          type: `R`,
          isReference: true,
          reference: `CUSTNAME MYLIB/OTHER`,
          length: 10,
          decimals: 0,
          position: { x: 2, y: 5 },
          conditions: [],
          keywords: [{ name: `REFFLD`, value: `CUSTNAME MYLIB/OTHER`, conditions: [] }],
          startRange: 0,
        },
      ],
    });

    expect(captured.length).toBe(1);
    const edit = captured[0] as any;
    expect(edit.replaces.length).toBe(0);
    const inserted = edit.inserts.map((i: { text: string }) => i.text).join(`\n`);
    expect(inserted).toContain(`CUSTNAME2`);
    expect(inserted).toContain(`CUSTNAME3`);
    expect(inserted).toContain(`REFFLD(CUSTNAME MYLIB/CUSTFILE)`);
    expect(inserted).toContain(`REFFLD(CUSTNAME MYLIB/OTHER)`);
  });

  it(`sanitizes showError messages from the webview`, async () => {
    const lines = [`     A          R HEAD`];
    const { session } = makeSession(lines);

    await session.handleMessage({
      command: `showError`,
      message: `  boom\u0000  `,
    });

    expect(vscodeMocks.showErrorMessage).toHaveBeenCalledWith(`boom`);
  });

  it(`maps Save / Don't Save / dismiss for unsaved field property edits`, async () => {
    const lines = [`     A          R HEAD`];
    const { session, panel } = makeSession(lines);

    vscodeMocks.showWarningMessage.mockResolvedValueOnce(`Save`);
    await session.handleMessage({
      command: `requestSaveDiscard`,
      requestId: `1`,
      message: `Do you want to save the field property changes you made?`,
    });
    expect(panel.posted.at(-1)).toEqual({
      command: `requestSaveDiscardResult`,
      requestId: `1`,
      choice: `save`,
    });

    vscodeMocks.showWarningMessage.mockResolvedValueOnce(`Don't Save`);
    await session.handleMessage({
      command: `requestSaveDiscard`,
      requestId: `2`,
      message: `Do you want to save the field property changes you made?`,
    });
    expect(panel.posted.at(-1)).toMatchObject({ requestId: `2`, choice: `discard` });

    vscodeMocks.showWarningMessage.mockResolvedValueOnce(undefined);
    await session.handleMessage({
      command: `requestSaveDiscard`,
      requestId: `3`,
      message: `Do you want to save the field property changes you made?`,
    });
    expect(panel.posted.at(-1)).toMatchObject({ requestId: `3`, choice: `cancel` });
  });

  it(`labels designer tabs with an IBM i DDS suffix`, () => {
    expect(designerTabTitle(`/QSYS.LIB/TOLENTDS.LIB/QDDSSRC.FILE/SAMPLEDSP.DSPF`)).toBe(
      `SAMPLEDSP.DSPF [IBM i DDS]`
    );
    expect(designerTabTitle(`C:\\\\work\\\\orders.prtf`)).toBe(`orders.prtf [IBM i DDS]`);
    expect(designerTabTitle(``)).toBe(`DDS [IBM i DDS]`);
  });

  it(`revealInSource opens the text editor on the requested lines`, async () => {
    const lines = [`     A          R HEAD`, `     A            FIELD1         5A  B  1  2`];
    const { session, document } = makeSession(lines);

    await session.handleMessage({
      command: `revealInSource`,
      startLine: 1,
      endLine: 1,
    });

    expect(editorSwitchMocks.openDdsView).toHaveBeenCalledWith(document.uri, `source`, {
      revealLines: { startLine: 1, endLine: 1 },
    });
    expect(vscodeMocks.applyEdit).not.toHaveBeenCalled();
  });

  it(`forwards newFormats.selectFormat on the load message`, async () => {
    const lines = [`     A          R HEAD`];
    const { session, panel } = makeSession(lines);
    panel.posted.length = 0;

    await session.handleMessage({
      command: `newFormats`,
      formats: [{ name: `BODY`, keywords: [] }],
      selectFormat: `BODY`,
    });

    const load = panel.posted.find((m: any) => m.command === `load`);
    expect(load).toMatchObject({ command: `load`, selectFormat: `BODY` });
    expect(vscodeMocks.applyEdit).toHaveBeenCalled();
  });

  it(`rejects updateField rename that collides with an existing field`, async () => {
    const lines = [
      `     A          R HEAD`,
      `     A            FIELD1         5A  B  1  2`,
      `     A            FIELD2         5A  B  2  2`,
    ];
    const { session, panel } = makeSession(lines);
    panel.posted.length = 0;

    await session.handleMessage({
      command: `updateField`,
      recordFormat: `HEAD`,
      originalFieldName: `FIELD1`,
      fieldInfo: {
        name: `FIELD2`,
        displayType: `both`,
        type: `A`,
        length: 5,
        decimals: 0,
        position: { x: 1, y: 1 },
        conditions: [],
        keywords: [],
        startRange: 0,
      },
    });

    expect(vscodeMocks.applyEdit).not.toHaveBeenCalled();
    expect(panel.posted.some((m: any) => m.command === `editFailed`)).toBe(true);
  });

  it(`posts editFailed when deleteField cannot find the field`, async () => {
    const lines = [`     A          R HEAD`, `     A            FIELD1         5A  B  1  2`];
    const { session, panel } = makeSession(lines);
    panel.posted.length = 0;

    await session.handleMessage({
      command: `deleteField`,
      recordFormat: `HEAD`,
      fieldName: `MISSING`,
    });

    expect(vscodeMocks.applyEdit).not.toHaveBeenCalled();
    expect(panel.posted.some((m: any) => m.command === `editFailed`)).toBe(true);
  });

  it(`rejects newFields and placeDatabaseFields on _GLOBAL`, async () => {
    const lines = [`     A                                      DSPSIZ(24 80 *DS3)`, `     A          R HEAD`];
    const { session, panel } = makeSession(lines);
    const field = {
      name: `BAD1`,
      displayType: `both`,
      type: `A`,
      length: 5,
      decimals: 0,
      position: { x: 1, y: 1 },
      conditions: [],
      keywords: [],
      startRange: 0,
    };

    panel.posted.length = 0;
    await session.handleMessage({
      command: `newFields`,
      recordFormat: `_GLOBAL`,
      fields: [field],
    });
    expect(vscodeMocks.applyEdit).not.toHaveBeenCalled();
    expect(panel.posted.some((m: any) => m.command === `editFailed`)).toBe(true);

    vscodeMocks.applyEdit.mockClear();
    panel.posted.length = 0;
    await session.handleMessage({
      command: `placeDatabaseFields`,
      recordFormat: `_GLOBAL`,
      fields: [field],
    });
    expect(vscodeMocks.applyEdit).not.toHaveBeenCalled();
    expect(panel.posted.some((m: any) => m.command === `editFailed`)).toBe(true);
  });

  it(`does not apply WorkspaceEdits after dispose`, async () => {
    const lines = [`     A          R HEAD`, `     A            FIELD1         5A  B  1  2`];
    const { session } = makeSession(lines);
    session.dispose();
    vscodeMocks.applyEdit.mockClear();

    await session.handleMessage({
      command: `deleteField`,
      recordFormat: `HEAD`,
      fieldName: `FIELD1`,
    });

    expect(vscodeMocks.applyEdit).not.toHaveBeenCalled();
  });

  it(`does not leave ignoreDocumentChanges set when applyEdit does not bump version`, async () => {
    const lines = [`     A          R HEAD`, `     A            FIELD1         5A  B  1  2`];
    const { session } = makeSession(lines);

    await session.handleMessage({
      command: `updateField`,
      recordFormat: `HEAD`,
      originalFieldName: `FIELD1`,
      fieldInfo: {
        name: `FIELD1`,
        displayType: `both`,
        type: `A`,
        length: 5,
        decimals: 0,
        position: { x: 3, y: 1 },
        conditions: [],
        keywords: [],
        startRange: 0,
      },
    });

    expect(vscodeMocks.applyEdit).toHaveBeenCalled();
    expect(session.consumeIgnoredDocumentChange()).toBe(false);
  });

  it(`reparses live document lines before updateField when version drifted`, async () => {
    const original = [`     A          R HEAD`, `     A            FIELD1         5A  B  1  2`];
    const { session, document } = makeSession(original);
    (document as any).replaceLines([
      `     A* comment one`,
      `     A* comment two`,
      ...original,
    ]);

    const captured: WorkspaceEdit[] = [];
    vscodeMocks.applyEdit.mockImplementation(async (edit: WorkspaceEdit) => {
      captured.push(edit);
      return true;
    });

    await session.handleMessage({
      command: `updateField`,
      recordFormat: `HEAD`,
      originalFieldName: `FIELD1`,
      fieldInfo: {
        name: `FIELD1`,
        displayType: `both`,
        type: `A`,
        length: 5,
        decimals: 0,
        position: { x: 4, y: 1 },
        conditions: [],
        keywords: [],
        startRange: 0,
      },
    });

    expect(captured.length).toBe(1);
    const edit = captured[0] as any;
    expect(edit.replaces.length).toBe(1);
    // Two comments prepended: FIELD1 moved from line 1 to line 3.
    expect(edit.replaces[0].start).toBe(3);
    expect(edit.replaces[0].text).not.toContain(`comment`);
  });

  it(`rejects newFormats keywords that contain newlines`, async () => {
    const lines = [`     A          R HEAD`];
    const { session, panel } = makeSession(lines);
    panel.posted.length = 0;

    await session.handleMessage({
      command: `newFormats`,
      formats: [{
        name: `BODY`,
        keywords: [{ name: `TEXT`, value: `Hello\n     A          R INJECT`, conditions: [] }],
      }],
      selectFormat: `BODY`,
    });

    expect(vscodeMocks.applyEdit).not.toHaveBeenCalled();
    expect(panel.posted.some((m: any) => m.command === `editFailed`)).toBe(true);
  });
});
