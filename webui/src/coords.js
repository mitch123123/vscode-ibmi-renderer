/**
 * Clamp a DDS field position into valid 1-based row/col bounds.
 * Pure / dependency-free so it can be unit-tested without Konva or renderer state.
 *
 * When `length` is provided, the starting column is limited so the field's last
 * character stays within `maxX` (avoids DDS "content past record length").
 *
 * @param {number} x
 * @param {number} y
 * @param {{ maxX: number, maxY: number, wasY0?: boolean, length?: number }} opts
 * @returns {{ x: number, y: number }}
 */
export function clampFieldPosition(x, y, opts) {
  const maxX = Math.max(1, opts.maxX || 1);
  const maxY = Math.max(1, opts.maxY || 1);
  const maxStartX = maxStartColumnForLength(maxX, opts.length);
  let nextX = Math.min(Math.max(1, x), maxStartX);
  let nextY = Math.min(Math.max(1, y), maxY);
  if (opts.wasY0) {
    // Printer-style X-only / relative positioning: keep row blank (y === 0).
    nextY = 0;
  }
  return { x: nextX, y: nextY };
}

/**
 * Highest 1-based start column where a field of `length` still ends at or before `maxX`.
 * @param {number} maxX
 * @param {number} [length]
 */
export function maxStartColumnForLength(maxX, length) {
  const cols = Math.max(1, maxX || 1);
  const len = Math.max(1, length || 1);
  return Math.max(1, cols - len + 1);
}

/**
 * Content width used for screen-fit checks (explicit length, resolved length, or value).
 * Constants use the longer of declared length and the literal value.
 * @param {{ length?: number, resolvedLength?: number, value?: string, displayType?: string }|undefined|null} field
 */
export function fieldContentLength(field) {
  if (!field) {
    return 1;
  }
  const valueLen = String(field.value || ``).length;
  if (field.displayType === `const`) {
    const explicit = typeof field.length === `number` && field.length > 0 ? field.length : 0;
    return Math.max(1, explicit, valueLen);
  }
  if (typeof field.length === `number` && field.length > 0) {
    return field.length;
  }
  if (typeof field.resolvedLength === `number` && field.resolvedLength > 0) {
    return field.resolvedLength;
  }
  return Math.max(1, valueLen);
}

/**
 * True when field data would occupy a column past `maxX`.
 * @param {number} startCol
 * @param {number} length
 * @param {number} maxX
 */
export function fieldExtendsPastWidth(startCol, length, maxX) {
  const x = Number(startCol);
  const len = Math.max(1, length || 1);
  const cols = Math.max(1, maxX || 1);
  if (!Number.isFinite(x)) {
    return true;
  }
  return x + len - 1 > cols;
}

/**
 * Validate that a field's position + length fit within the design surface.
 * @param {{ position?: { x?: number, y?: number }, length?: number, resolvedLength?: number, value?: string }|undefined|null} field
 * @param {{ maxX: number, maxY?: number }} bounds
 * @returns {string|undefined} error message, or undefined when valid
 */
export function validateFieldScreenFit(field, bounds) {
  if (!field?.position) {
    return undefined;
  }
  const maxX = Math.max(1, bounds?.maxX || 1);
  const maxY = Math.max(1, bounds?.maxY || 1);
  const x = field.position.x;
  const y = field.position.y;
  const len = fieldContentLength(field);

  if (!Number.isInteger(x) || x < 1) {
    return `Column must be an integer from 1 to ${maxX}.`;
  }
  if (fieldExtendsPastWidth(x, len, maxX)) {
    return `Content past record length of ${maxX} (column ${x}, length ${len}). Move left or shorten the field.`;
  }
  // y === 0 is valid (printer-style blank row / relative positioning).
  if (y !== 0 && (!Number.isInteger(y) || y < 0 || y > maxY)) {
    return `Row must be an integer from 0 to ${maxY}.`;
  }
  return undefined;
}

/**
 * Inclusive column span for a field on an absolute row, or undefined when
 * row/col cannot be compared (missing position or printer-style y=0).
 * @param {{ position?: { x?: number, y?: number }, length?: number, resolvedLength?: number, value?: string, displayType?: string }|undefined|null} field
 * @returns {{ row: number, start: number, end: number }|undefined}
 */
export function fieldDisplaySpan(field) {
  if (!field?.position) {
    return undefined;
  }
  const row = field.position.y;
  const start = field.position.x;
  if (!Number.isInteger(row) || row < 1) {
    return undefined;
  }
  if (!Number.isInteger(start) || start < 1) {
    return undefined;
  }
  const len = fieldContentLength(field);
  return { row, start, end: start + len - 1 };
}

/**
 * True when two fields share at least one display cell (DDS will not compile).
 * Relative (y=0) fields are skipped — they have no absolute row to compare.
 * @param {object|undefined|null} a
 * @param {object|undefined|null} b
 */
export function fieldsOverlap(a, b) {
  const sa = fieldDisplaySpan(a);
  const sb = fieldDisplaySpan(b);
  if (!sa || !sb || sa.row !== sb.row) {
    return false;
  }
  return sa.start <= sb.end && sb.start <= sa.end;
}

/**
 * Stable-ish identity for excluding a field from its peers.
 * @param {object|undefined|null} a
 * @param {object|undefined|null} b
 */
export function isSameFieldRef(a, b) {
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  const an = (a.name || ``).trim();
  const bn = (b.name || ``).trim();
  if (an && bn && an === bn) {
    return true;
  }
  if (
    Number.isInteger(a.startRange) &&
    Number.isInteger(b.startRange) &&
    a.startRange >= 0 &&
    a.startRange === b.startRange
  ) {
    return true;
  }
  return false;
}

/**
 * @param {{ name?: string, value?: string, displayType?: string }|undefined|null} field
 */
export function fieldDisplayName(field) {
  const name = (field?.name || ``).trim();
  if (name) {
    return name;
  }
  if (field?.displayType === `const`) {
    const v = String(field.value || ``).trim();
    return v ? `'${v.length > 12 ? `${v.slice(0, 12)}…` : v}'` : `(const)`;
  }
  return `(unnamed)`;
}

/**
 * Peers that overlap `field` on the same absolute row/columns.
 * @param {object|undefined|null} field
 * @param {Array<object>|undefined|null} peers
 * @returns {object[]}
 */
export function findOverlappingFields(field, peers) {
  if (!field || !Array.isArray(peers) || peers.length === 0) {
    return [];
  }
  return peers.filter((peer) => {
    if (isSameFieldRef(field, peer)) {
      return false;
    }
    if (peer?.displayType === `hidden`) {
      return false;
    }
    return fieldsOverlap(field, peer);
  });
}

/**
 * Non-blocking compile hint when a field overlaps others.
 * @param {object|undefined|null} field
 * @param {Array<object>|undefined|null} peers
 * @returns {string|undefined}
 */
export function formatOverlapWarning(field, peers) {
  const hits = findOverlappingFields(field, peers);
  if (hits.length === 0) {
    return undefined;
  }
  const names = hits.map((f) => fieldDisplayName(f)).join(`, `);
  const span = fieldDisplaySpan(field);
  const where = span
    ? ` at row ${span.row}, columns ${span.start}–${span.end}`
    : ``;
  const verb = hits.length === 1 ? `Overlaps` : `Overlaps`;
  return `${verb} ${names}${where}. Overlapping fields will not compile.`;
}

/**
 * All unique overlap pairs in a format (for canvas highlighting).
 * @param {Array<object>|undefined|null} fields
 * @returns {Set<object>} fields that participate in at least one overlap
 */
export function overlappingFieldSet(fields) {
  /** @type {Set<object>} */
  const hit = new Set();
  const list = Array.isArray(fields) ? fields.filter((f) => f && f.displayType !== `hidden`) : [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (fieldsOverlap(list[i], list[j])) {
        hit.add(list[i]);
        hit.add(list[j]);
      }
    }
  }
  return hit;
}
