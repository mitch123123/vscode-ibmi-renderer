import type { FieldInfoData, Keyword } from "./dspf-types";
import {
  DDS_MAX_DECIMALS,
  DDS_MAX_LENGTH,
  DDS_MAX_ROW_COL,
  FIELD_NAME_HINT,
  isValidFieldName,
  isValidRecordName,
} from "./recordName";

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
    if (!Number.isInteger(x) || x < 1 || x > DDS_MAX_ROW_COL) {
      return `Column must be an integer from 1 to ${DDS_MAX_ROW_COL}.`;
    }
    // y === 0 is valid (printer-style blank row / relative positioning).
    if (!Number.isInteger(y) || y < 0 || y > DDS_MAX_ROW_COL) {
      return `Row must be an integer from 0 to ${DDS_MAX_ROW_COL}.`;
    }
  }

  return undefined;
}

/**
 * Validate format-level keywords that the sidebar can write (SFLPAG / SFLSIZ / WINDOW).
 */
export function validateFormatKeywords(keywords: Keyword[] | undefined): string | undefined {
  if (!keywords) {
    return undefined;
  }

  let sflPag: number | undefined;
  let sflSiz: number | undefined;

  for (const kw of keywords) {
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
      } else if (parts.length === 4) {
        for (const p of parts) {
          if (!/^\d+$/.test(p) || Number(p) < 1) {
            return `WINDOW row, col, height, and width must be positive integers.`;
          }
        }
      } else {
        return `WINDOW must be four positive integers (row col height width) or a record-format name.`;
      }
    }
  }

  if (sflPag !== undefined && sflSiz !== undefined && sflSiz < sflPag) {
    return `SFLSIZ must be greater than or equal to SFLPAG.`;
  }

  return undefined;
}
