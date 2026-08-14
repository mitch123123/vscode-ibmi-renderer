import { requestHostSaveDiscard } from "./hostDialogs.js";

/**
 * @typedef {{
 *   fieldName?: string,
 *   isDirty: () => boolean,
 *   apply: () => boolean,
 * }} FieldEditController
 */

/** @type {FieldEditController|null} */
let controller = null;
let promptInFlight = false;

/**
 * @param {FieldEditController|null} next
 */
export function setFieldEditController(next) {
  controller = next;
}

export function clearFieldEditController() {
  controller = null;
}

export function hasDirtyFieldEdits() {
  try {
    return controller?.isDirty() === true;
  } catch {
    return false;
  }
}

export function dirtyFieldName() {
  return controller?.fieldName;
}

/**
 * Persist in-progress field property edits without prompting (tab hide / close).
 * @returns {boolean} false when validation blocked the apply
 */
export function flushDirtyFieldEdits() {
  if (!hasDirtyFieldEdits() || !controller) {
    return true;
  }
  return controller.apply() === true;
}

/**
 * If the field property panel has unsaved edits, ask Save / Don't Save / Cancel.
 * @returns {Promise<boolean>} true if the caller may leave the current field editor
 */
export async function confirmLeaveFieldEdits() {
  if (promptInFlight) {
    return false;
  }
  if (!hasDirtyFieldEdits()) {
    return true;
  }
  promptInFlight = true;
  try {
    const choice = await requestHostSaveDiscard({
      message: `Do you want to save the field property changes you made?`,
    });
    if (choice === `save`) {
      return controller?.apply() === true;
    }
    if (choice === `discard`) {
      clearFieldEditController();
      return true;
    }
    return false;
  } finally {
    promptInFlight = false;
  }
}
