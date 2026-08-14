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

/**
 * Strip characters that are illegal in DDS names (spaces, underscores, …)
 * and cap at {@link FIELD_NAME_MAX}. Empty / digit-leading input becomes `FIELD`.
 */
export function sanitizeFieldName(raw: string): string {
  let s = String(raw ?? ``).toUpperCase().replace(/\s+/g, ``);
  s = s.replace(/[^A-Z0-9@#$]/g, ``);
  s = s.replace(/^[0-9]+/, ``);
  s = s.slice(0, FIELD_NAME_MAX);
  return s || `FIELD`;
}

export type NamedFieldLike = {
  name?: string;
  displayType?: string;
};

/**
 * Next unused DDS field name derived from `base`.
 * Reuses `base` when free; otherwise increments a trailing number
 * (`FIELD1` → `FIELD2`, `CUSTNAME` → `CUSTNAME2`). Never inserts `_`.
 */
export function uniqueFieldName(base: string, existingNames: Iterable<string>): string {
  const taken = new Set(
    Array.from(existingNames, (n) => String(n || ``).toUpperCase()),
  );
  const sanitized = sanitizeFieldName(base);
  if (!taken.has(sanitized)) {
    return sanitized;
  }

  const m = sanitized.match(/^(.*?)(\d+)$/);
  const prefix = (m ? m[1] : sanitized) || `F`;
  let n = m ? Number.parseInt(m[2], 10) + 1 : 2;

  for (let i = 0; i < 10000; i++, n++) {
    const suffix = String(n);
    const room = FIELD_NAME_MAX - suffix.length;
    if (room < 1) {
      continue;
    }
    const name = `${prefix.slice(0, room)}${suffix}`;
    if (!taken.has(name) && isValidFieldName(name)) {
      return name;
    }
  }

  let fallback = `F${Date.now()}`.slice(0, FIELD_NAME_MAX);
  for (let guard = 0; taken.has(fallback) && guard < 100; guard++) {
    fallback = `F${Date.now()}${guard}`.slice(0, FIELD_NAME_MAX);
  }
  return fallback;
}

/**
 * Assign unique DDS names to incoming named fields so they never collide
 * with `existingNames` or each other. Mutates `fields` in place.
 * Constants (no name column) are left unchanged.
 */
export function uniquifyNewFieldNames<T extends NamedFieldLike>(
  fields: T[],
  existingNames: Iterable<string>,
): T[] {
  const taken = new Set(
    Array.from(existingNames, (n) => String(n || ``).toUpperCase()).filter(Boolean),
  );
  for (const field of fields) {
    if (field.displayType === `const` || !(field.name || ``).trim()) {
      continue;
    }
    const unique = uniqueFieldName(field.name!, taken);
    field.name = unique;
    taken.add(unique.toUpperCase());
  }
  return fields;
}

export const RECORD_NAME_HINT =
  `Use 1–${FIELD_NAME_MAX} characters: A–Z, 0–9, @, #, $ (must start with a letter or @/#/$); no spaces.`;

export const FIELD_NAME_HINT = RECORD_NAME_HINT;

/** Maximum values that fit in fixed DDS columns without shifting neighbors. */
export const DDS_MAX_LENGTH = 99999;
export const DDS_MAX_DECIMALS = 99;
export const DDS_MAX_ROW_COL = 999;
