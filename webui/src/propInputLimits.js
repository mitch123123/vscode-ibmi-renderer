/**
 * Live GUI sanitizers for the field Properties panel.
 * Mirrors IBM i DDS / host limits in `src/shared/recordName.ts` and
 * `src/shared/editValidation.ts` so invalid characters are blocked while typing.
 */

import {
  DDS_MAX_DECIMALS,
  DDS_MAX_LENGTH,
  FIELD_NAME_HINT,
  FIELD_NAME_MAX,
} from "../../src/shared/recordName.ts";
import {
  CONST_VALUE_MAX,
  KEYWORD_VALUE_MAX,
} from "../../src/shared/editValidation.ts";

export { FIELD_NAME_MAX };

/** Length fits DDS positions 30–34 (5 digits, up to DDS_MAX_LENGTH). */
export const LENGTH_INPUT_MAX_CHARS = String(DDS_MAX_LENGTH).length;

/** Decimals fit DDS positions 36–37 (2 digits, up to DDS_MAX_DECIMALS). */
export const DECIMALS_INPUT_MAX_CHARS = String(DDS_MAX_DECIMALS).length;

/** Option indicators: optional `N` + 1–2 digits (01–99). */
export const INDICATOR_INPUT_MAX = 3;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Field / record name: 1–10 chars, no spaces, A–Z @ # $ then A–Z 0–9 @ # $.
 * @param {string} raw
 */
export function filterFieldNameInput(raw) {
  let s = String(raw ?? ``).toUpperCase().replace(/\s+/g, ``);
  s = s.replace(/[^A-Z0-9@#$]/g, ``);
  // Strip leading digits (name must start with A–Z / @ / # / $).
  s = s.replace(/^[0-9]+/, ``);
  return s.slice(0, FIELD_NAME_MAX);
}

/**
 * Non-negative integer digits only, capped by character width.
 * @param {string} raw
 * @param {number} maxChars
 */
export function filterDigitInput(raw, maxChars) {
  return String(raw ?? ``).replace(/\D/g, ``).slice(0, maxChars);
}

/**
 * SDA-style indicator slot: blank, `05`, or `N20`.
 * @param {string} raw
 */
export function filterIndicatorInput(raw) {
  const s = String(raw ?? ``).toUpperCase().replace(/\s+/g, ``);
  if (!s) {
    return ``;
  }
  if (s === `N`) {
    return `N`;
  }
  const m = s.match(/^(N?)(\d{0,2})/);
  if (!m) {
    return ``;
  }
  return `${m[1] || ``}${m[2] || ``}`.slice(0, INDICATOR_INPUT_MAX);
}

/**
 * Const / sample value: no quotes or control characters.
 * @param {string} raw
 */
export function filterConstValueInput(raw) {
  return String(raw ?? ``)
    .replace(/'/g, ``)
    .replace(CONTROL_CHARS, ``)
    .replace(/[\r\n]/g, ``)
    .slice(0, CONST_VALUE_MAX);
}

/**
 * REFFLD-style reference text (`FIELD` or `FIELD LIB/FILE`).
 * @param {string} raw
 */
export function filterReferenceInput(raw) {
  return String(raw ?? ``)
    .toUpperCase()
    .replace(/[^A-Z0-9@#$./\s]/g, ``)
    .slice(0, KEYWORD_VALUE_MAX);
}

/**
 * Constraint presets keyed by property id for `createValuesPanel`.
 * @returns {Record<string, { maxLength?: number, filter?: (raw: string) => string, title?: string, inputMode?: string }>}
 */
export function fieldPropertyConstraints() {
  return {
    name: {
      maxLength: FIELD_NAME_MAX,
      filter: filterFieldNameInput,
      title: FIELD_NAME_HINT,
    },
    length: {
      maxLength: LENGTH_INPUT_MAX_CHARS,
      filter: (raw) => filterDigitInput(raw, LENGTH_INPUT_MAX_CHARS),
      title: `Length: integer 0–${DDS_MAX_LENGTH} (DDS columns 30–34).`,
      inputMode: `numeric`,
    },
    decimals: {
      maxLength: DECIMALS_INPUT_MAX_CHARS,
      filter: (raw) => filterDigitInput(raw, DECIMALS_INPUT_MAX_CHARS),
      title: `Decimals: integer 0–${DDS_MAX_DECIMALS} (DDS columns 36–37).`,
      inputMode: `numeric`,
    },
    value: {
      maxLength: CONST_VALUE_MAX,
      filter: filterConstValueInput,
      title: `Value: up to ${CONST_VALUE_MAX} characters; no single quotes.`,
    },
    cond1: {
      maxLength: INDICATOR_INPUT_MAX,
      filter: filterIndicatorInput,
      title: `Indicator: blank, 01–99, or N01–N99.`,
    },
    cond2: {
      maxLength: INDICATOR_INPUT_MAX,
      filter: filterIndicatorInput,
      title: `Indicator: blank, 01–99, or N01–N99.`,
    },
    cond3: {
      maxLength: INDICATOR_INPUT_MAX,
      filter: filterIndicatorInput,
      title: `Indicator: blank, 01–99, or N01–N99.`,
    },
    reference: {
      maxLength: KEYWORD_VALUE_MAX,
      filter: filterReferenceInput,
      title: `Reference: field name, optionally followed by library/file (max ${KEYWORD_VALUE_MAX}).`,
    },
  };
}
