/** @typedef {import('../../src/shared/dspf-types').Keyword} Keyword */
/** @typedef {import('./keywordCatalog.js').KeywordLevel} KeywordLevel */
/** @typedef {import('./keywordCatalog.js').KeywordDef} KeywordDef */

import {
  findKeywordDef,
  keywordConflicts,
  keywordNameOptionsGrouped,
} from "./keywordCatalog.js";

/**
 * @param {string} id
 * @param {Keyword[]} inputKeywords
 * @param {(keywords: Keyword[]) => void} [onUpdate]
 * @param {KeywordLevel} [level]
 */
export function createKeywordPanel(id, inputKeywords, onUpdate, level = `field`) {
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
    newKeyword.style.margin = `1em`;
    newKeyword.style.display = `block`;

    newKeyword.addEventListener(`click`, () => {
      editKeyword((kw) => {
        keywords.push(kw);
        clearKeywordEditor();
        rerenderTree();
      }, undefined, level);
    });

    conflictWarning = document.createElement(`div`);
    conflictWarning.className = `keyword-conflict-warning`;
    conflictWarning.style.display = `none`;
    conflictWarning.style.margin = `0 1em`;
    conflictWarning.style.padding = `0.5em 0.75em`;
    conflictWarning.style.fontSize = `12px`;
    conflictWarning.style.lineHeight = `1.35`;
    conflictWarning.style.border = `1px solid var(--vscode-inputValidation-warningBorder, #cca700)`;
    conflictWarning.style.background = `var(--vscode-inputValidation-warningBackground, rgba(204, 167, 0, 0.15))`;
    conflictWarning.style.color = `var(--vscode-inputValidation-warningForeground, inherit)`;
    conflictWarning.style.borderRadius = `2px`;

    const updateButton = document.createElement(`vscode-button`);
    updateButton.innerText = `Update`;
    updateButton.style.margin = `1em`;
    updateButton.style.display = `block`;
    updateButton.addEventListener(`click`, () => {
      refreshConflictWarnings();
      onUpdate(keywords);
    });

    section.appendChild(newKeyword);
    section.appendChild(conflictWarning);
    section.appendChild(updateButton);
    refreshConflictWarnings();
  }

  return section;
}

/**
 * @typedef {{ label: string, id?: string, value: any, options?: Array<string|{value: string, label: string}> }} PropertyRow
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

  const createInputCell = (fieldId, value) => {
    const cell = document.createElement(`vscode-table-cell`);
    const input = document.createElement(`code`);
    input.id = fieldId;
    input.className = `prop-input`;
    input.dataset.propId = fieldId;
    input.innerText = value == null ? `` : String(value);
    input.setAttribute(`contenteditable`, `true`);
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
      row.append(createInputCell(prop.id, prop.value));
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
    updateButton.style.margin = `1em`;
    updateButton.style.display = `block`;
    updateButton.addEventListener(`click`, () => {
      /** @type {Record<string, string>} */
      const newProperties = {};
      section.querySelectorAll(`[data-prop-id]`).forEach((el) => {
        const propId = el.dataset.propId;
        if (!propId) {
          return;
        }
        if (el instanceof HTMLSelectElement) {
          newProperties[propId] = el.value;
        } else {
          newProperties[propId] = el.innerText;
        }
      });
      onUpdate(newProperties);
    });
    section.appendChild(updateButton);
  }

  return section;
}

export function clearKeywordEditor() {
  const keywordEditorArea = document.getElementById(`keywordEditorArea`);
  if (keywordEditorArea) {
    keywordEditorArea.innerHTML = ``;
  }
}

/** Ensure the right sidebar is visible so the keyword form can be used. */
export function ensureRightSidebarVisible() {
  const sidebar = document.getElementById(`rightSidebar`);
  const rail = document.getElementById(`expandRightSidebar`);
  if (sidebar) {
    sidebar.classList.remove(`collapsed`);
  }
  if (rail) {
    rail.hidden = true;
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
  group.style.paddingLeft = `1em`;
  group.style.paddingRight = `1em`;

  const createLabel = (label, forId) => {
    const labelElement = document.createElement(`vscode-label`);
    labelElement.setAttribute(`for`, forId);
    labelElement.innerText = label;
    labelElement.style.marginTop = `0.5em`;
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
  help.style.fontSize = `11px`;
  help.style.opacity = `0.75`;
  help.style.marginTop = `0.25em`;
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
        none.style.fontSize = `12px`;
        none.style.opacity = `0.7`;
        none.style.marginTop = `0.5em`;
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
  button.style.marginTop = `1em`;
  button.style.display = `block`;
  button.innerText = `Confirm`;
  button.onclick = () => {
    /** @type {any} */
    const nameEl = group.querySelector(`#keyword`);
    let keywordName = (nameSelect.value || nameEl?.value || ``).trim().toUpperCase();
    if (!keywordName) {
      return;
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
  sidebar.innerHTML = ``;
  for (let section of sections) {
    let newSection = document.createElement(`vscode-collapsible`);
    newSection.setAttribute(`title`, section.title);
    if (section.open) {
      newSection.setAttribute(`open`, ``);
    }
    if (typeof section.html === `string`) {
      newSection.innerHTML = section.html;
    } else {
      newSection.appendChild(section.html);
    }
    sidebar.appendChild(newSection);
  }
}
