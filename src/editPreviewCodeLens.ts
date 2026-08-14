import * as vscode from "vscode";
import { COMMANDS } from "./shared/messages";
import { DisplayFile, splitDocumentLines } from "./ui/dspf";
import { uriLooksLikeDesignerSource } from "./uri";

const GLOBAL_RECORD_NAME = `_GLOBAL`;

/**
 * CodeLens on DDS source:
 * - top-of-file "IBM i DDS Designer" (opens this fork's designer)
 * - per–record-format "Edit (IBM i DDS)"
 */
export class DdsEditPreviewCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  dispose(): void {
    this._onDidChangeCodeLenses.dispose();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!uriLooksLikeDesignerSource(document.uri) && document.languageId !== `dds.dspf` && document.languageId !== `dds.prtf`) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: `$(edit) IBM i DDS Designer`,
        tooltip: `Open IBM i DDS Designer for this DDS source`,
        command: COMMANDS.launchRenderer,
        arguments: [document.uri],
      }),
    ];

    try {
      const dds = new DisplayFile();
      dds.parse(splitDocumentLines(document.getText()));
      for (const format of dds.formats) {
        if (!format.name || format.name === GLOBAL_RECORD_NAME) {
          continue;
        }
        const line = format.range.start;
        if (line < 0 || line >= document.lineCount) {
          continue;
        }
        lenses.push(
          new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
            title: `$(edit) Edit (IBM i DDS)`,
            tooltip: `Open record format ${format.name} in IBM i DDS Designer`,
            command: COMMANDS.editRecordFormat,
            arguments: [document.uri, format.name],
          })
        );
      }
    } catch {
      // Malformed DDS — still show the top-of-file lens.
    }

    return lenses;
  }
}

export function registerEditPreviewCodeLens(context: vscode.ExtensionContext): void {
  const provider = new DdsEditPreviewCodeLensProvider();
  context.subscriptions.push(
    { dispose: () => provider.dispose() },
    vscode.languages.registerCodeLensProvider(
      [
        { language: `dds.dspf` },
        { language: `dds.prtf` },
        { pattern: `**/*.{dspf,prtf,dspf38,prtf38,DSPF,PRTF,DSPF38,PRTF38}` },
      ],
      provider
    ),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (
        uriLooksLikeDesignerSource(e.document.uri) ||
        e.document.languageId === `dds.dspf` ||
        e.document.languageId === `dds.prtf`
      ) {
        provider.refresh();
      }
    })
  );
}
