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
    },
  };
});

vi.mock(`../editorSwitch`, () => ({ openDdsView: vi.fn() }));
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
import { DspfDesignerSession } from "../ui/index";

function makeDocument(lines: string[]) {
  const text = lines.join(`\n`);
  return {
    uri: {
      scheme: `file`,
      path: `/test.dspf`,
      toString: () => `file:///test.dspf`,
    },
    languageId: `dds.dspf`,
    eol: 1,
    lineCount: lines.length,
    getText: () => text,
    lineAt: (i: number) => ({
      text: lines[i] ?? ``,
      range: { start: { line: i, character: 0 }, end: { line: i, character: (lines[i] ?? ``).length } },
    }),
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
});
