/**
 * Pure helpers for detecting unsaved field-property / keyword edits.
 */

/**
 * @param {Array<{ id?: string, value?: any }>} properties
 * @returns {Record<string, string>}
 */
export function snapshotPropValues(properties) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const p of properties || []) {
    if (p.id) {
      out[p.id] = String(p.value ?? ``);
    }
  }
  return out;
}

/**
 * @param {ParentNode|null|undefined} root
 * @returns {Record<string, string>}
 */
export function readPropValuesFromElement(root) {
  /** @type {Record<string, string>} */
  const newProperties = {};
  if (!root || typeof root.querySelectorAll !== `function`) {
    return newProperties;
  }
  root.querySelectorAll(`[data-prop-id]`).forEach((el) => {
    const propId = el && el.dataset ? el.dataset.propId : undefined;
    if (!propId) {
      return;
    }
    if (typeof el.value === `string`) {
      newProperties[propId] = el.value;
    } else if (typeof el.innerText === `string`) {
      newProperties[propId] = el.innerText;
    }
  });
  return newProperties;
}

/**
 * @param {Record<string, string>|null|undefined} original
 * @param {Record<string, string>|null|undefined} current
 */
export function propValuesChanged(original, current) {
  const orig = original || {};
  const curr = current || {};
  const ids = new Set([...Object.keys(orig), ...Object.keys(curr)]);
  for (const id of ids) {
    if (String(orig[id] ?? ``) !== String(curr[id] ?? ``)) {
      return true;
    }
  }
  return false;
}

/**
 * @param {unknown} original
 * @param {unknown} current
 */
export function keywordsChanged(original, current) {
  return JSON.stringify(original || []) !== JSON.stringify(current || []);
}
