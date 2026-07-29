/** @typedef {import('../../src/shared/dspf-types').FieldInfoData} FieldInfo */
/** @typedef {import('../../src/shared/dspf-types').Keyword} Keyword */

/**
 * @typedef {{ label: string, icon: string, field: () => Partial<FieldInfo> }} PaletteItem
 */

/**
 * @typedef {{
 *   name: string,
 *   keywords?: Keyword[],
 * }} NewFormatSpec
 */

/**
 * @typedef {{
 *   kind: 'standard'|'subfile',
 *   formats: NewFormatSpec[],
 *   selectFormat: string,
 * }} NewRecordRequest
 */

/** @type {PaletteItem[]} */
export const paletteItems = [
  {
    label: `Named field`,
    icon: `symbol-field`,
    field: () => ({
      name: `FIELD1`,
      length: 10,
      type: `A`,
      primitiveType: `char`,
      displayType: `both`,
      decimals: 0,
      position: { x: 1, y: 1 },
      keywords: [],
      conditions: [],
    }),
  },
  {
    label: `Date field`,
    icon: `calendar`,
    field: () => ({
      name: `DATE1`,
      length: 8,
      type: `L`,
      primitiveType: `char`,
      displayType: `output`,
      decimals: 0,
      position: { x: 1, y: 1 },
      keywords: [{ name: `DATFMT`, value: `*ISO`, conditions: [] }],
      conditions: [],
    }),
  },
  {
    label: `Time field`,
    icon: `calendar`,
    field: () => ({
      name: `TIME1`,
      length: 8,
      type: `T`,
      primitiveType: `char`,
      displayType: `output`,
      decimals: 0,
      position: { x: 1, y: 1 },
      keywords: [{ name: `TIMFMT`, value: `*ISO`, conditions: [] }],
      conditions: [],
    }),
  },
  {
    label: `Timestamp field`,
    icon: `calendar`,
    field: () => ({
      name: `TS1`,
      length: 26,
      type: `Z`,
      primitiveType: `char`,
      displayType: `output`,
      decimals: 0,
      position: { x: 1, y: 1 },
      keywords: [],
      conditions: [],
    }),
  },
  {
    label: `Constant text`,
    icon: `symbol-constant`,
    field: () => ({
      value: `Constant`,
      position: { x: 1, y: 1 },
      displayType: `const`,
      length: 8,
      decimals: 0,
      keywords: [],
      conditions: [],
    }),
  },
  {
    label: `System name`,
    icon: `account`,
    field: () => ({
      value: ``,
      position: { x: 1, y: 1 },
      displayType: `const`,
      length: 8,
      decimals: 0,
      keywords: [{ name: `SYSNAME`, conditions: [] }],
      conditions: [],
    }),
  },
  {
    label: `Date constant`,
    icon: `calendar`,
    field: () => ({
      value: ``,
      position: { x: 1, y: 1 },
      displayType: `const`,
      length: 10,
      decimals: 0,
      keywords: [
        { name: `DATE`, conditions: [] },
        { name: `DATFMT`, value: `*ISO`, conditions: [] },
      ],
      conditions: [],
    }),
  },
  {
    label: `Time constant`,
    icon: `calendar`,
    field: () => ({
      value: ``,
      position: { x: 1, y: 1 },
      displayType: `const`,
      length: 8,
      decimals: 0,
      keywords: [
        { name: `TIME`, conditions: [] },
        { name: `TIMFMT`, value: `*HMS`, conditions: [] },
      ],
      conditions: [],
    }),
  },
];

/**
 * Pending palette drag payload (HTML5 DnD).
 * @type {Partial<FieldInfo>|undefined}
 */
let draggingField;

export function getDraggingField() {
  return draggingField;
}

export function clearDraggingField() {
  draggingField = undefined;
}

export { isValidRecordName } from "../../src/shared/recordName.ts";

/**
 * @param {string} prefix
 * @param {Set<string>} existing
 */
export function nextAvailableRecordName(prefix, existing) {
  const upperExisting = new Set([...existing].map((n) => n.toUpperCase()));
  for (let i = 1; i <= 99; i++) {
    const candidate = `${prefix}${String(i).padStart(2, `0`)}`;
    if (candidate.length <= 10 && !upperExisting.has(candidate)) {
      return candidate;
    }
  }
  return prefix.slice(0, 10).toUpperCase();
}

/**
 * @param {HTMLElement} parent
 * @param {string} text
 */
function appendHeading(parent, text) {
  const heading = document.createElement(`div`);
  heading.className = `palette-heading`;
  heading.innerText = text;
  parent.appendChild(heading);
}

/**
 * @param {HTMLElement} parent
 * @param {string} text
 */
function appendHint(parent, text) {
  const hint = document.createElement(`div`);
  hint.className = `palette-hint`;
  hint.innerText = text;
  parent.appendChild(hint);
}

/**
 * @param {HTMLElement} parent
 * @param {string} label
 * @param {string} id
 * @param {string} value
 * @param {string} [placeholder]
 */
function appendTextField(parent, label, id, value, placeholder) {
  const lab = document.createElement(`vscode-label`);
  lab.setAttribute(`for`, id);
  lab.innerText = label;
  parent.appendChild(lab);

  const input = document.createElement(`vscode-textfield`);
  input.id = id;
  input.setAttribute(`value`, value);
  if (placeholder) {
    input.setAttribute(`placeholder`, placeholder);
  }
  input.style.width = `100%`;
  input.style.marginBottom = `0.5em`;
  parent.appendChild(input);
  return input;
}

/**
 * @param {HTMLElement} el
 * @returns {string}
 */
function readTextField(el) {
  /** @type {any} */
  const any = el;
  return String(any?.value ?? el.getAttribute(`value`) ?? ``).trim().toUpperCase();
}

/**
 * @param {HTMLElement} sidebar
 * @param {(field: Partial<FieldInfo>) => void} onClickCreate
 * @param {{
 *   existingNames?: string[],
 *   onCreateRecord?: (request: NewRecordRequest) => void,
 *   onBrowseDatabase?: () => void,
 * }} [opts]
 */
export function renderPalette(sidebar, onClickCreate, opts = {}) {
  sidebar.innerHTML = ``;

  const existing = new Set((opts.existingNames || []).map((n) => n.toUpperCase()));
  const onCreateRecord = opts.onCreateRecord;

  appendHeading(sidebar, `Add field`);
  appendHint(sidebar, `Drag onto the screen or click to add at 1,1`);

  for (const item of paletteItems) {
    const button = document.createElement(`vscode-button`);
    button.setAttribute(`secondary`, `true`);
    button.setAttribute(`icon`, item.icon);
    button.className = `palette-btn`;
    button.innerText = item.label;
    button.setAttribute(`draggable`, `true`);

    button.addEventListener(`dragstart`, (e) => {
      draggingField = item.field();
      e.dataTransfer?.setData(`application/x-dds-field`, JSON.stringify(draggingField));
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = `copy`;
      }
    });

    button.addEventListener(`dragend`, () => {
      draggingField = undefined;
    });

    button.onclick = () => onClickCreate(item.field());

    sidebar.appendChild(button);
  }

  if (!onCreateRecord) {
    return;
  }

  // Database fields (SDA F10)
  if (opts.onBrowseDatabase) {
    const dbDivider = document.createElement(`vscode-divider`);
    dbDivider.style.margin = `0.75em 0`;
    sidebar.appendChild(dbDivider);
    appendHeading(sidebar, `Database fields`);
    appendHint(sidebar, `Browse a PF/LF via Code for IBM i and place REFFLD fields (SDA F10).`);
    const dbBtn = document.createElement(`vscode-button`);
    dbBtn.setAttribute(`secondary`, `true`);
    dbBtn.setAttribute(`icon`, `database`);
    dbBtn.className = `palette-btn`;
    dbBtn.innerText = `Add from database…`;
    dbBtn.onclick = () => opts.onBrowseDatabase();
    sidebar.appendChild(dbBtn);
  }

  const divider = document.createElement(`vscode-divider`);
  divider.style.margin = `0.75em 0`;
  sidebar.appendChild(divider);

  appendHeading(sidebar, `Add record`);
  appendHint(
    sidebar,
    `Standard record, or a subfile pair (SFL + SFLCTL) with common control keywords.`
  );

  const formHost = document.createElement(`div`);
  formHost.className = `record-form-host`;
  sidebar.appendChild(formHost);

  /**
   * @param {'pick'|'standard'|'subfile'|'sflmsg'|'usrdfn'} mode
   */
  const showForm = (mode) => {
    formHost.innerHTML = ``;

    if (mode === `pick`) {
      const stdBtn = document.createElement(`vscode-button`);
      stdBtn.setAttribute(`secondary`, `true`);
      stdBtn.setAttribute(`icon`, `file`);
      stdBtn.className = `palette-btn`;
      stdBtn.innerText = `Standard record`;
      stdBtn.onclick = () => showForm(`standard`);
      formHost.appendChild(stdBtn);

      const sflBtn = document.createElement(`vscode-button`);
      sflBtn.setAttribute(`secondary`, `true`);
      sflBtn.setAttribute(`icon`, `table`);
      sflBtn.className = `palette-btn`;
      sflBtn.innerText = `Subfile (SFL + CTL)`;
      sflBtn.onclick = () => showForm(`subfile`);
      formHost.appendChild(sflBtn);

      const msgBtn = document.createElement(`vscode-button`);
      msgBtn.setAttribute(`secondary`, `true`);
      msgBtn.setAttribute(`icon`, `mail`);
      msgBtn.className = `palette-btn`;
      msgBtn.innerText = `Message subfile (SFLMSG)`;
      msgBtn.onclick = () => showForm(`sflmsg`);
      formHost.appendChild(msgBtn);

      const usrBtn = document.createElement(`vscode-button`);
      usrBtn.setAttribute(`secondary`, `true`);
      usrBtn.setAttribute(`icon`, `symbol-misc`);
      usrBtn.className = `palette-btn`;
      usrBtn.innerText = `User-defined (USRDFN)`;
      usrBtn.onclick = () => showForm(`usrdfn`);
      formHost.appendChild(usrBtn);
      return;
    }

    const error = document.createElement(`div`);
    error.className = `palette-error`;
    error.hidden = true;
    formHost.appendChild(error);

    /** @param {string} msg */
    const setError = (msg) => {
      error.textContent = msg;
      error.hidden = !msg;
    };

    if (mode === `standard`) {
      appendHint(formHost, `Creates one record format (R name).`);
      const nameInput = appendTextField(
        formHost,
        `Record name`,
        `newRecordName`,
        nextAvailableRecordName(`REC`, existing),
        `REC01`
      );

      const overlay = document.createElement(`vscode-checkbox`);
      overlay.id = `newRecordOverlay`;
      overlay.setAttribute(`label`, `Add OVERLAY`);
      formHost.appendChild(overlay);

      const asWindow = document.createElement(`vscode-checkbox`);
      asWindow.id = `newRecordWindow`;
      asWindow.setAttribute(`label`, `WINDOW (5 10 12 40)`);
      formHost.appendChild(asWindow);

      const actions = document.createElement(`div`);
      actions.className = `palette-actions`;

      const cancel = document.createElement(`vscode-button`);
      cancel.setAttribute(`secondary`, `true`);
      cancel.innerText = `Back`;
      cancel.onclick = () => showForm(`pick`);

      const create = document.createElement(`vscode-button`);
      create.setAttribute(`icon`, `add`);
      create.innerText = `Create`;
      create.onclick = () => {
        const name = readTextField(nameInput);
        if (!isValidRecordName(name)) {
          setError(`Name must be 1–10 chars (A–Z, 0–9, @ # $), starting with a letter.`);
          return;
        }
        if (existing.has(name)) {
          setError(`Record ${name} already exists.`);
          return;
        }
        /** @type {Keyword[]} */
        const keywords = [];
        /** @type {any} */
        const ov = overlay;
        if (ov?.checked) {
          keywords.push({ name: `OVERLAY`, conditions: [] });
        }
        /** @type {any} */
        const win = asWindow;
        if (win?.checked) {
          keywords.push({ name: `WINDOW`, value: `5 10 12 40`, conditions: [] });
        }
        onCreateRecord({
          kind: `standard`,
          formats: [{ name, keywords }],
          selectFormat: name,
        });
      };

      actions.appendChild(cancel);
      actions.appendChild(create);
      formHost.appendChild(actions);
      return;
    }

    if (mode === `subfile`) {
    // subfile
    appendHint(
      formHost,
      `Creates SFL (row) then SFLCTL (control) with SFLDSP / SFLCLR / SFLPAG.`
    );
    const sflInput = appendTextField(
      formHost,
      `Subfile record (SFL)`,
      `newSflName`,
      nextAvailableRecordName(`SFL`, existing),
      `SFL01`
    );
    const ctlInput = appendTextField(
      formHost,
      `Control record (SFLCTL)`,
      `newCtlName`,
      nextAvailableRecordName(`CTL`, existing),
      `CTL01`
    );
    const pageInput = appendTextField(formHost, `SFLPAG (rows per page)`, `newSflPag`, `10`, `10`);

    const overlay = document.createElement(`vscode-checkbox`);
    overlay.id = `newSflOverlay`;
    overlay.setAttribute(`label`, `Add OVERLAY on control`);
    overlay.setAttribute(`checked`, ``);
    formHost.appendChild(overlay);

    const actions = document.createElement(`div`);
    actions.className = `palette-actions`;

    const cancel = document.createElement(`vscode-button`);
    cancel.setAttribute(`secondary`, `true`);
    cancel.innerText = `Back`;
    cancel.onclick = () => showForm(`pick`);

    const create = document.createElement(`vscode-button`);
    create.setAttribute(`icon`, `add`);
    create.innerText = `Create pair`;
    create.onclick = () => {
      const sflName = readTextField(sflInput);
      const ctlName = readTextField(ctlInput);
      const pageRaw = readTextField(pageInput) || `10`;
      const page = Number(pageRaw);
      if (!isValidRecordName(sflName) || !isValidRecordName(ctlName)) {
        setError(`Names must be 1–10 chars (A–Z, 0–9, @ # $), starting with a letter.`);
        return;
      }
      if (sflName === ctlName) {
        setError(`SFL and CTL names must be different.`);
        return;
      }
      if (existing.has(sflName) || existing.has(ctlName)) {
        setError(`One of those record names already exists.`);
        return;
      }
      if (!Number.isInteger(page) || page < 1 || page > 999) {
        setError(`SFLPAG must be an integer from 1 to 999.`);
        return;
      }

      /** @type {Keyword[]} */
      const ctlKeywords = [
        { name: `SFLCTL`, value: sflName, conditions: [] },
        { name: `SFLDSP`, conditions: [] },
        { name: `SFLDSPCTL`, conditions: [] },
        { name: `SFLCLR`, conditions: [] },
        { name: `SFLPAG`, value: String(page), conditions: [] },
        { name: `SFLSIZ`, value: String(page), conditions: [] },
      ];
      /** @type {any} */
      const ov = overlay;
      if (ov?.checked) {
        ctlKeywords.push({ name: `OVERLAY`, conditions: [] });
      }

      onCreateRecord({
        kind: `subfile`,
        formats: [
          { name: sflName, keywords: [{ name: `SFL`, conditions: [] }] },
          { name: ctlName, keywords: ctlKeywords },
        ],
        selectFormat: ctlName,
      });
    };

    actions.appendChild(cancel);
    actions.appendChild(create);
    formHost.appendChild(actions);
    return;
    }

    if (mode === `usrdfn`) {
      appendHint(formHost, `Creates a USRDFN record (advanced / user-written DDS body).`);
      const nameInput = appendTextField(
        formHost,
        `Record name`,
        `newUsrdfnName`,
        nextAvailableRecordName(`USR`, existing),
        `USR01`
      );
      const actions = document.createElement(`div`);
      actions.className = `palette-actions`;
      const cancel = document.createElement(`vscode-button`);
      cancel.setAttribute(`secondary`, `true`);
      cancel.innerText = `Back`;
      cancel.onclick = () => showForm(`pick`);
      const create = document.createElement(`vscode-button`);
      create.setAttribute(`icon`, `add`);
      create.innerText = `Create`;
      create.onclick = () => {
        const name = readTextField(nameInput);
        if (!isValidRecordName(name)) {
          setError(`Name must be 1–10 chars (A–Z, 0–9, @ # $), starting with a letter.`);
          return;
        }
        if (existing.has(name)) {
          setError(`Record ${name} already exists.`);
          return;
        }
        onCreateRecord({
          kind: `standard`,
          formats: [{ name, keywords: [{ name: `USRDFN`, conditions: [] }] }],
          selectFormat: name,
        });
      };
      actions.appendChild(cancel);
      actions.appendChild(create);
      formHost.appendChild(actions);
      return;
    }

    if (mode === `sflmsg`) {
      appendHint(
        formHost,
        `Creates a message subfile pair: SFL with SFLMSGRCD, plus SFLCTL with message-subfile keywords.`
      );
      const sflInput = appendTextField(
        formHost,
        `Message subfile (SFL)`,
        `newMsgSflName`,
        nextAvailableRecordName(`MSF`, existing),
        `MSF01`
      );
      const ctlInput = appendTextField(
        formHost,
        `Control record (SFLCTL)`,
        `newMsgCtlName`,
        nextAvailableRecordName(`MCTL`, existing),
        `MCTL01`
      );

      const actions = document.createElement(`div`);
      actions.className = `palette-actions`;
      const cancel = document.createElement(`vscode-button`);
      cancel.setAttribute(`secondary`, `true`);
      cancel.innerText = `Back`;
      cancel.onclick = () => showForm(`pick`);
      const create = document.createElement(`vscode-button`);
      create.setAttribute(`icon`, `add`);
      create.innerText = `Create pair`;
      create.onclick = () => {
        const sflName = readTextField(sflInput);
        const ctlName = readTextField(ctlInput);
        if (!isValidRecordName(sflName) || !isValidRecordName(ctlName)) {
          setError(`Names must be 1–10 chars (A–Z, 0–9, @ # $), starting with a letter.`);
          return;
        }
        if (sflName === ctlName) {
          setError(`SFL and CTL names must be different.`);
          return;
        }
        if (existing.has(sflName) || existing.has(ctlName)) {
          setError(`One of those record names already exists.`);
          return;
        }
        onCreateRecord({
          kind: `subfile`,
          formats: [
            {
              name: sflName,
              keywords: [
                { name: `SFL`, conditions: [] },
                { name: `SFLMSGRCD`, value: `1`, conditions: [] },
              ],
            },
            {
              name: ctlName,
              keywords: [
                { name: `SFLCTL`, value: sflName, conditions: [] },
                { name: `SFLDSP`, conditions: [] },
                { name: `SFLDSPCTL`, conditions: [] },
                { name: `SFLINZ`, conditions: [] },
                { name: `SFLPAG`, value: `1`, conditions: [] },
                { name: `SFLSIZ`, value: `1`, conditions: [] },
                { name: `OVERLAY`, conditions: [] },
              ],
            },
          ],
          selectFormat: ctlName,
        });
      };
      actions.appendChild(cancel);
      actions.appendChild(create);
      formHost.appendChild(actions);
      return;
    }

    // unreachable
  };

  showForm(`pick`);
}
