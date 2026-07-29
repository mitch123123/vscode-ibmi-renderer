/**
 * IBM i DDS record-format name grammar shared by the extension host and the
 * webview (imported from both `src/` and `webui/src/`).
 *
 * 1–10 characters: first A–Z / @ / # / $, then A–Z / 0–9 / @ / # / $.
 */
export const RECORD_NAME_RE = /^[A-Z@#$][A-Z0-9@#$]{0,9}$/;

export function isValidRecordName(name: string): boolean {
  return RECORD_NAME_RE.test((name || ``).trim().toUpperCase());
}

export const RECORD_NAME_HINT =
  `Use 1–10 characters: A–Z, 0–9, @, #, $ (must start with a letter or @/#/$).`;
