/** @typedef {import('../../src/shared/dspf-types').Keyword} Keyword */
/** @typedef {import('../../src/shared/dspf-types').FieldInfoData} FieldInfo */
/** @typedef {import('../../src/shared/dspf-types').Conditional} Conditional */

export const colours = {
  RED: `red`,
  BLU: `#4287f5`,
  WHT: `#FFFFFF`,
  GRN: `green`,
  TRQ: `turquoise`,
  YLW: `yellow`,
  PNK: `pink`,
  BLK: `black`,
};

export const SELECTED_COLOUR = `#383838`;
export const PROTECT_COLOUR = `#666666`;
/** Background tint for fields that share display cells with another field. */
export const OVERLAP_COLOUR = `#5a2020`;

export const dateFormats = {
  '*MDY': `mm/dd/yyyy`,
  '*DMY': `dd/mm/yyyy`,
  '*YMD': `yyyy/mm/dd`,
  '*JUL': 'yy/ddd',
  '*ISO': 'yyyy-mm-dd',
  '*USA': 'mm/dd/yyyy',
  '*EUR': 'dd.mm.yyyy',
  '*JIS': 'yyyy-mm-dd',
};

export const timeFormats = {
  '*HMS': 'hh:mm:ss',
  '*ISO': 'hh.mm.ss',
  '*USA': 'hh:mm am',
  '*EUR': 'hh.mm.ss',
  '*JIS': 'hh:mm:ss',
};

export const GLOBAL_RECORD_FORMAT = `_GLOBAL`;

export const pxwPerChar = 8.45;
export const pxhPerLine = 20;
export const pxhPerChar = 12.5;

export const RULER_LEFT = 28;
export const RULER_TOP = 18;

/**
 * @param {number} x
 * @param {number} y
 */
export function snapToFixedGrid(x, y) {
  const newX = Math.round(x / pxwPerChar) * pxwPerChar;
  const newY = Math.round(y / pxhPerLine) * pxhPerLine;
  return { x: newX, y: newY };
}

/**
 * @param {number} x
 * @param {number} y
 */
export function gridCordsToFieldCords(x, y) {
  return {
    x: Math.round(x / pxwPerChar) + 1,
    y: Math.round(y / pxhPerLine) + 1
  };
}

/** @param {number} x */
export function widthInP(x) {
  return x * pxwPerChar;
}

/** @param {number} x */
export function heightInP(x) {
  return x * pxhPerLine;
}

/**
 * @param {string} string
 * @returns {string[]}
 */
export function parseParms(string) {
  if (!string) {
    return [];
  }
  let items = [];
  let inString = false;
  let current = ``;

  for (let i = 0; i < string.length; i++) {
    switch (string[i]) {
      case `'`:
        inString = !inString;
        break;
      case ` `:
        if (inString) { current += string[i]; }
        else {
          items.push(current);
          current = ``;
        }
        break;
      default:
        current += string[i];
        break;
    }
  }

  if (current.trim().length > 0) {
    items.push(current.trim());
  }

  return items;
}

/**
 * @param {Conditional[]} conditions
 * @param {Set<number>} activeIndicators
 */
export function conditionsPass(conditions, activeIndicators) {
  if (!conditions || conditions.length === 0) {
    return true;
  }
  return conditions.every(c => activeIndicators.has(Number(c.indicator)) !== !!c.negate);
}
