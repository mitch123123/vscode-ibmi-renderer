import * as vscode from 'vscode';
import { openDdsView } from './editorSwitch';
import { registerEditPreviewCodeLens } from './editPreviewCodeLens';
import { registerIbmiConnectionLifecycle } from './ibmiLifecycle';
import { isProtectedDdsSource, protectedSourceMessage } from './protectedSource';
import { DspfDesignerProvider } from './ui';
import { asBrowserNode, resolveDesignerUri, uriLooksLikeDesignerSource } from './uri';

function activeDesignerUri(): vscode.Uri | undefined {
	const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
	if (
		activeTab?.input instanceof vscode.TabInputCustom &&
		activeTab.input.viewType === DspfDesignerProvider.viewType
	) {
		return activeTab.input.uri;
	}
	return undefined;
}

async function openDesignerIfAllowed(
	uri: vscode.Uri,
	browserNode?: ReturnType<typeof asBrowserNode>,
	selectFormat?: string
): Promise<void> {
	if (await isProtectedDdsSource(uri, browserNode)) {
		vscode.window.showWarningMessage(protectedSourceMessage(uri));
		return;
	}
	if (selectFormat) {
		if (DspfDesignerProvider.requestSelectFormat(uri, selectFormat)) {
			return;
		}
		DspfDesignerProvider.setPendingSelectFormat(uri, selectFormat);
	}
	await openDdsView(uri, 'designer');
}

export function activate(context: vscode.ExtensionContext) {
	console.log('vscode-ibmi-renderer is now active');

	context.subscriptions.push(DspfDesignerProvider.register(context));
	registerIbmiConnectionLifecycle(context);
	registerEditPreviewCodeLens(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-ibmi-renderer.launchRenderer', async (arg?: unknown) => {
			const browserNode = asBrowserNode(arg);
			const target = resolveDesignerUri(arg);
			if (!target) {
				vscode.window.showWarningMessage(
					'Open a display file (.dspf) or printer file (.prtf), or right-click a DSPF/PRTF member in the Object Browser.'
				);
				return;
			}
			if (!uriLooksLikeDesignerSource(target)) {
				vscode.window.showWarningMessage(
					`"${target.path.split('/').pop()}" does not look like a DSPF or PRTF source.`
				);
				return;
			}
			await openDesignerIfAllowed(target, browserNode);
		}),

		vscode.commands.registerCommand(
			'vscode-ibmi-renderer.editRecordFormat',
			async (uri?: vscode.Uri, formatName?: string) => {
				const target = (uri instanceof vscode.Uri ? uri : undefined) ?? resolveDesignerUri();
				const name = typeof formatName === `string` ? formatName.trim() : ``;
				if (!target) {
					vscode.window.showWarningMessage(
						'Open a display file (.dspf) or printer file (.prtf) to edit a record format.'
					);
					return;
				}
				if (!name) {
					vscode.window.showWarningMessage('No record format specified.');
					return;
				}
				if (!uriLooksLikeDesignerSource(target)) {
					vscode.window.showWarningMessage(
						`"${target.path.split('/').pop()}" does not look like a DSPF or PRTF source.`
					);
					return;
				}
				await openDesignerIfAllowed(target, undefined, name);
			}
		),

		vscode.commands.registerCommand('vscode-ibmi-renderer.showSource', async (uri?: vscode.Uri) => {
			const target =
				(uri instanceof vscode.Uri ? uri : undefined) ?? activeDesignerUri() ?? resolveDesignerUri();
			if (!target) {
				vscode.window.showWarningMessage('No DDS source file to show.');
				return;
			}
			await openDdsView(target, 'source');
		}),

		vscode.commands.registerCommand('vscode-ibmi-renderer.toggleEditorView', async () => {
			const designerUri = activeDesignerUri();
			if (designerUri) {
				await openDdsView(designerUri, 'source');
				return;
			}

			const target = resolveDesignerUri();
			if (!target || !uriLooksLikeDesignerSource(target)) {
				vscode.window.showWarningMessage('Open a DDS display or printer file first.');
				return;
			}
			await openDesignerIfAllowed(target);
		}),
	);

	warnIfLegacyRendererPresent(context);
}

function warnIfLegacyRendererPresent(context: vscode.ExtensionContext) {
	const legacy = vscode.extensions.getExtension('halcyontechltd.vscode-displayfile');
	if (!legacy) {
		return;
	}
	const key = 'vscode-ibmi-renderer.legacyRendererNoticeShown';
	if (context.globalState.get(key)) {
		return;
	}
	void context.globalState.update(key, true);
	void vscode.window.showInformationMessage(
		'IBM i Display File Designer is the newer real-time DDS editor. The older “IBM i Renderer” (CodeLens Preview) from the Development Pack can stay installed — use the editor title Edit / Preview action (or Open With) for this designer.',
		'Got it'
	);
}

export function deactivate() {}
