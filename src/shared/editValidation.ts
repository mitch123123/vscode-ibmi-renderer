import type { FieldInfoData, Keyword } from "./dspf-types";
import {
  DDS_MAX_DECIMALS,
  DDS_MAX_LENGTH,
  DDS_MAX_ROW_COL,
  FIELD_NAME_HINT,
  isValidFieldName,
  isValidRecordName,
} from "./recordName";

/** Max length for webview-driven dialog strings shown in VS Code UI. */
export const DIALOG_STRING_MAX = 200;

/** Max length for a keyword name emitted into DDS. */
export const KEYWORD_NAME_MAX = 32;

/** Max length for a keyword value emitted into DDS (before wrapping). */
export const KEYWORD_VALUE_MAX = 256;

/** Max length for a const field value emitted as a DDS string literal. */
export const CONST_VALUE_MAX = 512;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
/** Keyword names are alphabetic IBM i identifiers, optionally with leading `*`. */
const KEYWORD_NAME_RE = /^\*?[A-Z][A-Z0-9]*$/i;

/**
 * Clamp and sanitize a string the webview wants shown in a host dialog.
 * Returns an empty string when the input is missing/invalid.
 */
export function sanitizeDialogString(value: unknown, max = DIALOG_STRING_MAX): string {
  if (typeof value !== `string`) {
    return ``;
  }
  const cleaned = value.replace(CONTROL_CHARS, ``).trim();
  if (cleaned.length <= max) {
    return cleaned;
  }
  return cleaned.slice(0, max);
}

/**
 * Validate a single keyword before it is written into DDS source.
 * Returns an error message, or `undefined` when safe to emit.
 */
export function validateKeyword(keyword: Keyword | undefined): string | undefined {
  if (!keyword) {
    return `Missing keyword data.`;
  }

  const name = (keyword.name || ``).trim();
  if (!name) {
    return `Keyword name is required.`;
  }
  if (name.length > KEYWORD_NAME_MAX) {
    return `Keyword name exceeds ${KEYWORD_NAME_MAX} characters.`;
  }
  if (!KEYWORD_NAME_RE.test(name)) {
    return `Invalid keyword name "${name}".`;
  }
  if (CONTROL_CHARS.test(name)) {
    return `Keyword name contains invalid characters.`;
  }

  if (keyword.value !== undefined && keyword.value !== null) {
    if (typeof keyword.value !== `string`) {
      return `Keyword value must be a string.`;
    }
    if (keyword.value.length > KEYWORD_VALUE_MAX) {
      return `Keyword value exceeds ${KEYWORD_VALUE_MAX} characters.`;
    }
    if (CONTROL_CHARS.test(keyword.value) || /[\n\r\t]/.test(keyword.value)) {
      return `Keyword value contains invalid characters.`;
    }
  }

  return undefined;
}

/**
 * Validate keywords attached to a field payload.
 */
export function validateFieldKeywords(keywords: Keyword[] | undefined): string | undefined {
  if (!keywords) {
    return undefined;
  }
  for (const kw of keywords) {
    const err = validateKeyword(kw);
    if (err) {
      return err;
    }
  }
  return undefined;
}

/**
 * Const values are emitted as `'${value}'` in DDS. Reject characters that
 * would break out of the literal or corrupt the source line.
 */
export function validateConstValue(value: string | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== `string`) {
    return `Constant value must be a string.`;
  }
  if (value.length > CONST_VALUE_MAX) {
    return `Constant value exceeds ${CONST_VALUE_MAX} characters.`;
  }
  if (CONTROL_CHARS.test(value) || value.includes(`\n`) || value.includes(`\r`)) {
    return `Constant value contains invalid characters.`;
  }
  return undefined;
}

/**
 * Validate a field payload before the host builds a WorkspaceEdit.
 * Returns an error message, or `undefined` when the payload is safe to emit.
 */
export function validateFieldEditPayload(field: Partial<FieldInfoData> | undefined): string | undefined {
  if (!field) {
    return `Missing field data.`;
  }

  if (field.displayType !== `const` && field.name !== undefined && field.name !== ``) {
    if (!isValidFieldName(field.name)) {
      return `Invalid field name "${field.name}". ${FIELD_NAME_HINT}`;
    }
  }

  if (field.displayType === `const`) {
    const constError = validateConstValue(field.value);
    if (constError) {
      return constError;
    }
  }

  if (field.length !== undefined && field.length !== null) {
    if (!Number.isInteger(field.length) || field.length < 0 || field.length > DDS_MAX_LENGTH) {
      return `Length must be an integer from 0 to ${DDS_MAX_LENGTH}.`;
    }
  }

  if (field.decimals !== undefined && field.decimals !== null) {
    if (!Number.isInteger(field.decimals) || field.decimals < 0 || field.decimals > DDS_MAX_DECIMALS) {
      return `Decimals must be an integer from 0 to ${DDS_MAX_DECIMALS}.`;
    }
    if (field.length !== undefined && field.length !== null && field.decimals > field.length) {
      return `Decimals (${field.decimals}) cannot exceed length (${field.length}).`;
    }
  }

  if (field.position) {
    const { x, y } = field.position;
    // x <= 0 / y <= 0 are valid (blank column/row: hidden, P/M, printer).
    if (!Number.isInteger(x) || x > DDS_MAX_ROW_COL) {
      return `Column must be an integer from 0 to ${DDS_MAX_ROW_COL} (0 = blank).`;
    }
    if (!Number.isInteger(y) || y > DDS_MAX_ROW_COL) {
      return `Row must be an integer from 0 to ${DDS_MAX_ROW_COL} (0 = blank).`;
    }
  }

  const kwError = validateFieldKeywords(field.keywords);
  if (kwError) {
    return kwError;
  }

  return undefined;
}

/**
 * Validate format-level keywords that the sidebar can write (SFLPAG / SFLSIZ / WINDOW),
 * plus general keyword shape checks for every entry.
 */
export function validateFormatKeywords(keywords: Keyword[] | undefined): string | undefined {
  if (!keywords) {
    return undefined;
  }

  let sflPag: number | undefined;
  let sflSiz: number | undefined;

  for (const kw of keywords) {
    const shapeError = validateKeyword(kw);
    if (shapeError) {
      return shapeError;
    }

    const name = (kw.name || ``).toUpperCase();
    const value = (kw.value || ``).trim();

    if (name === `SFLPAG` || name === `SFLSIZ`) {
      if (!/^\d+$/.test(value) || Number(value) < 1) {
        return `${name} must be a positive integer.`;
      }
      const n = Number(value);
      if (name === `SFLPAG`) {
        sflPag = n;
      } else {
        sflSiz = n;
      }
    }

    if (name === `WINDOW` && value) {
      const parts = value.split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        if (!isValidRecordName(parts[0])) {
          return `WINDOW reference must be a valid record name. ${FIELD_NAME_HINT}`;
        }
      } else if (parts.length === 3 && parts[0].toUpperCase() === `*DFT`) {
        for (const p of parts.slice(1)) {
          if (!/^\d+$/.test(p) || Number(p) < 1) {
            return `WINDOW *DFT height and width must be positive integers.`;
          }
        }
      } else if (parts.length === 4) {
        for (const p of parts) {
          if (!/^\d+$/.test(p) || Number(p) < 1) {
            return `WINDOW row, col, height, and width must be positive integers.`;
          }
        }
      } else {
        return `WINDOW must be four positive integers (row col height width), *DFT height width, or a record-format name.`;
      }
    }
  }

  if (sflPag !== undefined && sflSiz !== undefined && sflSiz < sflPag) {
    return `SFLSIZ must be greater than or equal to SFLPAG.`;
  }

  return undefined;
}
