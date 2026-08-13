import { beforeEach, describe, expect, it, vi } from "vitest";

const vscodeMocks = vi.hoisted(() => ({
  showWarningMessage: vi.fn(() => Promise.resolve(undefined)),
  showErrorMessage: vi.fn(() => Promise.resolve(undefined)),
  applyEdit: vi.fn(() => Promise.resolve(true)),
  writeFile: vi.fn(() => Promise.resolve()),
  readFile: vi.fn(() => Promise.resolve(Buffer.from(``))),
  textDocuments: [] as unknown[],
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
    replaces: Array<{ text: string }> = [];
    replace(_uri: unknown, _range: unknown, text: string) {
      this.replaces.push({ text });
    }
  }
  return {
    Position,
    Range,
    WorkspaceEdit,
    window: {
      showWarningMessage: vscodeMocks.showWarningMessage,
      showErrorMessage: vscodeMocks.showErrorMessage,
    },
    workspace: {
      applyEdit: vscodeMocks.applyEdit,
      get textDocuments() {
        return vscodeMocks.textDocuments;
      },
      fs: {
        writeFile: vscodeMocks.writeFile,
        readFile: vscodeMocks.readFile,
      },
    },
  };
});

vi.mock(`../editorSwitch`, () => ({
  openDdsView: editorSwitchMocks.openDdsView,
}));

import { confirmSaveOnDesignerClose, ddsFileLabel } from "../unsavedChanges";

function makeDocument(opts: {
  path?: string;
  text?: string;
  isDirty?: boolean;
  isClosed?: boolean;
  save?: () => Promise<boolean>;
}) {
  const text = opts.text ?? `     A          R HEAD\n`;
  const lines = text.split(`\n`);
  return {
    uri: {
      scheme: `file`,
      path: opts.path ?? `/lib/MYFILE.dspf`,
      toString: () => `file://${opts.path ?? `/lib/MYFILE.dspf`}`,
    },
    isDirty: opts.isDirty ?? true,
    isClosed: opts.isClosed ?? false,
    lineCount: lines.length,
    getText: () => text,
    lineAt: (i: number) => ({ text: lines[i] ?? `` }),
    save: opts.save ?? vi.fn(async () => true),
  };
}

describe(`unsavedChanges`, () => {
  beforeEach(() => {
    vscodeMocks.showWarningMessage.mockReset();
    vscodeMocks.showWarningMessage.mockResolvedValue(undefined);
    vscodeMocks.showErrorMessage.mockReset();
    vscodeMocks.applyEdit.mockReset();
    vscodeMocks.applyEdit.mockResolvedValue(true);
    vscodeMocks.writeFile.mockReset();
    vscodeMocks.writeFile.mockResolvedValue(undefined);
    vscodeMocks.readFile.mockReset();
    vscodeMocks.readFile.mockResolvedValue(Buffer.from(``));
    vscodeMocks.textDocuments = [];
    editorSwitchMocks.openDdsView.mockReset();
    editorSwitchMocks.openDdsView.mockResolvedValue(true);
  });

  it(`ddsFileLabel uses the final path segment`, () => {
    expect(ddsFileLabel({ path: `/qsys/QDDSSRC/CUSTINQ.dspf` } as any)).toBe(`CUSTINQ.dspf`);
  });

  it(`skips the prompt when the document is already clean`, async () => {
    const document = makeDocument({ isDirty: false });
    vscodeMocks.textDocuments = [document];
    await confirmSaveOnDesignerClose({ uri: document.uri as any, document: document as any });
    expect(vscodeMocks.showWarningMessage).not.toHaveBeenCalled();
  });

  it(`saves when the user chooses Save`, async () => {
    vscodeMocks.showWarningMessage.mockResolvedValue(`Save`);
    const save = vi.fn(async () => true);
    const document = makeDocument({ isDirty: true, save });
    vscodeMocks.textDocuments = [document];
    await confirmSaveOnDesignerClose({ uri: document.uri as any, document: document as any });
    expect(save).toHaveBeenCalled();
    expect(editorSwitchMocks.openDdsView).not.toHaveBeenCalled();
  });

  it(`writes via the filesystem when Save cannot use TextDocument.save`, async () => {
    vscodeMocks.showWarningMessage.mockResolvedValue(`Save`);
    const document = makeDocument({
      isDirty: true,
      isClosed: true,
      text: `     A          R NEWFMT\n`,
    });
    vscodeMocks.textDocuments = [document];
    await confirmSaveOnDesignerClose({ uri: document.uri as any, document: document as any });
    expect(vscodeMocks.writeFile).toHaveBeenCalled();
  });

  it(`reverts to disk contents when the user chooses Don't Save`, async () => {
    vscodeMocks.showWarningMessage.mockResolvedValue(`Don't Save`);
    const document = makeDocument({ isDirty: true, text: `dirty` });
    vscodeMocks.textDocuments = [document];
    vscodeMocks.readFile.mockResolvedValue(Buffer.from(`clean`));
    await confirmSaveOnDesignerClose({ uri: document.uri as any, document: document as any });
    expect(vscodeMocks.applyEdit).toHaveBeenCalled();
    expect(editorSwitchMocks.openDdsView).not.toHaveBeenCalled();
  });

  it(`reopens the designer when the user cancels`, async () => {
    vscodeMocks.showWarningMessage.mockResolvedValue(undefined);
    const document = makeDocument({ isDirty: true, text: `unsaved` });
    vscodeMocks.textDocuments = [document];
    await confirmSaveOnDesignerClose({ uri: document.uri as any, document: document as any });
    expect(editorSwitchMocks.openDdsView).toHaveBeenCalledWith(document.uri, `designer`);
  });
});
