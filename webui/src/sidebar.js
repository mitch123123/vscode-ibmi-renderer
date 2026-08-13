/** @typedef {import('../../src/shared/dspf-types').FieldInfoData} FieldInfo */
/** @typedef {import('../../src/shared/dspf-types').Keyword} Keyword */
/** @typedef {import('../../src/shared/dspf-types').RecordInfoData} RecordInfo */

import { createKeywordPanel, createValuesPanel, renderSections, clearKeywordEditor } from "./keywordEditor.js";
import { renderPalette } from "./palette.js";
import { renderIndicatorPanel } from "./indicators.js";
import { showHostError } from "./hostDialogs.js";
import { stripKeywordsForTypeChange } from "./fieldTypeKeywords.js";
import { fieldPropertyConstraints } from "./propInputLimits.js";
import { formatOverlapWarning, validateFieldScreenFit } from "./coords.js";
import {
  isValidFieldName,
  isValidRecordName,
  FIELD_NAME_HINT,
  DDS_MAX_LENGTH,
  DDS_MAX_DECIMALS,
} from "../../src/shared/recordName.ts";

/**
 * Parse a non-negative integer from a property string. Empty → undefined.
 * @param {string|undefined|null} raw
 * @param {string} label
 * @param {number} max
 * @returns {{ ok: true, value: number|undefined } | { ok: false, error: string }}
 */
function parseOptionalNonNegInt(raw, label, max) {
  const s = String(raw ?? ``).trim();
  if (s === ``) {
    return { ok: true, value: undefined };
  }
  if (!/^\d+$/.test(s)) {
    return { ok: false, error: `${label} must be a non-negative integer.` };
  }
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    return { ok: false, error: `${label} must be an integer from 0 to ${max}.` };
  }
  return { ok: true, value: n };
}

/**
 * Parse a required positive integer.
 * @param {string|undefined|null} raw
 * @param {string} label
 * @returns {{ ok: true, value: number } | { ok: false, error: string }}
 */
function parsePositiveInt(raw, label) {
  const s = String(raw ?? ``).trim();
  if (!/^\d+$/.test(s)) {
    return { ok: false, error: `${label} must be a positive integer.` };
  }
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1) {
    return { ok: false, error: `${label} must be a positive integer.` };
  }
  return { ok: true, value: n };
}

/**
 * WINDOW value: four positive integers (`row col height width`) or a record name.
 * @param {string} raw
 * @returns {string|undefined} error message, or undefined if valid
 */
export function validateWindowValue(raw) {
  const s = String(raw || ``).trim();
  if (!s) {
    return `WINDOW value is required.`;
  }
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    if (!isValidRecordName(parts[0])) {
      return `WINDOW reference must be a valid record name. ${FIELD_NAME_HINT}`;
    }
    return undefined;
  }
  if (parts.length !== 4) {
    return `WINDOW must be four positive integers (row col height width) or a record-format name.`;
  }
  for (const p of parts) {
    if (!/^\d+$/.test(p) || Number(p) < 1) {
      return `WINDOW row, col, height, and width must be positive integers.`;
    }
  }
  return undefined;
}
/**
 * Shared prop-form helpers for Format sidebar panels.
 * @param {string} text
 * @returns {HTMLElement}
 */
function propLabel(text) {
  const el = document.createElement(`div`);
  el.className = `prop-label`;
  el.textContent = text;
  return el;
}

/**
 * @param {string} label
 * @param {HTMLElement} control
 * @returns {HTMLElement}
 */
function propRow(label, control) {
  const row = document.createElement(`div`);
  row.className = `prop-row`;
  row.appendChild(propLabel(label));
  const controlWrap = document.createElement(`div`);
  controlWrap.className = `prop-control`;
  controlWrap.appendChild(control);
  row.appendChild(controlWrap);
  return row;
}

/**
 * @param {string} text
 * @returns {HTMLElement}
 */
function propHint(text) {
  const hint = document.createElement(`div`);
  hint.className = `palette-hint prop-hint`;
  hint.textContent = text;
  return hint;
}

/**
 * @param {string} label
 * @returns {HTMLElement}
 */
function propApplyButton(label) {
  const apply = document.createElement(`vscode-button`);
  apply.className = `prop-apply-btn`;
  apply.innerText = label;
  return apply;
}

/**
 * @param {RecordInfo} recordInfo
 * @param {RecordInfo|undefined} globalInfo
 * @param {RecordInfo[]} allFormats
 * @param {string[]} overlayFormats
 * @param {(keywords: Keyword[]) => void} [onFormatUpdate]
 * @param {(overlays: string[]) => void} onOverlayChange
 * @param {(keywords: Keyword[]) => void} [onFileUpdate]
 * @param {(fieldName: string|undefined) => void} [onSelectField]
 */
export function updateRecordFormatSidebar(recordInfo, globalInfo, allFormats, overlayFormats, onFormatUpdate, onOverlayChange, onFileUpdate, onSelectField) {
  const sidebar = document.getElementById(`recordFormatSidebar`);
  /** @type {{title: string, html: string|Element, open?: boolean}[]} */
  let sections = [];

  if (globalInfo) {
    sections.push({
      title: `File Keywords`,
      html: createKeywordPanel(`keywords-${globalInfo.name}`, globalInfo.keywords, onFileUpdate, `file`),
      open: false
    });
  }

  sections.push({
    title: `Format Keywords`,
    html: createKeywordPanel(`keywords-${recordInfo.name}`, recordInfo.keywords, onFormatUpdate, `format`),
    open: false
  });

  // Subfile control helpers
  const sflCtl = (recordInfo.keywords || []).find((k) => k.name === `SFLCTL`);
  if (sflCtl && onFormatUpdate) {
    const helpers = document.createElement(`div`);
    helpers.className = `panel-section sfl-helpers`;
    helpers.appendChild(propHint(`Edit rows on the ${sflCtl.value || `SFL`} tab. Adjust page size here.`));

    const pag = (recordInfo.keywords || []).find((k) => k.name === `SFLPAG`);
    const siz = (recordInfo.keywords || []).find((k) => k.name === `SFLSIZ`);
    const endKw = (recordInfo.keywords || []).find((k) => k.name === `SFLEND`);

    const pagInput = document.createElement(`vscode-textfield`);
    pagInput.setAttribute(`value`, pag?.value || `10`);
    const sizInput = document.createElement(`vscode-textfield`);
    sizInput.setAttribute(`value`, siz?.value || pag?.value || `10`);
    const endSelect = document.createElement(`select`);
    endSelect.className = `prop-select`;
    for (const o of [``, `*MORE`, `*SCRBAR`]) {
      const opt = document.createElement(`option`);
      opt.value = o;
      opt.textContent = o || `(none)`;
      if ((endKw?.value || ``) === o) {
        opt.selected = true;
      }
      endSelect.appendChild(opt);
    }

    helpers.appendChild(propRow(`SFLPAG`, pagInput));
    helpers.appendChild(propRow(`SFLSIZ`, sizInput));
    helpers.appendChild(propRow(`SFLEND`, endSelect));

    const apply = propApplyButton(`Apply subfile sizes`);
    apply.onclick = () => {
      /** @type {any} */
      const pEl = pagInput;
      /** @type {any} */
      const sEl = sizInput;
      const pRaw = String(pEl.value || pagInput.getAttribute(`value`) || `10`).trim();
      const sRaw = String(sEl.value || sizInput.getAttribute(`value`) || pRaw).trim();
      const pParsed = parsePositiveInt(pRaw, `SFLPAG`);
      if (!pParsed.ok) {
        showHostError(pParsed.error);
        return;
      }
      const sParsed = parsePositiveInt(sRaw, `SFLSIZ`);
      if (!sParsed.ok) {
        showHostError(sParsed.error);
        return;
      }
      if (sParsed.value < pParsed.value) {
        showHostError(`SFLSIZ must be greater than or equal to SFLPAG.`);
        return;
      }
      /** @type {Keyword[]} */
      const next = JSON.parse(JSON.stringify(recordInfo.keywords || []));
      const upsert = (name, value) => {
        const i = next.findIndex((k) => k.name === name);
        if (i >= 0) {
          next[i].value = value;
        } else {
          next.push({ name, value, conditions: [] });
        }
      };
      upsert(`SFLPAG`, String(pParsed.value));
      upsert(`SFLSIZ`, String(sParsed.value));
      const endIdx = next.findIndex((k) => k.name === `SFLEND`);
      if (endSelect.value) {
        if (endIdx >= 0) {
          next[endIdx].value = endSelect.value;
        } else {
          next.push({ name: `SFLEND`, value: endSelect.value, conditions: [] });
        }
      } else if (endIdx >= 0) {
        next.splice(endIdx, 1);
      }
      onFormatUpdate(next);
    };
    helpers.appendChild(apply);

    sections.push({ title: `Subfile control`, html: helpers, open: false });
  }

  // Window helpers
  const winKw = (recordInfo.keywords || []).find((k) => k.name === `WINDOW`);
  if (winKw && onFormatUpdate) {
    const helpers = document.createElement(`div`);
    helpers.className = `panel-section`;
    helpers.appendChild(propHint(`Drag the blue handle on the canvas to resize, or edit WINDOW / title / border here.`));

    const winInput = document.createElement(`vscode-textfield`);
    winInput.setAttribute(`value`, winKw.value || `5 10 12 40`);
    const titleKw = (recordInfo.keywords || []).find((k) => k.name === `WDWTITLE`);
    const titleInput = document.createElement(`vscode-textfield`);
    titleInput.setAttribute(`value`, titleKw?.value || `*TEXT 'Title' *COLOR BLU *TOP *CENTER`);
    const borderKw = (recordInfo.keywords || []).find((k) => k.name === `WDWBORDER`);
    const borderColor = document.createElement(`select`);
    borderColor.className = `prop-select`;
    for (const c of [`BLU`, `GRN`, `WHT`, `RED`, `TRQ`, `YLW`, `PNK`]) {
      const o = document.createElement(`option`);
      o.value = c;
      o.textContent = c;
      const current = (borderKw?.value || `*COLOR BLU`).toUpperCase();
      if (current.includes(c)) {
        o.selected = true;
      }
      borderColor.appendChild(o);
    }
    helpers.appendChild(propRow(`WINDOW (row col height width)`, winInput));
    helpers.appendChild(propRow(`WDWTITLE`, titleInput));
    helpers.appendChild(propRow(`WDWBORDER *COLOR`, borderColor));

    const apply = propApplyButton(`Apply window`);
    apply.onclick = () => {
      /** @type {any} */
      const wEl = winInput;
      /** @type {any} */
      const tEl = titleInput;
      const wVal = String(wEl.value || winInput.getAttribute(`value`) || ``).trim();
      const tVal = String(tEl.value || titleInput.getAttribute(`value`) || ``).trim();
      const winError = validateWindowValue(wVal);
      if (winError) {
        showHostError(winError);
        return;
      }
      /** @type {Keyword[]} */
      const next = JSON.parse(JSON.stringify(recordInfo.keywords || []));
      const upsert = (name, value) => {
        const i = next.findIndex((k) => k.name === name);
        if (i >= 0) {
          next[i].value = value;
        } else {
          next.push({ name, value, conditions: [] });
        }
      };
      if (wVal) {
        upsert(`WINDOW`, wVal);
      }
      if (tVal) {
        upsert(`WDWTITLE`, tVal);
      }
      upsert(`WDWBORDER`, `*COLOR ${borderColor.value}`);
      onFormatUpdate(next);
    };
    helpers.appendChild(apply);
    sections.push({ title: `Window`, html: helpers, open: false });
  }

  // Field list (SDA F4)
  const fieldList = document.createElement(`div`);
  fieldList.className = `field-list`;
  const fields = (recordInfo.fields || []).filter((f) => f.displayType !== `hidden`);
  if (fields.length === 0) {
    const empty = document.createElement(`div`);
    empty.className = `panel-empty`;
    empty.textContent = `No fields yet`;
    fieldList.appendChild(empty);
  } else {
    for (const f of fields) {
      const row = document.createElement(`button`);
      row.type = `button`;
      row.className = `field-list-item`;
      const usage = f.displayType || ``;
      row.textContent = `${f.name || `(const)`}  r${f.position?.y ?? `?`} c${f.position?.x ?? `?`}  ${usage}  len ${f.length ?? 0}`;
      row.title = row.textContent;
      row.onclick = () => {
        if (typeof onSelectField === `function`) {
          onSelectField(f.name);
        }
      };
      fieldList.appendChild(row);
    }
  }
  sections.push({ title: `Fields`, html: fieldList, open: false });

  // Overlay multi-select
  const overlayDiv = document.createElement(`div`);
  overlayDiv.className = `panel-section overlay-list`;
  const formats = allFormats.filter(f => f.name !== `_GLOBAL` && f.name !== recordInfo.name);
  if (formats.length > 0) {
    const label = document.createElement(`div`);
    label.className = `prop-label`;
    label.textContent = `Overlay formats`;
    overlayDiv.appendChild(label);
    for (const f of formats) {
      const row = document.createElement(`label`);
      row.className = `overlay-list-item`;
      const cb = document.createElement(`input`);
      cb.type = `checkbox`;
      cb.checked = overlayFormats.includes(f.name);
      cb.addEventListener(`change`, () => {
        const next = cb.checked
          ? [...new Set([...overlayFormats, f.name])]
          : overlayFormats.filter(n => n !== f.name);
        onOverlayChange(next);
      });
      row.appendChild(cb);
      row.appendChild(document.createTextNode(` ${f.name}`));
      overlayDiv.appendChild(row);
    }
  } else {
    const empty = document.createElement(`div`);
    empty.className = `panel-empty`;
    empty.textContent = `No other formats to overlay`;
    overlayDiv.appendChild(empty);
  }

  sections.push({
    title: `Overlays`,
    html: overlayDiv,
    open: false
  });

  const indicatorHost = document.createElement(`div`);
  indicatorHost.id = `indicatorPanelHost`;
  indicatorHost.className = `panel-section`;
  sections.push({
    title: `Runtime Indicators`,
    html: indicatorHost,
    open: false
  });

  renderSections(sidebar, sections);
  renderIndicatorPanel(indicatorHost);
}

/**
 * @param {(field: Partial<FieldInfo>) => void} onCreate
 * @param {{
 *   existingNames?: string[],
 *   onCreateRecord?: (request: import('./palette.js').NewRecordRequest) => void,
 *   onBrowseDatabase?: () => void,
 * }} [opts]
 */
export function showFieldPalette(onCreate, opts) {
  clearKeywordEditor();
  const sidebar = document.getElementById(`fieldInfoSidebar`);
  renderPalette(sidebar, onCreate, opts);
}

const DISPLAY_TYPE_OPTIONS = [
  { value: `input`, label: `input (I)` },
  { value: `output`, label: `output (O)` },
  { value: `both`, label: `both (B)` },
  { value: `hidden`, label: `hidden (H)` },
  { value: `message`, label: `message (M)` },
  { value: `program`, label: `program (P)` },
  { value: `const`, label: `const (text)` },
];

const DDS_TYPE_OPTIONS = [
  { value: ``, label: `(blank)` },
  { value: `A`, label: `A — Character` },
  { value: `S`, label: `S — Zoned decimal` },
  { value: `P`, label: `P — Packed decimal` },
  { value: `Y`, label: `Y — Numeric edit` },
  { value: `L`, label: `L — Date` },
  { value: `T`, label: `T — Time` },
  { value: `Z`, label: `Z — Timestamp` },
  { value: `F`, label: `F — Floating point` },
  { value: `I`, label: `I — Integer` },
  { value: `U`, label: `U — Unsigned` },
  { value: `B`, label: `B — Binary` },
  { value: `R`, label: `R — Reference` },
];

const NUMERIC_DDS_TYPES = new Set([`S`, `P`, `Y`, `F`, `I`, `U`, `B`]);

/**
 * @param {FieldInfo} fieldInfo
 * @param {Record<string, string>} newProps
 * @returns {{ ok: true, field: FieldInfo } | { ok: false, error: string }}
 */
function normalizeFieldProps(fieldInfo, newProps) {
  const prevDisplay = fieldInfo.displayType;
  const prevType = (fieldInfo.type || ``).toUpperCase();

  let length = fieldInfo.length;
  if (newProps.length !== undefined) {
    const parsed = parseOptionalNonNegInt(newProps.length, `Length`, DDS_MAX_LENGTH);
    if (!parsed.ok) {
      return parsed;
    }
    length = parsed.value;
  }

  let decimals = fieldInfo.decimals ?? 0;
  if (newProps.decimals !== undefined) {
    const parsed = parseOptionalNonNegInt(newProps.decimals, `Decimals`, DDS_MAX_DECIMALS);
    if (!parsed.ok) {
      return parsed;
    }
    decimals = parsed.value ?? 0;
  }

  /** @type {FieldInfo} */
  const next = {
    ...fieldInfo,
    name: newProps.name !== undefined ? newProps.name.trim().toUpperCase() : fieldInfo.name,
    value: newProps.value !== undefined ? newProps.value : fieldInfo.value,
    displayType: /** @type {FieldInfo['displayType']} */ (
      newProps.displayType !== undefined ? newProps.displayType : fieldInfo.displayType
    ),
    type: newProps.type !== undefined ? (newProps.type.trim() || undefined) : fieldInfo.type,
    length,
    decimals,
  };

  if (newProps.reference !== undefined) {
    const ref = newProps.reference.trim();
    next.reference = ref || undefined;
  }

  // Switching to constant text
  if (next.displayType === `const`) {
    if (!next.value) {
      next.value = next.name || fieldInfo.value || `Constant`;
    }
    next.type = undefined;
    next.isReference = false;
    next.primitiveType = `char`;
    if (next.length == null && next.value) {
      next.length = String(next.value).length;
    }
  }

  // Switching from const to a named field usage
  if (prevDisplay === `const` && next.displayType && next.displayType !== `const`) {
    if (!next.name) {
      const base = String(next.value || `FIELD`).replace(/[^A-Za-z0-9@#$]/g, ``).toUpperCase() || `FIELD`;
      next.name = base.substring(0, 10);
    }
    if (!next.type || !String(next.type).trim()) {
      next.type = `A`;
    }
    if (next.length == null || next.length === 0) {
      next.length = Math.max(1, String(next.value || ``).length || 10);
    }
  }

  // Named fields need a name
  if (next.displayType !== `const` && !next.name) {
    next.name = `FIELD1`;
  }

  if (next.displayType !== `const` && next.name && !isValidFieldName(next.name)) {
    return { ok: false, error: `Invalid field name. ${FIELD_NAME_HINT}` };
  }

  if (next.length != null && next.decimals > next.length) {
    return { ok: false, error: `Decimals (${next.decimals}) cannot exceed length (${next.length}).` };
  }

  const typeUpper = (next.type || ``).toUpperCase();
  if (typeUpper === `R`) {
    next.isReference = true;
    next.type = `R`;
  } else if (next.type) {
    next.isReference = false;
  }

  if (typeUpper && NUMERIC_DDS_TYPES.has(typeUpper)) {
    next.primitiveType = `decimal`;
  } else if (next.displayType !== `const`) {
    next.primitiveType = `char`;
  }

  stripKeywordsForTypeChange(next, prevType, typeUpper);

  /** Parse SDA-style indicator slots: "05", "N20", blank */
  const parseCond = (raw) => {
    const s = String(raw || ``).trim().toUpperCase();
    if (!s) {
      return undefined;
    }
    const negate = s.startsWith(`N`);
    const num = Number(negate ? s.slice(1) : s);
    if (!Number.isInteger(num) || num < 1 || num > 99) {
      return undefined;
    }
    return { indicator: num, negate };
  };
  const c1 = parseCond(newProps.cond1);
  const c2 = parseCond(newProps.cond2);
  const c3 = parseCond(newProps.cond3);
  if (newProps.cond1 !== undefined || newProps.cond2 !== undefined || newProps.cond3 !== undefined) {
    next.conditions = [c1, c2, c3].filter(Boolean);
  }

  return { ok: true, field: next };
}

/**
 * @param {FieldInfo} fieldInfo
 * @param {(field: FieldInfo) => void} onUpdate
 * @param {() => void} onDelete
 * @param {{ generalTools?: HTMLElement, bounds?: { maxX: number, maxY: number }, peerFields?: FieldInfo[] }} [opts]
 */
export function updateSelectedFieldSidebar(fieldInfo, onUpdate, onDelete, opts = {}) {
  const sidebar = document.getElementById(`fieldInfoSidebar`);
  const limits = fieldPropertyConstraints();

  /** @type {{label: string, id?: string, value: any, options?: Array<string|{value: string, label: string}>, constraints?: object}[]} */
  const properties = [
    { label: `Name`, value: fieldInfo.name || ``, id: `name`, constraints: limits.name },
    {
      label: `Display Type`,
      value: fieldInfo.displayType || `output`,
      id: `displayType`,
      options: DISPLAY_TYPE_OPTIONS,
    },
    {
      label: `Type`,
      value: fieldInfo.type || ``,
      id: `type`,
      options: DDS_TYPE_OPTIONS,
    },
    { label: `Length`, value: fieldInfo.length ?? ``, id: `length`, constraints: limits.length },
    { label: `Decimals`, value: fieldInfo.decimals ?? 0, id: `decimals`, constraints: limits.decimals },
    { label: `Value`, value: fieldInfo.value ?? ``, id: `value`, constraints: limits.value },
    { label: `Position`, value: `${fieldInfo.position.x}, ${fieldInfo.position.y}` },
    {
      label: `Ind 1`,
      value: fieldInfo.conditions?.[0]
        ? `${fieldInfo.conditions[0].negate ? `N` : ``}${fieldInfo.conditions[0].indicator}`
        : ``,
      id: `cond1`,
      constraints: limits.cond1,
    },
    {
      label: `Ind 2`,
      value: fieldInfo.conditions?.[1]
        ? `${fieldInfo.conditions[1].negate ? `N` : ``}${fieldInfo.conditions[1].indicator}`
        : ``,
      id: `cond2`,
      constraints: limits.cond2,
    },
    {
      label: `Ind 3`,
      value: fieldInfo.conditions?.[2]
        ? `${fieldInfo.conditions[2].negate ? `N` : ``}${fieldInfo.conditions[2].indicator}`
        : ``,
      id: `cond3`,
      constraints: limits.cond3,
    },
  ];

  if (fieldInfo.isReference || fieldInfo.reference || (fieldInfo.type || ``).toUpperCase() === `R`) {
    properties.push({
      label: `Reference`,
      value: fieldInfo.reference || ``,
      id: `reference`,
      constraints: limits.reference,
    });
  }

  const keywordsHost = document.createElement(`div`);
  keywordsHost.className = `keywords-section`;
  if (opts.generalTools) {
    keywordsHost.appendChild(opts.generalTools);
  }
  keywordsHost.appendChild(
    createKeywordPanel(`keywords-${fieldInfo.name || `field`}`, fieldInfo.keywords || [], (keywords) => {
      onUpdate({ ...fieldInfo, keywords });
    }, `field`)
  );

  /** @type {{title: string, html: string|Element, open?: boolean}[]} */
  const sections = [
    {
      title: `Properties`,
      open: true,
      html: createValuesPanel(`properties-${fieldInfo.name || `field`}`, properties, (newProps) => {
        const result = normalizeFieldProps(fieldInfo, newProps);
        if (!result.ok) {
          showHostError(result.error);
          return;
        }
        if (opts.bounds) {
          const fitError = validateFieldScreenFit(result.field, opts.bounds);
          if (fitError) {
            showHostError(fitError);
            return;
          }
        }
        onUpdate(result.field);
      }),
    },
    {
      title: `Keywords`,
      open: true,
      html: keywordsHost,
    },
  ];

  renderSections(sidebar, sections);

  const overlapMsg = formatOverlapWarning(fieldInfo, opts.peerFields);
  if (overlapMsg) {
    const warn = document.createElement(`div`);
    warn.className = `panel-overlap-warning`;
    warn.setAttribute(`role`, `alert`);
    warn.textContent = overlapMsg;
    sidebar.insertBefore(warn, sidebar.firstChild);
  }

  const deleteButton = document.createElement(`vscode-button`);
  deleteButton.setAttribute(`secondary`, `true`);
  deleteButton.className = `panel-delete-btn`;
  deleteButton.innerText = `Delete`;
  deleteButton.addEventListener(`click`, onDelete);
  sidebar.appendChild(deleteButton);
}
