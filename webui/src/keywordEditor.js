/** @typedef {import('../../src/shared/dspf-types').Keyword} Keyword */
/** @typedef {import('./keywordCatalog.js').KeywordLevel} KeywordLevel */
/** @typedef {import('./keywordCatalog.js').KeywordDef} KeywordDef */

import {
  findKeywordDef,
  keywordConflicts,
  keywordNameOptionsGrouped,
} from "./keywordCatalog.js";
import {
  keywordsChanged,
  readPropValuesFromElement,
} from "./fieldEditState.js";

/** @type {WeakMap<HTMLElement, { getKeywords: () => Keyword[], isDirty: () => boolean }>} */
const keywordPanelApi = new WeakMap();

/** @type {(() => boolean)|null} */
let commitOpenKeywordEditor = null;

/**
 * @param {HTMLElement} panel
 */
export function getKeywordPanelApi(panel) {
  return keywordPanelApi.get(panel);
}

export function isKeywordEditorOpen() {
  const keywordEditorArea = document.getElementById(`keywordEditorArea`);
  return !!(keywordEditorArea && keywordEditorArea.childElementCount > 0);
}

/**
 * Confirm an in-progress keyword add/edit if a name is present; otherwise close it.
 * @returns {boolean}
 */
export function tryCommitKeywordEditor() {
  if (!isKeywordEditorOpen()) {
    return true;
  }
  if (commitOpenKeywordEditor) {
    return commitOpenKeywordEditor();
  }
  clearKeywordEditor();
  return true;
}

/**
 * Live Format Keywords panel list, falling back to the last-rendered model.
 * Commits an open Confirm first so Apply window / WINDOW drag do not clobber it.
 * @param {string} formatName
 * @param {Keyword[]|undefined} fallback
 * @returns {Keyword[]}
 */
export function liveFormatKeywords(formatName, fallback) {
  tryCommitKeywordEditor();
  const panel = typeof document !== `undefined`
    ? document.getElementById(`keywords-${formatName}`)
    : null;
  const api = panel ? getKeywordPanelApi(panel) : undefined;
  const source = api?.getKeywords() ?? fallback ?? [];
  return JSON.parse(JSON.stringify(source));
}

/**
 * @param {string} id
 * @param {Keyword[]} inputKeywords
 * @param {(keywords: Keyword[]) => void} [onUpdate]
 * @param {KeywordLevel} [level]
 */
export function createKeywordPanel(id, inputKeywords, onUpdate, level = `field`) {
  /** @type {Keyword[]} */
  const originalKeywords = JSON.parse(JSON.stringify(inputKeywords || []));
  /** @type {Keyword[]} */
  const keywords = JSON.parse(JSON.stringify(inputKeywords || []));

  const section = document.createElement(`div`);
  section.id = id;

  const tree = document.createElement(`vscode-tree`);
  tree.id = id + `-tree`;

  const actions = onUpdate ? [
    { icon: "edit", actionId: "edit", tooltip: "Edit" },
    { icon: "trash", actionId: "delete", tooltip: "Delete" },
  ] : [];

  const icons = {
    branch: 'folder',
    leaf: 'circle-filled',
    open: 'folder-opened',
  };

  /** @type {HTMLDivElement|null} */
  let conflictWarning = null;

  const refreshConflictWarnings = () => {
    if (!conflictWarning) {
      return;
    }
    const messages = keywordConflicts(keywords);
    if (messages.length === 0) {
      conflictWarning.style.display = `none`;
      conflictWarning.textContent = ``;
      return;
    }
    conflictWarning.style.display = `block`;
    conflictWarning.textContent = messages.join(` `);
  };

  const rerenderTree = () => {
    tree.data = keywords.map((keyword) => ({
      icons,
      label: keyword.name,
      value: keyword,
      description: keyword.value,
      actions,
      subItems: (keyword.conditions || []).map(c => ({
        label: String(c.indicator),
        description: c.negate ? `Negated` : undefined,
        icons
      })),
    }));
    refreshConflictWarnings();
  };

  rerenderTree();

  tree.addEventListener('vsc-run-action', (event) => {
    /** @type {Keyword} */
    const currentKeyword = event.detail.value;
    const oldKeywordIndex = keywords.findIndex(k => k.name === currentKeyword.name && k.value === currentKeyword.value);

    switch (event.detail.actionId) {
      case `delete`:
        if (oldKeywordIndex >= 0) {
          keywords.splice(oldKeywordIndex, 1);
        }
        rerenderTree();
        break;

      case `edit`:
        editKeyword((newKeyword) => {
          if (oldKeywordIndex >= 0) {
            keywords[oldKeywordIndex] = newKeyword;
          } else {
            keywords.push(newKeyword);
          }
          clearKeywordEditor();
          rerenderTree();
        }, event.detail.value, level);
        break;
    }
  });

  section.appendChild(tree);

  if (onUpdate) {
    const newKeyword = document.createElement(`vscode-button`);
    newKeyword.setAttribute(`icon`, `add`);
    newKeyword.innerText = `New Keyword`;
    newKeyword.className = `keyword-action-btn`;

    newKeyword.addEventListener(`click`, () => {
      editKeyword((kw) => {
        keywords.push(kw);
        clearKeywordEditor();
        rerenderTree();
      }, undefined, level);
    });

    conflictWarning = document.createElement(`div`);
    conflictWarning.className = `keyword-conflict-warning`;

    const updateButton = document.createElement(`vscode-button`);
    updateButton.innerText = `Update`;
    updateButton.className = `keyword-action-btn`;
    updateButton.addEventListener(`click`, () => {
      refreshConflictWarnings();
      onUpdate(keywords);
    });

    section.appendChild(newKeyword);
    section.appendChild(conflictWarning);
    section.appendChild(updateButton);
    refreshConflictWarnings();
  }

  keywordPanelApi.set(section, {
    getKeywords: () => keywords,
    isDirty: () => keywordsChanged(originalKeywords, keywords),
  });

  return section;
}

/**
 * @typedef {{ label: string, id?: string, value: any, options?: Array<string|{value: string, label: string}> }} PropertyRow
 */

/**
 * @typedef {{ maxLength?: number, filter?: (raw: string) => string, title?: string, inputMode?: string }} PropConstraints
 * @typedef {{ label: string, id?: string, value: any, options?: Array<string|{value: string, label: string}>, constraints?: PropConstraints }} PropertyRow
 */

/**
 * @param {string} id
 * @param {PropertyRow[]} properties
 * @param {(newProps: Record<string, string>) => void} onUpdate
 */
export function createValuesPanel(id, properties, onUpdate) {
  const section = document.createElement(`div`);
  section.id = id;

  const createLabelCell = (label) => {
    const cell = document.createElement(`vscode-table-cell`);
    cell.innerText = label;
    return cell;
  };

  /**
   * @param {string} fieldId
   * @param {any} value
   * @param {string} labelText
   * @param {PropConstraints} [constraints]
   */
  const createInputCell = (fieldId, value, labelText, constraints) => {
    const cell = document.createElement(`vscode-table-cell`);
    const input = document.createElement(`input`);
    input.type = `text`;
    input.id = fieldId;
    input.className = `prop-input`;
    input.dataset.propId = fieldId;
    input.spellcheck = false;
    input.autocomplete = `off`;
    input.setAttribute(`aria-label`, labelText || fieldId);

    let initial = value == null ? `` : String(value);
    if (constraints?.filter) {
      initial = constraints.filter(initial);
    }
    input.value = initial;

    if (constraints?.maxLength != null) {
      input.maxLength = constraints.maxLength;
    }
    if (constraints?.title) {
      input.title = constraints.title;
      input.setAttribute(`aria-description`, constraints.title);
    }
    if (constraints?.inputMode) {
      input.inputMode = constraints.inputMode;
    }

    if (constraints?.filter) {
      const applyFilter = () => {
        const before = input.value;
        const next = constraints.filter(before);
        if (next === before) {
          return;
        }
        const caret = input.selectionStart;
        input.value = next;
        if (typeof caret === `number`) {
          const delta = before.length - next.length;
          const pos = Math.max(0, Math.min(next.length, caret - Math.max(0, delta)));
          try {
            input.setSelectionRange(pos, pos);
          } catch {
            // Some input types disallow selection ranges; ignore.
          }
        }
      };
      input.addEventListener(`input`, applyFilter);
      input.addEventListener(`blur`, applyFilter);
    }

    cell.appendChild(input);
    return cell;
  };

  const createSelectCell = (fieldId, value, options) => {
    const cell = document.createElement(`vscode-table-cell`);
    const select = document.createElement(`select`);
    select.id = fieldId;
    select.className = `prop-select`;
    select.dataset.propId = fieldId;
    for (const opt of options) {
      const option = document.createElement(`option`);
      if (typeof opt === `string`) {
        option.value = opt;
        option.textContent = opt === `` ? `(blank)` : opt;
      } else {
        option.value = opt.value;
        option.textContent = opt.label;
      }
      if (option.value === String(value ?? ``)) {
        option.selected = true;
      }
      select.appendChild(option);
    }
    const current = String(value ?? ``);
    if (current && ![...select.options].some((o) => o.value === current)) {
      const option = document.createElement(`option`);
      option.value = current;
      option.textContent = current;
      option.selected = true;
      select.appendChild(option);
    }
    cell.appendChild(select);
    return cell;
  };

  const table = document.createElement(`vscode-table`);
  const tableBody = document.createElement(`vscode-table-body`);
  const hasEditableData = properties.some((prop) => prop.id !== undefined);

  for (let prop of properties) {
    const row = document.createElement(`vscode-table-row`);
    row.appendChild(createLabelCell(prop.label));
    if (prop.id && prop.options) {
      row.append(createSelectCell(prop.id, prop.value, prop.options));
    } else if (prop.id) {
      row.append(createInputCell(prop.id, prop.value, prop.label, prop.constraints));
    } else {
      row.append(createLabelCell(String(prop.value ?? ``)));
    }
    tableBody.appendChild(row);
  }

  table.appendChild(tableBody);
  section.appendChild(table);

  if (hasEditableData) {
    const updateButton = document.createElement(`vscode-button`);
    updateButton.innerText = `Update`;
    updateButton.className = `keyword-action-btn`;
    updateButton.addEventListener(`click`, () => {
      onUpdate(readPropValuesFromElement(section));
    });
    section.appendChild(updateButton);
  }

  return section;
}

export function clearKeywordEditor() {
  commitOpenKeywordEditor = null;
  const keywordEditorArea = document.getElementById(`keywordEditorArea`);
  if (keywordEditorArea) {
    keywordEditorArea.innerHTML = ``;
  }
}

/** Ensure the right sidebar is visible so the keyword form can be used. */
export function ensureRightSidebarVisible() {
  const sidebar = document.getElementById(`rightSidebar`);
  const rail = document.getElementById(`expandRightSidebar`);
  const layout = document.getElementById(`appLayout`);
  const rightSplitter = document.getElementById(`rightSplitter`);
  const bottomSplitter = document.getElementById(`bottomSplitter`);
  if (sidebar) {
    sidebar.classList.remove(`collapsed`);
  }
  if (rail) {
    rail.hidden = true;
  }
  const dock = layout?.dataset.fieldsDock || `side`;
  if (dock === `bottom`) {
    if (bottomSplitter) {
      bottomSplitter.hidden = false;
    }
    if (rightSplitter) {
      rightSplitter.hidden = true;
    }
  } else {
    if (rightSplitter) {
      rightSplitter.hidden = false;
    }
    if (bottomSplitter) {
      bottomSplitter.hidden = true;
    }
  }
}

/**
 * @param {(keyword: Keyword) => void} onUpdate
 * @param {Keyword} [keyword]
 * @param {KeywordLevel} [level]
 */
export function editKeyword(onUpdate, keyword, level = `field`) {
  const group = document.createElement(`vscode-form-group`);
  group.id = `currentKeywordEditor`;
  group.setAttribute(`variant`, `vertical`);
  group.className = `keyword-form-group`;

  const createLabel = (label, forId) => {
    const labelElement = document.createElement(`vscode-label`);
    labelElement.setAttribute(`for`, forId);
    labelElement.innerText = label;
    return labelElement;
  };

  const createTextField = (id, value, placeholder) => {
    const input = document.createElement(`vscode-textfield`);
    input.setAttribute(`id`, id);
    input.setAttribute(`value`, value || ``);
    if (placeholder) {
      input.setAttribute(`placeholder`, placeholder);
    }
    return input;
  };

  const createNativeSelect = (id, options, selected) => {
    const select = document.createElement(`select`);
    select.id = id;
    select.className = `prop-select keyword-select`;
    for (const o of options) {
      const option = document.createElement(`option`);
      option.value = o.value;
      option.textContent = o.label;
      if (option.value === String(selected ?? ``)) {
        option.selected = true;
      }
      select.appendChild(option);
    }
    const current = String(selected ?? ``);
    if (current && ![...select.options].some((o) => o.value === current)) {
      const option = document.createElement(`option`);
      option.value = current;
      option.textContent = current;
      option.selected = true;
      select.appendChild(option);
    }
    return select;
  };

  /**
   * @param {string} id
   * @param {Array<{ group: string, options: Array<{ value: string, label: string }> }>} groups
   * @param {string} [selected]
   */
  const createGroupedNativeSelect = (id, groups, selected) => {
    const select = document.createElement(`select`);
    select.id = id;
    select.className = `prop-select keyword-select`;

    const custom = document.createElement(`option`);
    custom.value = ``;
    custom.textContent = `(custom / type below)`;
    select.appendChild(custom);

    for (const g of groups) {
      const og = document.createElement(`optgroup`);
      og.label = g.group;
      for (const o of g.options) {
        const option = document.createElement(`option`);
        option.value = o.value;
        option.textContent = o.label;
        og.appendChild(option);
      }
      select.appendChild(og);
    }

    const current = String(selected ?? ``);
    if (current && ![...select.options].some((o) => o.value === current)) {
      const option = document.createElement(`option`);
      option.value = current;
      option.textContent = current;
      select.appendChild(option);
    }
    select.value = current && [...select.options].some((o) => o.value === current) ? current : ``;
    return select;
  };

  const createIndicatorSelect = (id, defaultValue) => {
    const select = document.createElement(`vscode-single-select`);
    select.setAttribute(`id`, id);
    const options = [`None`];
    for (let i = 1; i <= 99; i++) {
      options.push(String(i));
    }
    options.forEach(option => {
      const optionElement = document.createElement(`vscode-option`);
      optionElement.setAttribute(`value`, option);
      optionElement.innerText = option;
      if (String(option) === String(defaultValue)) {
        optionElement.setAttribute(`selected`, `true`);
      }
      select.appendChild(optionElement);
    });
    return select;
  };

  const createCheckbox = (id, label, checked) => {
    const checkbox = document.createElement(`vscode-checkbox`);
    checkbox.setAttribute(`id`, id);
    checkbox.setAttribute(`label`, label);
    if (checked) {
      checkbox.setAttribute(`checked`, checked);
    }
    return checkbox;
  };

  // —— Keyword name (catalog dropdown + custom text) ——
  group.appendChild(createLabel(`Keyword`, `keywordPick`));
  const nameSelect = createGroupedNativeSelect(
    `keywordPick`,
    keywordNameOptionsGrouped(level),
    keyword?.name && findKeywordDef(keyword.name, level) ? keyword.name.toUpperCase() : ``
  );
  group.appendChild(nameSelect);

  group.appendChild(createLabel(`Custom name (if not listed)`, `keyword`));
  const nameInput = createTextField(`keyword`, keyword ? keyword.name : ``, `e.g. COLOR`);
  group.appendChild(nameInput);

  const help = document.createElement(`div`);
  help.className = `keyword-help`;
  group.appendChild(help);

  // —— Value host (rebuilt when keyword changes) ——
  const valueHost = document.createElement(`div`);
  valueHost.id = `keywordValueHost`;
  group.appendChild(valueHost);

  /**
   * @param {string} name
   * @param {string|undefined} currentValue
   */
  const rebuildValueUi = (name, currentValue) => {
    valueHost.innerHTML = ``;
    const def = findKeywordDef(name, level);
    help.textContent = def?.description || ``;

    if (!def || def.valueMode === `none`) {
      if (!def) {
        valueHost.appendChild(createLabel(`Value`, `value`));
        valueHost.appendChild(createTextField(`value`, currentValue || ``, `parameter(s)`));
      } else {
        const none = document.createElement(`div`);
        none.className = `keyword-none`;
        none.textContent = `This keyword takes no parameters.`;
        valueHost.appendChild(none);
        const hidden = createTextField(`value`, ``);
        hidden.style.display = `none`;
        valueHost.appendChild(hidden);
      }
      return;
    }

    if (def.valueMode === `select` && def.options) {
      valueHost.appendChild(createLabel(`Value`, `value`));
      valueHost.appendChild(createNativeSelect(`value`, def.options, currentValue || def.options[0]?.value));
      return;
    }

    if (def.valueMode === `multi` && def.options) {
      valueHost.appendChild(createLabel(`Value (select one or more)`, `valueMulti`));
      const box = document.createElement(`div`);
      box.className = `keyword-multi`;
      box.id = `valueMulti`;
      const selected = new Set(
        String(currentValue || ``)
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean)
          .map((s) => s.toUpperCase())
      );
      for (const o of def.options) {
        const row = document.createElement(`label`);
        row.className = `keyword-multi-row`;
        const cb = document.createElement(`input`);
        cb.type = `checkbox`;
        cb.value = o.value;
        cb.checked = selected.has(o.value.toUpperCase());
        row.appendChild(cb);
        row.appendChild(document.createTextNode(` ${o.label}`));
        box.appendChild(row);
      }
      valueHost.appendChild(box);
      // Hidden field kept for confirm path consistency when empty
      const hidden = createTextField(`value`, currentValue || ``);
      hidden.style.display = `none`;
      valueHost.appendChild(hidden);
      return;
    }

    // text (+ optional suggested selects)
    valueHost.appendChild(createLabel(`Value`, `value`));
    if (def.options?.length) {
      const suggest = createNativeSelect(
        `valueSuggest`,
        [{ value: ``, label: `(type custom below)` }, ...def.options],
        ``
      );
      suggest.addEventListener(`change`, () => {
        if (suggest.value) {
          const tf = /** @type {any} */ (valueHost.querySelector(`#value`));
          if (tf) {
            tf.setAttribute(`value`, suggest.value);
            tf.value = suggest.value;
          }
        }
      });
      valueHost.appendChild(suggest);
    }
    valueHost.appendChild(createTextField(`value`, currentValue || ``, def.placeholder));
  };

  const syncNameFromPick = () => {
    if (nameSelect.value) {
      nameInput.setAttribute(`value`, nameSelect.value);
      // vscode-textfield may need .value
      /** @type {any} */
      const el = nameInput;
      el.value = nameSelect.value;
      rebuildValueUi(nameSelect.value, keyword?.value);
    }
  };

  nameSelect.addEventListener(`change`, () => {
    syncNameFromPick();
  });

  nameInput.addEventListener(`change`, () => {
    /** @type {any} */
    const el = nameInput;
    const n = (el.value || ``).trim().toUpperCase();
    if (n && findKeywordDef(n, level)) {
      nameSelect.value = n;
    } else {
      nameSelect.value = ``;
    }
    rebuildValueUi(n, getCurrentValueString());
  });
  nameInput.addEventListener(`keyup`, () => {
    /** @type {any} */
    const el = nameInput;
    rebuildValueUi((el.value || ``).trim().toUpperCase(), getCurrentValueString());
  });

  function getCurrentValueString() {
    const multi = valueHost.querySelector(`#valueMulti`);
    if (multi) {
      return [...multi.querySelectorAll(`input[type=checkbox]:checked`)]
        .map((cb) => /** @type {HTMLInputElement} */ (cb).value)
        .join(` `);
    }
    /** @type {any} */
    const sel = valueHost.querySelector(`select#value`);
    if (sel) {
      return sel.value;
    }
    /** @type {any} */
    const tf = valueHost.querySelector(`#value`);
    return tf?.value || ``;
  }

  // Initial value UI
  const initialName = (keyword?.name || nameSelect.value || ``).toUpperCase();
  if (initialName && findKeywordDef(initialName, level)) {
    nameSelect.value = initialName;
  }
  rebuildValueUi(initialName, keyword?.value);

  // —— Indicators ——
  group.appendChild(createLabel(`Indicator 1`, `ind1`));
  group.appendChild(createIndicatorSelect(`ind1`, keyword ? keyword.conditions?.[0]?.indicator : undefined));
  group.appendChild(createCheckbox(`neg1`, `Negate`, keyword ? keyword.conditions?.[0]?.negate : undefined));
  group.appendChild(createLabel(`Indicator 2`, `ind2`));
  group.appendChild(createIndicatorSelect(`ind2`, keyword ? keyword.conditions?.[1]?.indicator : undefined));
  group.appendChild(createCheckbox(`neg2`, `Negate`, keyword ? keyword.conditions?.[1]?.negate : undefined));
  group.appendChild(createLabel(`Indicator 3`, `ind3`));
  group.appendChild(createIndicatorSelect(`ind3`, keyword ? keyword.conditions?.[2]?.indicator : undefined));
  group.appendChild(createCheckbox(`neg3`, `Negate`, keyword ? keyword.conditions?.[2]?.negate : undefined));

  const button = document.createElement(`vscode-button`);
  button.setAttribute(`icon`, `check`);
  button.className = `keyword-action-btn`;
  button.innerText = `Confirm`;
  const commitKeyword = () => {
    /** @type {any} */
    const nameEl = group.querySelector(`#keyword`);
    let keywordName = (nameSelect.value || nameEl?.value || ``).trim().toUpperCase();
    if (!keywordName) {
      return false;
    }

    let keywordValue = getCurrentValueString().trim();
    const def = findKeywordDef(keywordName, level);
    if (def?.valueMode === `none`) {
      keywordValue = ``;
    }

    const ind1 = /** @type {any} */ (group.querySelector(`#ind1`)).value;
    const neg1 = /** @type {any} */ (group.querySelector(`#neg1`)).checked;
    const ind2 = /** @type {any} */ (group.querySelector(`#ind2`)).value;
    const neg2 = /** @type {any} */ (group.querySelector(`#neg2`)).checked;
    const ind3 = /** @type {any} */ (group.querySelector(`#ind3`)).value;
    const neg3 = /** @type {any} */ (group.querySelector(`#neg3`)).checked;

    /** @type {Keyword} */
    const newKeyword = {
      name: keywordName,
      value: keywordValue ? keywordValue : undefined,
      conditions: []
    };

    if (ind1 !== `None`) {
      newKeyword.conditions.push({ indicator: Number(ind1), negate: !!neg1 });
    }
    if (ind2 !== `None`) {
      newKeyword.conditions.push({ indicator: Number(ind2), negate: !!neg2 });
    }
    if (ind3 !== `None`) {
      newKeyword.conditions.push({ indicator: Number(ind3), negate: !!neg3 });
    }

    onUpdate(newKeyword);
    return true;
  };

  button.onclick = () => {
    commitKeyword();
  };
  commitOpenKeywordEditor = () => {
    if (commitKeyword()) {
      return true;
    }
    // Empty name — nothing to commit; drop the unfinished form.
    clearKeywordEditor();
    return true;
  };

  group.appendChild(button);

  ensureRightSidebarVisible();
  const keywordEditorArea = document.getElementById(`keywordEditorArea`);
  if (!keywordEditorArea) {
    return;
  }
  keywordEditorArea.innerHTML = ``;
  const title = document.createElement(`div`);
  title.className = `palette-heading`;
  title.innerText = keyword ? `Edit keyword` : `New keyword`;
  keywordEditorArea.appendChild(title);
  keywordEditorArea.appendChild(group);
  keywordEditorArea.scrollTop = 0;
}

/**
 * @param {HTMLElement} sidebar
 * @param {{title: string, html: string|Element, open?: boolean}[]} sections
 */
export function renderSections(sidebar, sections) {
  const active = document.activeElement;
  /** @type {{ kind: "id"|"propId", value: string }|undefined} */
  let focusKey;
  if (active instanceof HTMLElement && sidebar.contains(active)) {
    if (active.id) {
      focusKey = { kind: `id`, value: active.id };
    } else if (active.dataset?.propId) {
      focusKey = { kind: `propId`, value: active.dataset.propId };
    }
  }

  /** @type {Map<string, boolean>} */
  const openByTitle = new Map();
  sidebar.querySelectorAll(`vscode-collapsible`).forEach((el) => {
    const title = el.getAttribute(`title`) || ``;
    if (title) {
      openByTitle.set(title, el.hasAttribute(`open`));
    }
  });

  sidebar.innerHTML = ``;
  for (let section of sections) {
    let newSection = document.createElement(`vscode-collapsible`);
    newSection.setAttribute(`title`, section.title);
    const wasOpen = openByTitle.has(section.title)
      ? openByTitle.get(section.title)
      : section.open;
    if (wasOpen) {
      newSection.setAttribute(`open`, ``);
    }
    if (typeof section.html === `string`) {
      newSection.innerHTML = section.html;
    } else {
      newSection.appendChild(section.html);
    }
    sidebar.appendChild(newSection);
  }

  if (focusKey) {
    /** @type {HTMLElement|null} */
    let next = null;
    if (focusKey.kind === `id`) {
      next = sidebar.querySelector(`#${CSS.escape(focusKey.value)}`);
    } else {
      next = sidebar.querySelector(`[data-prop-id="${CSS.escape(focusKey.value)}"]`);
    }
    if (next instanceof HTMLElement) {
      next.focus();
      if (next instanceof HTMLInputElement) {
        const len = next.value.length;
        try {
          next.setSelectionRange(len, len);
        } catch {
          // Some input types disallow selection ranges; ignore.
        }
      } else if (next.isContentEditable) {
        const range = document.createRange();
        range.selectNodeContents(next);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }
}
