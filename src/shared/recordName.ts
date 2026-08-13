/**
 * IBM i DDS record-format / field name grammar shared by the extension host and
 * the webview (imported from both `src/` and `webui/src/`).
 *
 * 1–10 characters: first A–Z / @ / # / $, then A–Z / 0–9 / @ / # / $.
 * No embedded blanks (DDS name column is positions 19–28).
 */
export const FIELD_NAME_MAX = 10;

export const RECORD_NAME_RE = /^[A-Z@#$][A-Z0-9@#$]{0,9}$/;

export function isValidRecordName(name: string): boolean {
  return RECORD_NAME_RE.test((name || ``).trim().toUpperCase());
}

/** Field names use the same IBM i DDS name grammar as record formats. */
export const isValidFieldName = isValidRecordName;

export const RECORD_NAME_HINT =
  `Use 1–${FIELD_NAME_MAX} characters: A–Z, 0–9, @, #, $ (must start with a letter or @/#/$); no spaces.`;

export const FIELD_NAME_HINT = RECORD_NAME_HINT;

/** Maximum values that fit in fixed DDS columns without shifting neighbors. */
export const DDS_MAX_LENGTH = 99999;
export const DDS_MAX_DECIMALS = 99;
export const DDS_MAX_ROW_COL = 999;
