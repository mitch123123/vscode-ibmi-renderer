/** @typedef {import('../../src/shared/dspf-types').FieldInfoData} FieldInfo */
/** @typedef {import('../../src/shared/dspf-types').Keyword} Keyword */

/** Keywords that only apply to DDS date (L) fields / were injected for L preview. */
export const DATE_TYPE_KEYWORDS = new Set([`DATE`, `DATFMT`, `DATSEP`]);
/** Keywords that only apply to DDS time (T) fields / were injected for T preview. */
export const TIME_TYPE_KEYWORDS = new Set([`TIME`, `TIMFMT`, `TIMSEP`]);

/**
 * Drop keywords that were tied to a previous DDS type when the type changes.
 * Type L/T historically injected DATE/TIME into the model for preview; those
 * (and DATFMT/TIMFMT/…) must not linger after the field is no longer a
 * date/time. Leaving type R drops REFFLD the same way.
 *
 * @param {FieldInfo} field
 * @param {string} prevType
 * @param {string} nextType
 */
export function stripKeywordsForTypeChange(field, prevType, nextType) {
  const prev = (prevType || ``).toUpperCase();
  const next = (nextType || ``).toUpperCase();
  if (prev === next) {
    return;
  }

  /** @type {Set<string>} */
  const remove = new Set();
  if (prev === `L` && next !== `L`) {
    DATE_TYPE_KEYWORDS.forEach((n) => remove.add(n));
  }
  if (prev === `T` && next !== `T`) {
    TIME_TYPE_KEYWORDS.forEach((n) => remove.add(n));
  }
  if (prev === `R` && next !== `R`) {
    remove.add(`REFFLD`);
    field.reference = undefined;
  }
  if (remove.size === 0 || !field.keywords?.length) {
    return;
  }
  field.keywords = field.keywords.filter((k) => !remove.has((k.name || ``).toUpperCase()));
}
