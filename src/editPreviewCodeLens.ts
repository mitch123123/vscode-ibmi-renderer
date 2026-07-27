import * as vscode from "vscode";
import { uriLooksLikeDesignerSource } from "./uri";

/**
 * Prominent CodeLens on DDS source so "Edit / Preview" is the primary action
 * (alongside or above the legacy pack's read-only Preview lens).
 */
export class DdsEditPreviewCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!uriLooksLikeDesignerSource(document.uri) && document.languageId !== `dds.dspf` && document.languageId !== `dds.prtf`) {
      return [];
    }

    const range = new vscode.Range(0, 0, 0, 0);
    return [
      new vscode.CodeLens(range, {
        title: `$(edit) Edit / Preview`,
        tooltip: `Open the visual Display File Designer for this DDS source`,
        command: `vscode-ibmi-renderer.launchRenderer`,
        arguments: [document.uri],
      }),
    ];
  }
}

export function registerEditPreviewCodeLens(context: vscode.ExtensionContext): void {
  const provider = new DdsEditPreviewCodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [
        { language: `dds.dspf` },
        { language: `dds.prtf` },
        { pattern: `**/*.{dspf,prtf,dspf38,prtf38,DSPF,PRTF,DSPF38,PRTF38}` },
      ],
      provider
    )
  );
}
