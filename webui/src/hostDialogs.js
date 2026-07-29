/**
 * Host-native dialog helpers. Round-trip through the extension host so we use
 * vscode.window.showInputBox / showWarningMessage instead of window.prompt /
 * window.alert / window.confirm (which are unreliable inside webviews).
 */

import { vscode } from "./vscodeApi.js";

/** @type {Map<string, (value: any) => void>} */
const pending = new Map();
let nextId = 1;

/**
 * Resolve a pending host dialog by requestId. Called from main.js on host messages.
 * @param {string} requestId
 * @param {any} value
 */
export function resolveHostDialog(requestId, value) {
  const resolve = pending.get(requestId);
  if (!resolve) {
    return;
  }
  pending.delete(requestId);
  resolve(value);
}

/**
 * @param {{ title: string, value?: string, prompt?: string, validate?: "recordName" }} opts
 * @returns {Promise<string|undefined>} Uppercased trimmed value, or undefined if cancelled.
 */
export function requestHostInput(opts) {
  const requestId = String(nextId++);
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    vscode.postMessage({
      command: `requestInput`,
      requestId,
      title: opts.title,
      value: opts.value,
      prompt: opts.prompt,
      validate: opts.validate,
    });
  });
}

/**
 * @param {{ message: string, confirmLabel?: string }} opts
 * @returns {Promise<boolean>}
 */
export function requestHostConfirm(opts) {
  const requestId = String(nextId++);
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    vscode.postMessage({
      command: `requestConfirm`,
      requestId,
      message: opts.message,
      confirmLabel: opts.confirmLabel,
    });
  });
}

/**
 * Show an error via the host (replaces window.alert).
 * @param {string} message
 */
export function showHostError(message) {
  vscode.postMessage({ command: `showError`, message });
}
