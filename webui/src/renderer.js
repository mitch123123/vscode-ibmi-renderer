/** @typedef {import('../../src/shared/dspf-types').FieldInfoData} FieldInfo */
/** @typedef {import('../../src/shared/dspf-types').RecordInfoData} RecordInfo */
/** @typedef {import('../../src/shared/dspf-types').DisplayFileData} DisplayFile */
/** @typedef {import('../../src/shared/dspf-types').Keyword} Keyword */
/** @typedef {import("konva").default.Stage} Stage */
/** @typedef {import("konva").default.Layer} Layer */
/** @typedef {import("konva").default.Group} Group */

import {
  colours, SELECTED_COLOUR, PROTECT_COLOUR, OVERLAP_COLOUR, dateFormats, timeFormats,
  GLOBAL_RECORD_FORMAT, pxwPerChar, pxhPerLine, pxhPerChar,
  RULER_LEFT, RULER_TOP, snapToFixedGrid, gridCordsToFieldCords,
  widthInP, heightInP, parseParms, conditionsPass
} from "./constants.js";
import { formatEditCode } from "./editcode.js";
import { activeIndicators, clearAllIndicators } from "./indicators.js";
import { clearKeywordEditor, renderSections } from "./keywordEditor.js";
import { updateRecordFormatSidebar, updateSelectedFieldSidebar, showFieldPalette } from "./sidebar.js";
import { getDraggingField, clearDraggingField, isValidRecordName } from "./palette.js";
import { requestHostInput, requestHostConfirm, showHostError } from "./hostDialogs.js";
import { vscode } from "./vscodeApi.js";
import { announce } from "./a11y.js";
import {
  clampFieldPosition,
  fieldContentLength,
  formatOverlapWarning,
  isSameFieldRef,
  maxStartColumnForLength,
} from "./coords.js";

/** @type {ReturnType<typeof setTimeout>|undefined} */
let designErrorTimer = undefined;
/** @type {string|undefined} */
let designErrorVisible = undefined;

/**
 * Brief on-canvas error for invalid design moves (also announced for a11y).
 * @param {string} message
 */
function showDesignError(message) {
  const el = document.getElementById(`designErrorToast`);
  if (el) {
    const wasHidden = el.hidden || designErrorVisible !== message;
    el.textContent = message;
    el.hidden = false;
    if (wasHidden) {
      announce(message);
    }
    designErrorVisible = message;
    if (designErrorTimer) {
      clearTimeout(designErrorTimer);
    }
    designErrorTimer = setTimeout(() => {
      designErrorTimer = undefined;
      designErrorVisible = undefined;
      el.hidden = true;
    }, 3200);
  } else {
    announce(message);
  }
}

/** @type {DisplayFile|undefined} */
let activeDocument = undefined;
/** @type {"dds.dspf"|"dds.prtf"} */
let activeDocumentType = `dds.dspf`;
/** @type {string|undefined} */
let lastSelectedFormat = undefined;
/** @type {Stage|undefined} */
let existingStage = undefined;
/** @type {Layer|undefined} */
let fieldLayer = undefined;
/** @type {Layer|undefined} */
let rulerLayer = undefined;

/** @type {{group: Group, field: FieldInfo}[]} */
let selectedItems = [];
/** @type {FieldInfo[]} */
let clipboard = [];

/** @type {string[]} */
let overlayFormats = [];

/** Screen size override: undefined = from DDS, else {rows, cols} */
let screenSizeOverride = undefined;

/** @type {"design"|"preview"} */
let editorMode = `design`;
/** False while IBM i connection is down for a remote member document */
let connectionConnected = true;

let renderCols = 80;
let renderRows = 24;

/** Names to restore after an incremental canvas rebuild */
let pendingSelectionNames = [];
/** Suppress background pointerclick after a marquee select */
let suppressNextBgClick = false;
/** Active WINDOW origin for converting screen ↔ relative DDS coords */
let activeWindowOrigin = undefined;
/** Active marquee cleanup bound to window */
let marqueeWindowCleanup = undefined;
/** Cleanup for the open format-tab context menu capture listener */
let formatTabMenuCleanup = undefined;

/**
 * @param {DisplayFile} newDoc
 * @param {"dds.dspf"|"dds.prtf"} type
 * @param {boolean} withRerender
 * @param {{ restoreSelection?: boolean, selectFormat?: string }} [opts]
 */
export function loadDDS(newDoc, type, withRerender = true, opts = {}) {
  cancelPendingNudge();
  const prevSelection = selectedItems.map(s => s.field.name).filter(Boolean);
  activeDocument = newDoc;
  activeDocumentType = type || `dds.dspf`;

  if (opts.selectFormat) {
    lastSelectedFormat = opts.selectFormat;
    editorMode = `design`;
    const badge = document.getElementById(`modeBadge`);
    if (badge) {
      badge.innerText = `Design`;
    }
    const modeBtn = document.getElementById(`modeToggle`);
    if (modeBtn) {
      modeBtn.innerText = `Switch to Preview`;
    }
  }

  if (withRerender) {
    if (opts.restoreSelection) {
      pendingSelectionNames = prevSelection;
    }
    const validFormats = activeDocument.formats.filter(format => format.name !== GLOBAL_RECORD_FORMAT);
    setTabs(validFormats.map(format => format.name), lastSelectedFormat);
    const chosenFormat = lastSelectedFormat || (validFormats[0] ? validFormats[0].name : undefined);
    if (chosenFormat) {
      setWindowForFormat(chosenFormat);
    }
  }
}

export function getActiveDocument() {
  return activeDocument;
}

export function getLastSelectedFormat() {
  return lastSelectedFormat;
}

export function getEditorMode() {
  return editorMode;
}

export function setConnectionConnected(connected) {
  connectionConnected = !!connected;
  document.body.classList.toggle(`disconnected`, !connectionConnected);
  const banner = document.getElementById(`connectionBanner`);
  if (banner) {
    banner.hidden = connectionConnected;
  }
  if (lastSelectedFormat) {
    setWindowForFormat(lastSelectedFormat);
  }
}

function editsAllowed() {
  return editorMode === `design` && connectionConnected;
}

export function setEditorMode(mode) {
  editorMode = mode;
  const badge = document.getElementById(`modeBadge`);
  if (badge) {
    badge.innerText = mode === `preview` ? `Preview` : `Design`;
  }
  const modeBtn = document.getElementById(`modeToggle`);
  if (modeBtn) {
    modeBtn.innerText = mode === `preview` ? `Switch to Design` : `Switch to Preview`;
  }
  if (lastSelectedFormat) {
    setWindowForFormat(lastSelectedFormat);
  }
}

/**
 * Switch to Design mode and activate a record-format tab (CodeLens Edit).
 * @param {string} formatName
 */
export function selectRecordFormat(formatName) {
  const name = (formatName || ``).trim();
  if (!name || !activeDocument) {
    return;
  }
  const exists = activeDocument.formats.some(
    (f) => f.name === name && f.name !== GLOBAL_RECORD_FORMAT
  );
  if (!exists) {
    return;
  }

  editorMode = `design`;
  const badge = document.getElementById(`modeBadge`);
  if (badge) {
    badge.innerText = `Design`;
  }
  const modeBtn = document.getElementById(`modeToggle`);
  if (modeBtn) {
    modeBtn.innerText = `Switch to Preview`;
  }

  if (name === lastSelectedFormat) {
    setWindowForFormat(name);
    return;
  }
  overlayFormats = [];
  clearAllIndicators();
  clearKeywordEditor();
  setWindowForFormat(name);
}

/**
 * @param {number} [cols]
 * @param {number} [rows]
 */
export function setScreenSize(cols, rows) {
  if (cols == null || rows == null) {
    screenSizeOverride = undefined;
  } else {
    screenSizeOverride = { cols, rows };
  }
  if (lastSelectedFormat) {
    setWindowForFormat(lastSelectedFormat);
  }
}

export function refreshCanvas() {
  if (lastSelectedFormat) {
    setWindowForFormat(lastSelectedFormat);
  }
}

/**
 * Convert absolute screen row/col to DDS field position (window-relative when needed).
 * @param {number} screenX
 * @param {number} screenY
 * @param {{ preserveY0?: boolean, wasY0?: boolean }} [opts]
 */
function screenToFieldPosition(screenX, screenY, opts = {}) {
  let x = screenX;
  let y = screenY;
  let maxX = renderCols;
  let maxY = renderRows;
  if (activeWindowOrigin?.originX != null && activeWindowOrigin?.originY != null) {
    x = screenX - (activeWindowOrigin.originX - 1);
    y = screenY - (activeWindowOrigin.originY - 1);
    maxX = activeWindowOrigin.baseWidth || renderCols;
    maxY = activeWindowOrigin.baseHeight || renderRows;
  }
  return clampFieldPosition(x, y, {
    maxX,
    maxY,
    wasY0: opts.wasY0 || opts.preserveY0,
    length: opts.length,
  });
}

/** Current DDS position bounds (window-relative when a WINDOW format is active). */
function currentPositionBounds() {
  return {
    maxX: activeWindowOrigin?.baseWidth || renderCols,
    maxY: activeWindowOrigin?.baseHeight || renderRows,
  };
}

/**
 * Pixel position for a DDS field position, including active WINDOW origin.
 * @param {{ x: number, y: number }} pos
 */
function fieldPositionToPixels(pos) {
  const originX = activeWindowOrigin?.originX != null ? activeWindowOrigin.originX - 1 : 0;
  const originY = activeWindowOrigin?.originY != null ? activeWindowOrigin.originY - 1 : 0;
  const posY = pos.y > 0 ? pos.y : 1;
  return {
    x: RULER_LEFT + widthInP(originX + pos.x - 1),
    y: RULER_TOP + heightInP(originY + posY - 1),
  };
}

/**
 * @param {string} chosenFormat
 */
export function setWindowForFormat(chosenFormat) {
  let cols = 80;
  let rows = 24;
  const formatChanged = chosenFormat !== lastSelectedFormat;
  if (formatChanged) {
    cancelPendingNudge();
  }

  suppressNextBgClick = false;
  if (marqueeWindowCleanup) {
    marqueeWindowCleanup();
    marqueeWindowCleanup = undefined;
  }
  activeWindowOrigin = undefined;

  const globalFormat = activeDocument.formats.find(f => f.name === GLOBAL_RECORD_FORMAT || f.name === `GLOBAL`);
  const selectedFormat = activeDocument.formats.find(f => f.name === chosenFormat);

  if (!selectedFormat) {
    console.error(`Format ${chosenFormat} not found`);
    return;
  }

  if (screenSizeOverride) {
    cols = screenSizeOverride.cols;
    rows = screenSizeOverride.rows;
  } else if (activeDocumentType === `dds.dspf` && globalFormat) {
    const displaySize = globalFormat.keywords.find(keyword => keyword.name === `DSPSIZ`);
    if (displaySize) {
      const parts = parseParms(displaySize.value);
      if (parts.length >= 2) {
        rows = Number(parts[0]);
        cols = Number(parts[1]);
      } else if (parts.length === 1) {
        switch (parts[0].toUpperCase()) {
          case `*DS4`:
            cols = 132;
            rows = 27;
            break;
          case `*DS3`:
          default:
            cols = 80;
            rows = 24;
            break;
        }
      }
    }
  } else if (activeDocumentType === `dds.prtf`) {
    cols = 132;
    rows = 66;
  }

  renderCols = cols;
  renderRows = rows;

  const width = widthInP(cols) + RULER_LEFT;
  const height = heightInP(rows) + RULER_TOP;

  // Clear selection before destroying the stage so we never touch dead Konva nodes.
  clearSelection(false);

  if (existingStage) {
    existingStage.destroy();
  }

  existingStage = new Konva.Stage({
    container: 'container',
    width,
    height
  });

  rulerLayer = new Konva.Layer({ id: `ruler` });
  drawRulers(rulerLayer, cols, rows);
  existingStage.add(rulerLayer);

  fieldLayer = new Konva.Layer({ id: selectedFormat.name });

  const bg = new Konva.Rect({
    x: RULER_LEFT,
    y: RULER_TOP,
    width: widthInP(cols),
    height: heightInP(rows),
    fill: colours.BLK,
    id: `screenBg`
  });

  bg.on('pointerclick', (e) => {
    if (suppressNextBgClick) {
      suppressNextBgClick = false;
      return;
    }
    if (!editsAllowed()) {
      return;
    }
    if (!e.evt.shiftKey) {
      clearSelection();
      openDesignPalette();
    }
  });

  // Marquee selection
  let marquee;
  let marqueeStart;
  let marqueeMoved = false;

  const endMarquee = () => {
    if (!marquee || !marqueeStart) {
      if (marqueeWindowCleanup) {
        marqueeWindowCleanup();
        marqueeWindowCleanup = undefined;
      }
      return;
    }
    const box = marquee.getClientRect();
    const wasMarquee = marqueeMoved;
    marquee.destroy();
    marquee = undefined;
    marqueeStart = undefined;
    marqueeMoved = false;
    if (marqueeWindowCleanup) {
      marqueeWindowCleanup();
      marqueeWindowCleanup = undefined;
    }

    if (!wasMarquee || (box.width < 4 && box.height < 4)) {
      suppressNextBgClick = false;
      return;
    }

    suppressNextBgClick = true;
    setTimeout(() => { suppressNextBgClick = false; }, 300);
    clearSelection(false);
    const groups = fieldLayer.find(`Group`);
    groups.forEach((g) => {
      if (g.id() === `` || g.id().startsWith(`sub_`) || g.id().startsWith(`win_`)) {
        return;
      }
      const rect = g.getClientRect();
      if (Konva.Util.haveIntersection(box, rect)) {
        const field = findFieldByName(g.id());
        if (field) {
          addToSelection(g, field, false);
        }
      }
    });
    updateSelectionUi();
  };

  bg.on('mousedown', (e) => {
    if (!editsAllowed()) {
      return;
    }
    const pos = existingStage.getPointerPosition();
    if (!pos) {
      return;
    }
    marqueeStart = { x: pos.x, y: pos.y };
    marqueeMoved = false;
    marquee = new Konva.Rect({
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      stroke: `#4fc1ff`,
      dash: [4, 4],
      listening: false,
    });
    fieldLayer.add(marquee);

    const onWinUp = () => endMarquee();
    window.addEventListener(`mouseup`, onWinUp, { once: true });
    marqueeWindowCleanup = () => window.removeEventListener(`mouseup`, onWinUp);
  });

  existingStage.on('mousemove', () => {
    if (!marquee || !marqueeStart) {
      return;
    }
    const pos = existingStage.getPointerPosition();
    if (!pos) {
      return;
    }
    const w = Math.abs(pos.x - marqueeStart.x);
    const h = Math.abs(pos.y - marqueeStart.y);
    if (w > 4 || h > 4) {
      marqueeMoved = true;
    }
    marquee.x(Math.min(marqueeStart.x, pos.x));
    marquee.y(Math.min(marqueeStart.y, pos.y));
    marquee.width(w);
    marquee.height(h);
  });

  // Palette drop
  const container = document.getElementById(`container`);
  container.ondragover = (e) => {
    if (!editsAllowed()) {
      e.dataTransfer.dropEffect = `none`;
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = `copy`;
  };
  container.ondrop = (e) => {
    e.preventDefault();
    if (!editsAllowed()) {
      return;
    }
    const raw = e.dataTransfer.getData(`application/x-dds-field`);
    let field;
    try {
      field = raw ? JSON.parse(raw) : getDraggingField();
    } catch {
      clearDraggingField();
      return;
    }
    clearDraggingField();
    if (!field || !lastSelectedFormat) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left - RULER_LEFT;
    const y = e.clientY - rect.top - RULER_TOP;
    const snapped = snapToFixedGrid(Math.max(0, x), Math.max(0, y));
    const screen = gridCordsToFieldCords(snapped.x, snapped.y);
    const bounds = currentPositionBounds();
    const len = fieldContentLength(field);
    let rawX = screen.x;
    let rawY = screen.y;
    if (activeWindowOrigin?.originX != null && activeWindowOrigin?.originY != null) {
      rawX = screen.x - (activeWindowOrigin.originX - 1);
      rawY = screen.y - (activeWindowOrigin.originY - 1);
    }
    const nextPos = clampFieldPosition(rawX, rawY, { ...bounds, length: len });
    if (rawX > nextPos.x) {
      showDesignError(
        `Content past record length of ${bounds.maxX} (length ${len}). Placed at column ${nextPos.x}.`,
      );
    }
    field.position = nextPos;
    const overlapMsg = formatOverlapWarning(field, [...currentFormatFields(), field]);
    if (overlapMsg) {
      showDesignError(overlapMsg);
    }
    sendNewField(lastSelectedFormat, field);
  };

  fieldLayer.add(bg);

  // Overlay formats first (behind), then active format — never overlay the active tab
  overlayFormats = overlayFormats.filter(n => n !== selectedFormat.name);
  for (const name of overlayFormats) {
    const fmt = activeDocument.formats.find(f => f.name === name);
    if (fmt) {
      renderSelectedFormat(fieldLayer, fmt, true);
    }
  }

  renderSelectedFormat(fieldLayer, selectedFormat, false);
  existingStage.add(fieldLayer);

  // Cursor readout
  existingStage.on(`mousemove`, () => {
    const pos = existingStage.getPointerPosition();
    if (!pos) {
      return;
    }
    const badge = document.getElementById(`cursorBadge`);
    if (badge) {
      const col = Math.floor((pos.x - RULER_LEFT) / pxwPerChar) + 1;
      const row = Math.floor((pos.y - RULER_TOP) / pxhPerLine) + 1;
      if (col >= 1 && col <= renderCols && row >= 1 && row <= renderRows) {
        badge.innerText = `Row ${row}, Col ${col}`;
      } else {
        badge.innerText = ``;
      }
    }
  });

  const globalForSidebar = activeDocument.formats.find(f => f.name === GLOBAL_RECORD_FORMAT);
  updateRecordFormatSidebar(
    selectedFormat,
    globalForSidebar,
    activeDocument.formats,
    overlayFormats,
    editorMode === `design`
      ? (keywords) => sendFormatHeaderUpdate(selectedFormat.name, keywords)
      : undefined,
    (next) => {
      overlayFormats = next;
      setWindowForFormat(chosenFormat);
    },
    editorMode === `design`
      ? (keywords) => sendFormatHeaderUpdate(GLOBAL_RECORD_FORMAT, keywords)
      : undefined,
    (fieldName) => {
      if (!fieldName) {
        return;
      }
      const field = findFieldByName(fieldName);
      const matches = fieldLayer?.find((node) => node.getClassName() === `Group` && node.id() === fieldName) || [];
      const group = matches[0];
      if (field && group) {
        setActiveField(group, field);
      }
    }
  );
  syncFormatTabActive(chosenFormat);

  clearSelection(false);
  if (pendingSelectionNames.length > 0) {
    const names = [...pendingSelectionNames];
    pendingSelectionNames = [];
    names.forEach(name => {
      const field = findFieldByName(name);
      // Konva matches id literally — do not CSS.escape
      const matches = fieldLayer?.find((node) => node.getClassName() === `Group` && node.id() === name) || [];
      const group = matches[0];
      if (field && group) {
        addToSelection(group, field, false);
      }
    });
    updateSelectionUi({ silent: true });
  } else if (editorMode === `design`) {
    openDesignPalette();
  } else {
    const sidebar = document.getElementById(`fieldInfoSidebar`);
    if (sidebar) {
      sidebar.innerHTML = `<div style="padding:1em;opacity:0.7">Preview mode (read-only)</div>`;
    }
  }

  if (formatChanged) {
    announce(`Format ${chosenFormat}`);
  }
}

/**
 * @param {Layer} layer
 * @param {number} cols
 * @param {number} rows
 */
function drawRulers(layer, cols, rows) {
  const totalW = widthInP(cols) + RULER_LEFT;
  const totalH = heightInP(rows) + RULER_TOP;

  layer.add(new Konva.Rect({
    x: 0, y: 0, width: totalW, height: RULER_TOP,
    fill: `#2d2d2d`
  }));
  layer.add(new Konva.Rect({
    x: 0, y: 0, width: RULER_LEFT, height: totalH,
    fill: `#2d2d2d`
  }));

  for (let c = 1; c <= cols; c++) {
    const x = RULER_LEFT + widthInP(c - 1);
    if (c === 1 || c % 10 === 0) {
      layer.add(new Konva.Text({
        x: x,
        y: 2,
        text: String(c),
        fontSize: 9,
        fill: `#ccc`,
        fontFamily: `monospace`,
      }));
    }
    layer.add(new Konva.Line({
      points: [x, RULER_TOP - (c % 5 === 0 ? 8 : 4), x, RULER_TOP],
      stroke: `#888`,
      strokeWidth: 1,
    }));
  }

  for (let r = 1; r <= rows; r++) {
    const y = RULER_TOP + heightInP(r - 1);
    if (r === 1 || r % 5 === 0) {
      layer.add(new Konva.Text({
        x: 2,
        y: y + 2,
        text: String(r),
        fontSize: 9,
        fill: `#ccc`,
        fontFamily: `monospace`,
      }));
    }
    layer.add(new Konva.Line({
      points: [RULER_LEFT - (r % 5 === 0 ? 8 : 4), y, RULER_LEFT, y],
      stroke: `#888`,
      strokeWidth: 1,
    }));
  }
}

/**
 * @param {Layer} layer
 * @param {RecordInfo} format
 * @param {boolean} displayOnly
 */
function renderSelectedFormat(layer, format, displayOnly) {
  if (!displayOnly) {
    lastSelectedFormat = format.name;
  }

  /** @type {RecordInfo|undefined} */
  let windowFormat;
  /** @type {any} */
  let windowConfig;
  /** @type {FieldInfo|undefined} */
  let windowTitle;

  if (format.isWindow) {
    if (format.windowReference) {
      windowFormat = activeDocument.formats.find(f => f.name === format.windowReference);
    } else {
      windowFormat = format;
    }

    const { x, y, width, height } = windowFormat.windowSize;
    windowConfig = {
      baseX: x, baseY: y, baseWidth: width, baseHeight: height,
      // Align with field grid: 1-based row/col → pixel offset via (n-1)
      x: RULER_LEFT + widthInP(Math.max(1, x) - 1),
      y: RULER_TOP + heightInP(Math.max(1, y) - 1),
      width: widthInP(width),
      height: heightInP(height),
      originX: x,
      originY: y,
    };

    const borderInfo = windowFormat.keywords.find(k => k.name === `WDWBORDER`);
    if (borderInfo) {
      const parts = parseParms(borderInfo.value);
      parts.forEach((part, index) => {
        if (part.toUpperCase() === `*COLOR`) {
          windowConfig.color = parts[index + 1];
        }
      });
    }

    const windowInfo = windowFormat.keywords.find(k => k.name === `WDWTITLE`);
    if (windowInfo) {
      windowTitle = {
        name: `WINDOWTITLE`,
        displayType: `const`,
        type: `A`,
        primitiveType: `char`,
        keywords: [],
        conditions: [],
        length: 0,
        decimals: 0,
        position: { x: 0, y: 0 },
        startRange: -1,
      };

      let xPositionValue = `center`;
      let yPositionValue = `top`;
      const parts = parseParms(windowInfo.value);

      parts.forEach((part, index) => {
        switch (part.toUpperCase()) {
          case `*TEXT`:
            windowTitle.value = parts[index + 1];
            break;
          case `*COLOR`:
            windowTitle.keywords.push({ name: `COLOR`, value: parts[index + 1], conditions: [] });
            break;
          case `*DSPATR`:
            windowTitle.keywords.push({ name: `DSPATR`, value: parts[index + 1], conditions: [] });
            break;
          case `*CENTER`:
          case `*LEFT`:
          case `*RIGHT`:
            xPositionValue = part.substring(1).toLowerCase();
            break;
          case `*TOP`:
          case `*BOTTOM`:
            yPositionValue = part.substring(1).toLowerCase();
            break;
        }
      });

      if (!windowTitle.keywords.find(k => k.name === `COLOR`)) {
        windowTitle.keywords.push({ name: `COLOR`, value: `BLU`, conditions: [] });
      }

      const txtLength = (windowTitle.value || ``).length;
      // *BOTTOM sits on the last row inside the window (baseY + height - 1 in 1-based)
      const yPosition = yPositionValue === `top`
        ? windowConfig.baseY
        : windowConfig.baseY + windowConfig.baseHeight - 1;
      let xPosition = windowConfig.baseX + 1;
      switch (xPositionValue) {
        case `center`:
          xPosition = (windowConfig.baseX + 1) + Math.floor((windowConfig.baseWidth / 2) - (txtLength / 2));
          break;
        case `right`:
          xPosition = (windowConfig.baseX + 1) + windowConfig.baseWidth - txtLength;
          break;
        case `left`:
          xPosition = windowConfig.baseX + 1;
          break;
      }
      windowTitle.position = { x: xPosition, y: yPosition };
      windowTitle.length = txtLength;
    }
  }

  if (windowFormat && windowConfig) {
    activeWindowOrigin = {
      originX: windowConfig.originX ?? windowConfig.baseX,
      originY: windowConfig.originY ?? windowConfig.baseY,
      baseWidth: windowConfig.baseWidth,
      baseHeight: windowConfig.baseHeight,
    };
    const windowColor = colours[windowConfig.color] || colours.BLU;
    const winRect = new Konva.Rect({
      id: `win_${windowFormat.name}`,
      x: windowConfig.x,
      y: windowConfig.y,
      width: windowConfig.width,
      height: windowConfig.height,
      stroke: windowColor,
      strokeWidth: 2,
      listening: !displayOnly && editsAllowed() && windowFormat.name === format.name,
      draggable: false,
    });
    layer.add(winRect);

    if (!displayOnly && editsAllowed() && windowFormat.name === format.name) {
      const handle = new Konva.Rect({
        id: `win_resize_${windowFormat.name}`,
        x: windowConfig.x + windowConfig.width - 8,
        y: windowConfig.y + windowConfig.height - 8,
        width: 10,
        height: 10,
        fill: windowColor,
        draggable: true,
        dragBoundFunc: (pos) => {
          const minX = windowConfig.x + widthInP(5);
          const minY = windowConfig.y + heightInP(3);
          return {
            x: Math.max(minX, Math.min(pos.x, RULER_LEFT + widthInP(renderCols) - 10)),
            y: Math.max(minY, Math.min(pos.y, RULER_TOP + heightInP(renderRows) - 10)),
          };
        },
      });
      handle.on(`dragmove`, () => {
        const newW = handle.x() + 8 - windowConfig.x;
        const newH = handle.y() + 8 - windowConfig.y;
        winRect.width(newW);
        winRect.height(newH);
      });
      handle.on(`dragend`, () => {
        const charW = Math.max(5, Math.round(winRect.width() / pxwPerChar));
        const charH = Math.max(3, Math.round(winRect.height() / pxhPerLine));
        const startRow = windowConfig.baseY;
        const startCol = windowConfig.baseX;
        /** @type {any[]} */
        const kws = JSON.parse(JSON.stringify(format.keywords || []));
        const wi = kws.findIndex((k) => k.name === `WINDOW`);
        const value = `${startRow} ${startCol} ${charH} ${charW}`;
        if (wi >= 0) {
          kws[wi].value = value;
        } else {
          kws.push({ name: `WINDOW`, value, conditions: [] });
        }
        sendFormatHeaderUpdate(format.name, kws);
      });
      layer.add(handle);
    }
    if (windowTitle) {
      // Title position is already absolute screen row/col
      const titleEl = getElement(windowTitle, true);
      if (titleEl) {
        layer.add(titleEl);
      }
    }

    if (windowFormat.name !== format.name) {
      addFieldsToLayer(layer, windowFormat, true, windowConfig);
    }
  } else if (!displayOnly) {
    activeWindowOrigin = undefined;
  }

  addFieldsToLayer(layer, format, displayOnly, format.isWindow ? windowConfig : undefined);
}

/**
 * @param {Layer} layer
 * @param {RecordInfo} format
 * @param {boolean} displayOnly
 * @param {{ originX?: number, originY?: number }|undefined} windowOrigin
 */
function addFieldsToLayer(layer, format, displayOnly, windowOrigin) {
  const subfileFormat = format.keywords.find(k => k.name === `SFLCTL`);
  const hasSflDsp = format.keywords.some(k => k.name === `SFLDSP` || k.name === `SFLDSPCTL`);
  const sflClr = format.keywords.some(k => k.name === `SFLCLR`);
  const showSubfile = subfileFormat && (!sflClr || hasSflDsp || format.keywords.some(k => k.name === `SFLPAG`));

  if (showSubfile) {
    const subfilePage = format.keywords.find(k => k.name === `SFLPAG`);
    const sflsiz = format.keywords.find(k => k.name === `SFLSIZ`);
    const rows = Number(subfilePage ? subfilePage.value : (sflsiz ? Math.min(Number(sflsiz.value), 10) : 1));
    const subfileRecord = activeDocument.formats.find(f => f.name === subfileFormat.value);

    if (subfileRecord) {
      const subfileFields = subfileRecord.fields.filter(
        f => f.displayType !== `hidden` && f.position.x > 0 && f.position.y > 0
      );

      const headerConsts = format.fields.filter(f => f.displayType === `const`);
      headerConsts.forEach(field => {
        if (conditionsPass(field.conditions, activeIndicators) || editorMode === `design`) {
          const content = getElement(field, true, windowOrigin);
          if (content) {
            layer.add(content);
          }
        }
      });

      let linesPerItem = 1;
      if (subfileFields.length > 0) {
        const low = Math.min(...subfileFields.map(f => f.position.y));
        const high = Math.max(...subfileFields.map(f => f.position.y));
        linesPerItem = (high - low) + 1;

        for (let row = 0; row < rows; row++) {
          subfileFields.forEach(field => {
            if (!conditionsPass(field.conditions, activeIndicators) && editorMode === `preview`) {
              return;
            }
            let subField = JSON.parse(JSON.stringify(field));
            subField.position.y += (row * linesPerItem);
            subField.name = `${field.name}_${row}`;
            const content = getElement(subField, true, windowOrigin);
            if (content) {
              layer.add(content);
            }
          });
        }
      }

      if (format.keywords.some(k => k.name === `SFLEND`)) {
        const maxY = Math.max(
          ...format.fields.filter(f => f.position.y > 0).map(f => f.position.y),
          1
        );
        const localWidth = windowOrigin?.baseWidth || renderCols;
        const endField = {
          name: `SFLEND_MARK`,
          displayType: `const`,
          value: `More...`,
          position: { x: Math.max(1, localWidth - 8), y: maxY + (rows * linesPerItem) },
          length: 7,
          decimals: 0,
          keywords: [{ name: `COLOR`, value: `BLU`, conditions: [] }],
          conditions: [],
          startRange: -1,
        };
        const el = getElement(endField, true, windowOrigin);
        if (el) {
          layer.add(el);
        }
      }
    }
  }

  const fields = format.fields.filter(field => field.displayType !== `hidden`);
  const skipConsts = showSubfile;

  fields.forEach(field => {
    if (skipConsts && field.displayType === `const`) {
      return;
    }

    const canDisplay = conditionsPass(field.conditions, activeIndicators);
    if (!canDisplay && editorMode === `preview`) {
      return;
    }

    const content = getElement(field, displayOnly || editorMode === `preview`, windowOrigin);
    if (content) {
      if (!canDisplay && editorMode === `design`) {
        content.opacity(0.35);
      }
      layer.add(content);
    }
  });
}

/**
 * @param {{ value: string }} labelInfo
 * @param {Keyword[]} keywords
 */
function applyDatePreview(labelInfo, keywords) {
  const dateSep = keywords.find(k => k.name === `DATSEP`);
  const dateFormat = keywords.find(k => k.name === `DATFMT`);
  if (dateFormat) {
    labelInfo.value = dateFormats[dateFormat.value] || `?FORMAT?`;
    if (dateSep && String(dateSep.value || ``).toUpperCase() !== `*JOB`) {
      labelInfo.value = labelInfo.value.replace(new RegExp(`[./-:]`, `g`), dateSep.value);
    }
  } else {
    labelInfo.value = dateFormats[`*ISO`];
  }
}

/**
 * @param {{ value: string }} labelInfo
 * @param {Keyword[]} keywords
 */
function applyTimePreview(labelInfo, keywords) {
  const sep = keywords.find(k => k.name === `TIMSEP`);
  const format = keywords.find(k => k.name === `TIMFMT`);
  if (format) {
    labelInfo.value = timeFormats[format.value] || `?FORMAT?`;
    if (sep && String(sep.value || ``).toUpperCase() !== `*JOB`) {
      labelInfo.value = labelInfo.value.replace(new RegExp(`[./-:]`, `g`), sep.value);
    }
  } else {
    labelInfo.value = timeFormats[`*HMS`];
  }
}

/**
 * @param {FieldInfo} fieldInfo
 * @param {boolean} displayOnly
 * @param {{ originX?: number, originY?: number }|undefined} windowOrigin
 */
function getElement(fieldInfo, displayOnly = false, windowOrigin = undefined) {
  const keywords = fieldInfo.keywords || [];

  const effectiveKeywords = keywords.filter(k => {
    if (!k.conditions || k.conditions.length === 0) {
      return true;
    }
    return conditionsPass(k.conditions, activeIndicators);
  });

  const originX = windowOrigin?.originX != null ? windowOrigin.originX - 1 : 0;
  const originY = windowOrigin?.originY != null ? windowOrigin.originY - 1 : 0;
  const posX = fieldInfo.position.x;
  const posY = fieldInfo.position.y > 0 ? fieldInfo.position.y : 1;

  const boxInfo = {
    id: fieldInfo.name,
    x: RULER_LEFT + widthInP(originX + posX - 1),
    y: RULER_TOP + heightInP(originY + posY - 1),
    width: 0,
    height: heightInP(1),
    draggable: !displayOnly && editsAllowed() && fieldInfo.position.y !== 0,
  };

  const labelInfo = {
    value: fieldInfo.value || ``,
    colour: colours.GRN,
    fontStyle: `normal`,
    textDecoration: ``,
    opacity: 1,
  };

  let isProtected = false;

  effectiveKeywords.forEach(keyword => {
    const key = keyword.name;
    switch (key) {
      case `PAGNBR`:
        labelInfo.value = `####`;
        break;
      case `COLOR`:
        labelInfo.colour = colours[keyword.value] || colours[String(keyword.value || ``).replace(/^\*/, ``)] || colours.GRN;
        break;
      case `SYSNAME`:
        labelInfo.value = `SYSNAME_`;
        break;
      case `USER`:
        labelInfo.value = `USERNAME__`;
        break;
      case `DATE`:
        applyDatePreview(labelInfo, effectiveKeywords);
        break;
      case `TIME`:
        applyTimePreview(labelInfo, effectiveKeywords);
        break;
      case `UNDERLINE`:
        labelInfo.textDecoration = `underline`;
        break;
      case `HIGHLIGHT`:
        labelInfo.fontStyle = `bold`;
        break;
      case `DSPATR`:
        (keyword.value || ``).split(` `).forEach(value => {
          switch (value) {
            case `UL`:
              labelInfo.textDecoration = `underline`;
              break;
            case `HI`:
              labelInfo.fontStyle = `bold`;
              labelInfo.colour = colours.WHT;
              break;
            case `PR`:
              isProtected = true;
              break;
            case `ND`:
              labelInfo.opacity = editorMode === `preview` ? 0 : 0.3;
              break;
          }
        });
        break;
      case `EDTCDE`:
      case `EDTWRD`:
        break;
    }
  });

  // DDS types L/T preview via DATFMT/TIMFMT — do not require DATE/TIME keywords
  // (those are for system-date/time constants).
  const fieldType = (fieldInfo.type || ``).toUpperCase();
  if (fieldType === `L` && !effectiveKeywords.some(k => k.name === `DATE`)) {
    applyDatePreview(labelInfo, effectiveKeywords);
  } else if (fieldType === `T` && !effectiveKeywords.some(k => k.name === `TIME`)) {
    applyTimePreview(labelInfo, effectiveKeywords);
  }

  const edtcde = effectiveKeywords.find(k => k.name === `EDTCDE`);
  const edtwrd = effectiveKeywords.find(k => k.name === `EDTWRD`);
  if ((edtcde || edtwrd) && fieldInfo.primitiveType === `decimal`) {
    const formatted = formatEditCode(fieldInfo.length, fieldInfo.decimals, edtcde?.value, edtwrd?.value);
    if (formatted) {
      labelInfo.value = formatted;
    }
  }

  let padString = `_`;
  switch (fieldInfo.primitiveType) {
    case `char`:
      switch (fieldInfo.displayType) {
        case `input`: padString = `I`; break;
        case `output`: padString = `O`; break;
        case `both`: padString = `B`; break;
      }
      break;
    case `decimal`:
      switch (fieldInfo.displayType) {
        case `input`: padString = `3`; break;
        case `output`: padString = `6`; break;
        case `both`: padString = `9`; break;
      }
      break;
  }

  if (fieldInfo.isReference && !labelInfo.value) {
    labelInfo.value = ``;
    padString = `R`;
  }

  // Reference fields with a blank length column in DDS source parse as
  // length 0. The host resolves the true length via SYSCOLUMNS and returns
  // it in `resolvedLength` (never emitted back to source, so round-trip is
  // preserved). Fall back to that when the explicit length is missing.
  const effectiveLength = fieldInfo.length > 0
    ? fieldInfo.length
    : (fieldInfo.resolvedLength && fieldInfo.resolvedLength > 0 ? fieldInfo.resolvedLength : 0);
  const displayLength = effectiveLength > 0 && labelInfo.value.length < effectiveLength
    ? effectiveLength
    : Math.max(labelInfo.value.length, 1);
  const displayValue = String(labelInfo.value)
    .replace(new RegExp(`''`, `g`), `'`)
    .padEnd(displayLength, padString);

  boxInfo.width = widthInP(displayLength);

  if (isProtected && editorMode === `preview`) {
    labelInfo.colour = PROTECT_COLOUR;
    labelInfo.opacity = 0.7;
  }

  let group = new Konva.Group(boxInfo);
  const dragLength = fieldContentLength(fieldInfo);

  group.on('dragmove', (e) => {
    const cGroup = e.target;
    const boxPos = cGroup.absolutePosition();
    let snapped = snapToFixedGrid(boxPos.x - RULER_LEFT, boxPos.y - RULER_TOP);
    const maxStartCol = maxStartColumnForLength(renderCols, dragLength);
    const hitRight = snapped.x > widthInP(maxStartCol - 1);
    const hitBottom = snapped.y > heightInP(renderRows - 1);
    snapped = {
      x: Math.min(Math.max(0, snapped.x), widthInP(maxStartCol - 1)),
      y: Math.min(Math.max(0, snapped.y), heightInP(renderRows - 1)),
    };
    cGroup.absolutePosition({
      x: snapped.x + RULER_LEFT,
      y: snapped.y + RULER_TOP
    });
    if (hitRight) {
      showDesignError(
        `Content past record length of ${renderCols} (length ${dragLength}).`,
      );
    } else if (hitBottom) {
      showDesignError(`Row must be between 1 and ${renderRows}.`);
    }
  });

  group.on(`dragend`, (e) => {
    const cGroup = e.target;
    const boxPos = cGroup.absolutePosition();
    let snapped = snapToFixedGrid(boxPos.x - RULER_LEFT, boxPos.y - RULER_TOP);
    const maxStartCol = maxStartColumnForLength(renderCols, dragLength);
    snapped = {
      x: Math.min(Math.max(0, snapped.x), widthInP(maxStartCol - 1)),
      y: Math.min(Math.max(0, snapped.y), heightInP(renderRows - 1)),
    };
    cGroup.absolutePosition({
      x: snapped.x + RULER_LEFT,
      y: snapped.y + RULER_TOP
    });

    const screen = gridCordsToFieldCords(snapped.x, snapped.y);
    const newPos = screenToFieldPosition(screen.x, screen.y, {
      wasY0: fieldInfo.position.y === 0,
      length: dragLength,
    });
    const dx = newPos.x - fieldInfo.position.x;
    const dy = (fieldInfo.position.y === 0) ? 0 : (newPos.y - fieldInfo.position.y);

    const moving = selectedItems.some(s => s.field.name === fieldInfo.name) && selectedItems.length > 1
      ? selectedItems
      : [{ group: cGroup, field: fieldInfo }];

    const bounds = currentPositionBounds();
    let clampedAny = false;
    const updates = moving.map(({ field }) => {
      const len = fieldContentLength(field);
      const rawX = field.position.x + dx;
      const rawY = field.position.y === 0 ? 0 : field.position.y + dy;
      const position = clampFieldPosition(rawX, rawY, {
        ...bounds,
        wasY0: field.position.y === 0,
        length: len,
      });
      if (rawX > position.x || (rawY > 0 && rawY > position.y)) {
        clampedAny = true;
      }
      return {
        originalFieldName: field.name,
        fieldInfo: {
          ...field,
          position,
        }
      };
    });

    if (clampedAny) {
      showDesignError(
        `Content past record length of ${bounds.maxX}. Fields were kept inside the screen.`,
      );
    }

    const peers = currentFormatFields().map((f) => {
      const moved = updates.find(
        (u) => u.originalFieldName === f.name || isSameFieldRef(u.fieldInfo, f),
      );
      return moved ? moved.fieldInfo : f;
    });
    for (const u of updates) {
      const overlapMsg = formatOverlapWarning(u.fieldInfo, peers);
      if (overlapMsg) {
        showDesignError(overlapMsg);
        break;
      }
    }

    if (updates.length === 1) {
      fieldInfo.position.x = updates[0].fieldInfo.position.x;
      fieldInfo.position.y = updates[0].fieldInfo.position.y;
      sendFieldUpdate(lastSelectedFormat, fieldInfo.name, fieldInfo);
    } else {
      sendFieldsUpdate(lastSelectedFormat, updates);
    }
  });

  group.add(new Konva.Rect({
    id: `bg`,
    fill: fieldBackgroundColour(fieldInfo, false),
    x: 0,
    y: 0,
    width: boxInfo.width,
    height: pxhPerChar,
  }));

  group.add(new Konva.Text({
    text: displayValue,
    fontSize: 14,
    fontFamily: `Consolas, "Liberation Mono", Menlo, Courier, monospace`,
    fill: labelInfo.colour,
    fontStyle: labelInfo.fontStyle,
    textDecoration: labelInfo.textDecoration,
    opacity: labelInfo.opacity,
  }));

  if (!displayOnly) {
    group.on('pointerclick', (e) => {
      e.cancelBubble = true;
      if (e.evt.shiftKey) {
        toggleSelection(group, fieldInfo);
      } else {
        setActiveField(group, fieldInfo);
      }
    });
    group.on(`dblclick`, (e) => {
      e.cancelBubble = true;
      revealFieldInSource(fieldInfo);
    });
    group.on(`dbltap`, (e) => {
      e.cancelBubble = true;
      revealFieldInSource(fieldInfo);
    });
  }

  return group;
}

/**
 * Inclusive 0-based source lines covering a field definition (and its keywords).
 * @param {FieldInfo} field
 * @returns {{ startLine: number, endLine: number } | undefined}
 */
function fieldSourceRange(field) {
  if (!field) {
    return undefined;
  }
  const owned = Array.isArray(field.ownedLines) && field.ownedLines.length > 0
    ? field.ownedLines.filter((n) => Number.isInteger(n) && n >= 0)
    : null;
  const start = owned && owned.length > 0
    ? Math.min(...owned)
    : field.startRange;
  const end = owned && owned.length > 0
    ? Math.max(...owned)
    : (field.endRange ?? field.startRange);
  if (!Number.isInteger(start) || start < 0) {
    return undefined;
  }
  if (!Number.isInteger(end) || end < start) {
    return undefined;
  }
  return { startLine: start, endLine: end };
}

/** Open/focus the DDS text editor on this field's source lines. */
function revealFieldInSource(field) {
  const range = fieldSourceRange(field);
  if (!range) {
    return;
  }
  vscode.postMessage({
    command: `revealInSource`,
    startLine: range.startLine,
    endLine: range.endLine,
  });
}

/**
 * @param {string} name
 */
function findFieldByName(name) {
  if (!activeDocument || !lastSelectedFormat) {
    return undefined;
  }
  const format = activeDocument.formats.find(f => f.name === lastSelectedFormat);
  return format?.fields.find(f => f.name === name);
}

/**
 * Fields on the active record format (for overlap checks / selection UI).
 * @returns {FieldInfo[]}
 */
function currentFormatFields() {
  if (!activeDocument || !lastSelectedFormat) {
    return [];
  }
  const format = activeDocument.formats.find((f) => f.name === lastSelectedFormat);
  return format?.fields || [];
}

/**
 * @param {FieldInfo} field
 * @param {boolean} selected
 */
function fieldBackgroundColour(field, selected) {
  if (selected) {
    return SELECTED_COLOUR;
  }
  if (formatOverlapWarning(field, currentFormatFields())) {
    return OVERLAP_COLOUR;
  }
  return colours.BLK;
}

function clearSelection(updatePalette = true) {
  selectedItems.forEach(({ group, field }) => {
    const bg = group.findOne(`#bg`);
    if (bg) {
      bg.fill(fieldBackgroundColour(field, false));
    }
  });
  selectedItems = [];
  if (updatePalette) {
    updateSelectionUi();
  }
}

/**
 * @param {{ silent?: boolean }} [opts]
 */
function updateSelectionUi(opts = {}) {
  if (selectedItems.length === 1) {
    const selected = selectedItems[0];
    const originalFieldName = selected.field.name;
    updateSelectedFieldSidebar(
      selected.field,
      (field) => sendFieldUpdate(lastSelectedFormat, originalFieldName, field),
      () => sendDelete(lastSelectedFormat, originalFieldName),
      {
        generalTools: createSelectionTools(false),
        bounds: currentPositionBounds(),
        peerFields: currentFormatFields(),
      }
    );
    if (!opts.silent) {
      announce(`Selected ${selected.field.name || `constant`} at row ${selected.field.position?.y}, column ${selected.field.position?.x}`);
    }
  } else if (selectedItems.length > 1) {
    updateMultiSelectSidebar();
    if (!opts.silent) {
      announce(`${selectedItems.length} fields selected`);
    }
  } else if (editorMode === `design`) {
    openDesignPalette();
  } else {
    const sidebar = document.getElementById(`fieldInfoSidebar`);
    if (sidebar) {
      sidebar.innerHTML = `<div class="panel-empty">Preview mode (read-only)</div>`;
    }
  }
}

/**
 * Multi-select Fields panel: count header + collapsible Keywords tools.
 */
function updateMultiSelectSidebar() {
  const sidebar = document.getElementById(`fieldInfoSidebar`);
  if (!sidebar) {
    return;
  }
  const header = document.createElement(`div`);
  header.className = `panel-section-header`;
  header.textContent = `${selectedItems.length} fields selected`;

  /** @type {{title: string, html: string|Element, open?: boolean}[]} */
  const sections = [];
  const tools = createSelectionTools(true);
  if (tools) {
    sections.push({ title: `Keywords`, open: true, html: tools });
  }
  renderSections(sidebar, sections);
  sidebar.insertBefore(header, sidebar.firstChild);

  const peers = currentFormatFields();
  const overlapNotes = selectedItems
    .map(({ field }) => formatOverlapWarning(field, peers))
    .filter(Boolean);
  if (overlapNotes.length > 0) {
    const warn = document.createElement(`div`);
    warn.className = `panel-overlap-warning`;
    warn.setAttribute(`role`, `alert`);
    warn.textContent = [...new Set(overlapNotes)].join(` `);
    sidebar.insertBefore(warn, header.nextSibling);
  }
}

/**
 * Align / color / DSPATR quick tools for the current selection.
 * @param {boolean} multi
 * @returns {HTMLElement|undefined}
 */
function createSelectionTools(multi) {
  if (!editsAllowed()) {
    return undefined;
  }
  const tools = document.createElement(`div`);
  tools.className = `selection-tools`;

  const alignRow = document.createElement(`div`);
  alignRow.className = `selection-tools-row`;
  /** @type {Array<[string, string]>} */
  const aligns = [
    [`Left`, `left`],
    [`Center`, `center`],
    [`Right`, `right`],
    [`Top`, `top`],
  ];
  for (const [label, mode] of aligns) {
    if (!multi && mode !== `center`) {
      continue;
    }
    const btn = document.createElement(`vscode-button`);
    btn.setAttribute(`secondary`, `true`);
    btn.innerText = label;
    btn.onclick = () => alignSelectedFields(mode);
    alignRow.appendChild(btn);
  }
  tools.appendChild(alignRow);

  const colorRow = document.createElement(`div`);
  colorRow.className = `selection-tools-row`;
  const colorSelect = document.createElement(`select`);
  colorSelect.className = `prop-select selection-color-select`;
  colorSelect.setAttribute(`aria-label`, `COLOR`);
  colorSelect.innerHTML = `<option value="">COLOR…</option>`;
  for (const c of [`GRN`, `WHT`, `RED`, `TRQ`, `YLW`, `PNK`, `BLU`]) {
    const o = document.createElement(`option`);
    o.value = c;
    o.textContent = c;
    colorSelect.appendChild(o);
  }
  colorSelect.onchange = () => {
    if (colorSelect.value) {
      applyKeywordToSelection(`COLOR`, colorSelect.value, false);
      colorSelect.value = ``;
    }
  };
  colorRow.appendChild(colorSelect);

  for (const atr of [`HI`, `UL`, `RI`, `ND`, `PR`]) {
    const btn = document.createElement(`vscode-button`);
    btn.setAttribute(`secondary`, `true`);
    btn.innerText = atr;
    btn.title = `DSPATR(${atr})`;
    btn.onclick = () => applyKeywordToSelection(`DSPATR`, atr, true);
    colorRow.appendChild(btn);
  }
  tools.appendChild(colorRow);

  return tools;
}

/**
 * @param {'left'|'center'|'right'|'top'} mode
 */
function alignSelectedFields(mode) {
  if (!selectedItems.length || !editsAllowed()) {
    return;
  }
  const bounds = currentPositionBounds();
  const cols = bounds.maxX;
  /** @type {Array<{ originalFieldName: string, fieldInfo: any }>} */
  const updates = [];

  if (mode === `center` && selectedItems.length === 1) {
    const item = selectedItems[0];
    const len = fieldContentLength(item.field);
    const next = JSON.parse(JSON.stringify(item.field));
    next.position = clampFieldPosition(
      Math.floor((cols - len) / 2) + 1,
      next.position.y,
      { ...bounds, wasY0: next.position.y === 0, length: len },
    );
    updates.push({ originalFieldName: item.field.name, fieldInfo: next });
  } else if (mode === `left` || mode === `right` || mode === `top`) {
    // Exclude y=0 (printer relative) fields from top-align targets so we do
    // not force normal fields onto a blank row.
    const xs = selectedItems.map((s) => s.field.position.x);
    const ys = selectedItems
      .map((s) => s.field.position.y)
      .filter((y) => y > 0);
    const targetX = mode === `left` ? Math.min(...xs) : mode === `right` ? Math.max(...xs) : undefined;
    const targetY = mode === `top` && ys.length > 0 ? Math.min(...ys) : undefined;
    let clampedAny = false;
    for (const item of selectedItems) {
      const next = JSON.parse(JSON.stringify(item.field));
      const wasY0 = next.position.y === 0;
      const len = fieldContentLength(next);
      let x = next.position.x;
      let y = next.position.y;
      if (targetX != null) {
        x = targetX;
      }
      if (targetY != null && !wasY0) {
        y = targetY;
      }
      const position = clampFieldPosition(x, y, { ...bounds, wasY0, length: len });
      if (x > position.x) {
        clampedAny = true;
      }
      next.position = position;
      updates.push({ originalFieldName: item.field.name, fieldInfo: next });
    }
    if (clampedAny) {
      showDesignError(
        `Content past record length of ${bounds.maxX}. Fields were kept inside the screen.`,
      );
    }
  } else if (mode === `center` && selectedItems.length > 1) {
    for (const item of selectedItems) {
      const len = fieldContentLength(item.field);
      const next = JSON.parse(JSON.stringify(item.field));
      next.position = clampFieldPosition(
        Math.floor((cols - len) / 2) + 1,
        next.position.y,
        { ...bounds, wasY0: next.position.y === 0, length: len },
      );
      updates.push({ originalFieldName: item.field.name, fieldInfo: next });
    }
  }

  if (updates.length === 1) {
    sendFieldUpdate(lastSelectedFormat, updates[0].originalFieldName, updates[0].fieldInfo);
  } else if (updates.length > 1) {
    sendFieldsUpdate(lastSelectedFormat, updates);
  }
}

/**
 * @param {string} name
 * @param {string} value
 * @param {boolean} mergeMulti  if true, merge into existing DSPATR values
 */
function applyKeywordToSelection(name, value, mergeMulti) {
  if (!selectedItems.length || !editsAllowed()) {
    return;
  }
  /** @type {Array<{ originalFieldName: string, fieldInfo: any }>} */
  const updates = [];
  for (const item of selectedItems) {
    const next = JSON.parse(JSON.stringify(item.field));
    next.keywords = next.keywords || [];
    if (mergeMulti && name === `DSPATR`) {
      const existing = next.keywords.find((k) => k.name === `DSPATR`);
      if (existing) {
        const parts = new Set(String(existing.value || ``).split(/[\s,]+/).filter(Boolean).map((s) => s.toUpperCase()));
        parts.add(value.toUpperCase());
        existing.value = [...parts].join(` `);
      } else {
        next.keywords.push({ name: `DSPATR`, value: value.toUpperCase(), conditions: [] });
      }
    } else {
      const existing = next.keywords.find((k) => k.name === name);
      if (existing) {
        existing.value = value;
      } else {
        next.keywords.push({ name, value, conditions: [] });
      }
    }
    updates.push({ originalFieldName: item.field.name, fieldInfo: next });
  }
  if (updates.length === 1) {
    sendFieldUpdate(lastSelectedFormat, updates[0].originalFieldName, updates[0].fieldInfo);
  } else {
    sendFieldsUpdate(lastSelectedFormat, updates);
  }
}

/**
 * @param {Group} group
 * @param {FieldInfo} fieldInfo
 * @param {boolean} updateUi
 */
function addToSelection(group, fieldInfo, updateUi = true) {
  if (selectedItems.some(s => s.field.name === fieldInfo.name)) {
    return;
  }
  selectedItems.push({ group, field: fieldInfo });
  const bg = group.findOne(`#bg`);
  if (bg) {
    bg.fill(fieldBackgroundColour(fieldInfo, true));
  }
  if (updateUi) {
    updateSelectionUi();
  }
}

/**
 * @param {Group} group
 * @param {FieldInfo} fieldInfo
 */
function toggleSelection(group, fieldInfo) {
  const idx = selectedItems.findIndex(s => s.field.name === fieldInfo.name);
  if (idx >= 0) {
    const bg = selectedItems[idx].group.findOne(`#bg`);
    if (bg) {
      bg.fill(fieldBackgroundColour(selectedItems[idx].field, false));
    }
    selectedItems.splice(idx, 1);
    updateSelectionUi();
    return;
  }
  addToSelection(group, fieldInfo);
}

/**
 * @param {Group} [konvaElement]
 * @param {FieldInfo} [fieldInfo]
 */
function setActiveField(konvaElement, fieldInfo) {
  clearKeywordEditor();
  clearSelection(false);

  if (konvaElement && fieldInfo) {
    addToSelection(konvaElement, fieldInfo);
  } else {
    updateSelectionUi();
  }
}

/**
 * @param {string[]} recordFormats
 * @param {string} [setActiveTab]
 */
function setTabs(recordFormats, setActiveTab) {
  const tabs = document.getElementById(`recordFormatTabs`);
  if (!tabs) {
    return;
  }

  const active = setActiveTab && recordFormats.includes(setActiveTab)
    ? setActiveTab
    : (recordFormats.includes(lastSelectedFormat) ? lastSelectedFormat : recordFormats[0]);

  tabs.innerHTML = ``;
  for (const name of recordFormats) {
    const btn = document.createElement(`button`);
    btn.type = `button`;
    btn.id = `format-tab-${name}`;
    btn.className = `format-tab` + (name === active ? ` active` : ``);
    btn.setAttribute(`role`, `tab`);
    btn.setAttribute(`aria-selected`, name === active ? `true` : `false`);
    btn.setAttribute(`aria-controls`, `container`);
    btn.tabIndex = name === active ? 0 : -1;
    btn.dataset.format = name;
    btn.textContent = name;
    btn.title = name;
    tabs.appendChild(btn);
  }

  syncFormatTabActive(active);
}

/**
 * @param {string|undefined} formatName
 */
function syncFormatTabActive(formatName) {
  const tabs = document.getElementById(`recordFormatTabs`);
  if (!tabs || !formatName) {
    return;
  }
  /** @type {HTMLElement|null} */
  let activeBtn = null;
  tabs.querySelectorAll(`.format-tab`).forEach((el) => {
    const isActive = el instanceof HTMLElement && el.dataset.format === formatName;
    el.classList.toggle(`active`, isActive);
    el.setAttribute(`aria-selected`, isActive ? `true` : `false`);
    if (el instanceof HTMLElement) {
      el.tabIndex = isActive ? 0 : -1;
    }
    if (isActive && el instanceof HTMLElement) {
      activeBtn = el;
    }
  });
  if (activeBtn && typeof activeBtn.scrollIntoView === `function`) {
    activeBtn.scrollIntoView({ inline: `nearest`, block: `nearest`, behavior: `smooth` });
  }
  const panel = document.getElementById(`canvasTabPanel`);
  if (panel && activeBtn?.id) {
    panel.setAttribute(`aria-labelledby`, activeBtn.id);
  }
}

/**
 * Activate a record-format tab (shared by click and keyboard).
 * @param {string} formatName
 */
function activateFormatTab(formatName) {
  if (!formatName) {
    return;
  }

  if (formatName === lastSelectedFormat) {
    return;
  }

  overlayFormats = [];
  clearAllIndicators();
  clearKeywordEditor();
  setWindowForFormat(formatName);
}

export function setupTabsHandler() {
  const tabs = document.getElementById(`recordFormatTabs`);
  if (!tabs) {
    return;
  }

  tabs.addEventListener(`click`, (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const btn = target.closest(`.format-tab`);
    if (!btn || !tabs.contains(btn) || !(btn instanceof HTMLElement)) {
      return;
    }
    const formatName = btn.dataset.format;
    if (!formatName) {
      return;
    }
    activateFormatTab(formatName);
  });

  tabs.addEventListener(`keydown`, (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains(`format-tab`)) {
      return;
    }
    const buttons = [...tabs.querySelectorAll(`.format-tab`)].filter(
      (el) => el instanceof HTMLElement
    );
    if (buttons.length === 0) {
      return;
    }
    const currentIndex = buttons.indexOf(target);
    if (currentIndex < 0) {
      return;
    }

    let nextIndex = -1;
    switch (event.key) {
      case `ArrowLeft`:
        nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        break;
      case `ArrowRight`:
        nextIndex = (currentIndex + 1) % buttons.length;
        break;
      case `Home`:
        nextIndex = 0;
        break;
      case `End`:
        nextIndex = buttons.length - 1;
        break;
      case `ContextMenu`:
        event.preventDefault();
        if (editsAllowed() && target.dataset.format) {
          const rect = target.getBoundingClientRect();
          showFormatTabMenu(rect.left, rect.bottom, target.dataset.format);
        }
        return;
      case `F10`:
        if (event.shiftKey && editsAllowed() && target.dataset.format) {
          event.preventDefault();
          const rect = target.getBoundingClientRect();
          showFormatTabMenu(rect.left, rect.bottom, target.dataset.format);
        }
        return;
      default:
        return;
    }

    event.preventDefault();
    const next = buttons[nextIndex];
    if (!(next instanceof HTMLElement) || !next.dataset.format) {
      return;
    }
    next.focus();
    activateFormatTab(next.dataset.format);
  });

  tabs.addEventListener(`contextmenu`, (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const btn = target.closest(`.format-tab`);
    if (!btn || !tabs.contains(btn) || !(btn instanceof HTMLElement)) {
      return;
    }
    const formatName = btn.dataset.format;
    if (!formatName || !editsAllowed()) {
      return;
    }
    event.preventDefault();
    showFormatTabMenu(event.clientX, event.clientY, formatName);
  });
}

/**
 * @param {number} x
 * @param {number} y
 * @param {string} formatName
 */
function showFormatTabMenu(x, y, formatName) {
  if (formatTabMenuCleanup) {
    formatTabMenuCleanup();
    formatTabMenuCleanup = undefined;
  }
  document.getElementById(`formatTabMenu`)?.remove();
  const menu = document.createElement(`div`);
  menu.id = `formatTabMenu`;
  menu.className = `format-tab-menu`;
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  /** @param {string} label @param {() => void} onClick */
  const addItem = (label, onClick) => {
    const item = document.createElement(`button`);
    item.type = `button`;
    item.className = `format-tab-menu-item`;
    item.textContent = label;
    item.onclick = () => {
      if (formatTabMenuCleanup) {
        formatTabMenuCleanup();
        formatTabMenuCleanup = undefined;
      }
      menu.remove();
      onClick();
    };
    menu.appendChild(item);
  };

  addItem(`Rename…`, async () => {
    const next = await requestHostInput({
      title: `Rename record format`,
      value: formatName,
      prompt: `New name for ${formatName}`,
      validate: `recordName`,
    });
    if (!next) {
      return;
    }
    const name = next.trim().toUpperCase();
    if (name === formatName.toUpperCase()) {
      return;
    }
    if (!isValidRecordName(name)) {
      showHostError(`Invalid record name. Use 1–10 characters: A–Z, 0–9, @, #, $.`);
      return;
    }
    const taken = (activeDocument?.formats || []).some(
      (f) => f.name && f.name.toUpperCase() === name && f.name.toUpperCase() !== formatName.toUpperCase()
    );
    if (taken) {
      showHostError(`Record format ${name} already exists.`);
      return;
    }
    lastSelectedFormat = name;
    vscode.postMessage({ command: `renameFormat`, recordFormat: formatName, newName: name });
  });

  addItem(`Copy…`, async () => {
    const existing = new Set(
      (activeDocument?.formats || []).map((f) => f.name.toUpperCase()).filter(Boolean)
    );
    const suggestion = (() => {
      for (let i = 1; i <= 99; i++) {
        const c = `${formatName.substring(0, 7)}${String(i).padStart(2, `0`)}`.substring(0, 10);
        if (!existing.has(c.toUpperCase())) {
          return c.toUpperCase();
        }
      }
      return `${formatName}2`.substring(0, 10);
    })();
    const next = await requestHostInput({
      title: `Copy record as`,
      value: suggestion,
      prompt: `Name for the copy of ${formatName}`,
      validate: `recordName`,
    });
    if (!next) {
      return;
    }
    const name = next.trim().toUpperCase();
    if (!isValidRecordName(name)) {
      showHostError(`Invalid record name. Use 1–10 characters: A–Z, 0–9, @, #, $.`);
      return;
    }
    if (existing.has(name)) {
      showHostError(`Record format ${name} already exists.`);
      return;
    }
    lastSelectedFormat = name;
    vscode.postMessage({ command: `copyFormat`, recordFormat: formatName, newName: name });
  });

  addItem(`Delete`, async () => {
    const confirmed = await requestHostConfirm({
      message: `Delete record format ${formatName}?`,
      confirmLabel: `Delete`,
    });
    if (!confirmed) {
      return;
    }
    const others = (activeDocument?.formats || [])
      .map((f) => f.name)
      .filter((n) => n && n !== GLOBAL_RECORD_FORMAT && n !== formatName);
    lastSelectedFormat = others[0];
    vscode.postMessage({ command: `deleteFormat`, recordFormat: formatName });
  });

  document.body.appendChild(menu);
  const close = (e) => {
    if (e.target instanceof Node && menu.contains(e.target)) {
      return;
    }
    menu.remove();
    document.removeEventListener(`mousedown`, close, true);
    formatTabMenuCleanup = undefined;
  };
  formatTabMenuCleanup = () => {
    menu.remove();
    document.removeEventListener(`mousedown`, close, true);
    formatTabMenuCleanup = undefined;
  };
  setTimeout(() => document.addEventListener(`mousedown`, close, true), 0);
}

const EDITING_VSCODE_TAGS = new Set([
  `vscode-textfield`,
  `vscode-textarea`,
  `vscode-single-select`,
  `vscode-multi-select`,
  `vscode-checkbox`,
]);

function isEditingUiTarget() {
  const el = document.activeElement;
  if (!el) {
    return false;
  }
  const tag = el.tagName?.toLowerCase();
  if (tag === `input` || tag === `textarea` || tag === `select`) {
    return true;
  }
  if (el.isContentEditable) {
    return true;
  }
  if (tag && EDITING_VSCODE_TAGS.has(tag)) {
    return true;
  }
  if (el.closest && el.closest(`vscode-textfield, vscode-textarea, vscode-single-select, vscode-multi-select, vscode-checkbox, #screenSizeSelect`)) {
    return true;
  }
  return false;
}

function uniqueFieldName(base, existingNames) {
  let name = base.substring(0, 10);
  if (!existingNames.has(name)) {
    return name;
  }
  for (let i = 2; i < 100; i++) {
    const suffix = String(i);
    name = `${base.substring(0, Math.max(1, 10 - suffix.length))}${suffix}`;
    if (!existingNames.has(name)) {
      return name;
    }
  }
  return `F${Date.now()}`.substring(0, 10);
}

/** @type {ReturnType<typeof setTimeout>|undefined} */
let nudgeTimer = undefined;
/** @type {{ recordFormat: string, updates: Array<{ originalFieldName: string, fieldInfo: any }> }|undefined} */
let pendingNudge = undefined;

function cancelPendingNudge() {
  if (nudgeTimer) {
    clearTimeout(nudgeTimer);
    nudgeTimer = undefined;
  }
  pendingNudge = undefined;
}

export function flushPendingNudge() {
  if (nudgeTimer) {
    clearTimeout(nudgeTimer);
    nudgeTimer = undefined;
  }
  if (!pendingNudge) {
    return;
  }
  const { recordFormat, updates } = pendingNudge;
  pendingNudge = undefined;
  sendFieldsUpdate(recordFormat, updates);
  if (updates.length === 1) {
    const pos = updates[0].fieldInfo?.position;
    if (pos) {
      announce(`Moved to row ${pos.y}, column ${pos.x}`);
    }
  } else if (updates.length > 1) {
    announce(`Moved ${updates.length} fields`);
  }
}

/**
 * Coalesce held-arrow nudges into one WorkspaceEdit after a short pause.
 * @param {string} recordFormat
 * @param {Array<{ originalFieldName: string, fieldInfo: any }>} updates
 */
function scheduleNudgeUpdate(recordFormat, updates) {
  pendingNudge = { recordFormat, updates };
  if (nudgeTimer) {
    clearTimeout(nudgeTimer);
  }
  nudgeTimer = setTimeout(() => {
    nudgeTimer = undefined;
    flushPendingNudge();
  }, 60);
}

export function setupKeyboard() {
  window.addEventListener(`keydown`, (e) => {
    if (!editsAllowed()) {
      return;
    }

    if (isEditingUiTarget()) {
      return;
    }

    if (e.key === `Escape`) {
      if (selectedItems.length > 0) {
        e.preventDefault();
        cancelPendingNudge();
        clearSelection(true);
        document.getElementById(`container`)?.focus();
        announce(`Selection cleared`);
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === `c`) {
      if (selectedItems.length > 0) {
        clipboard = selectedItems.map(s => JSON.parse(JSON.stringify(s.field)));
        e.preventDefault();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === `v`) {
      if (clipboard.length > 0 && lastSelectedFormat) {
        const format = activeDocument.formats.find(f => f.name === lastSelectedFormat);
        const existing = new Set((format?.fields || []).map(f => f.name));
        const bounds = currentPositionBounds();
        const fields = clipboard.map((field) => {
          const copy = JSON.parse(JSON.stringify(field));
          const wasY0 = field.position.y === 0;
          const len = fieldContentLength(copy);
          // Preserve printer y=0; otherwise paste one row below the original.
          copy.position = clampFieldPosition(
            field.position.x,
            wasY0 ? 0 : field.position.y + 1,
            { ...bounds, wasY0, length: len },
          );
          const base = (copy.name || `FIELD`).replace(/_C\d*$/, ``);
          copy.name = uniqueFieldName(`${base}_C`, existing);
          existing.add(copy.name);
          return copy;
        });
        sendNewFields(lastSelectedFormat, fields);
        e.preventDefault();
      }
      return;
    }

    if (selectedItems.length === 0) {
      const container = document.getElementById(`container`);
      const focusInCanvas = container && (
        document.activeElement === container || container.contains(document.activeElement)
      );
      if (!focusInCanvas) {
        return;
      }
      const selectFirst =
        e.key === `Enter` ||
        e.key === `Tab` ||
        e.key === `ArrowLeft` ||
        e.key === `ArrowRight` ||
        e.key === `ArrowUp` ||
        e.key === `ArrowDown`;
      if (!selectFirst) {
        return;
      }
      e.preventDefault();
      selectFirstVisibleField();
      return;
    }

    if (e.key === `Delete` || e.key === `Backspace`) {
      const names = selectedItems.map(s => s.field.name).filter(Boolean);
      if (names.length === 1) {
        sendDelete(lastSelectedFormat, names[0]);
      } else if (names.length > 1) {
        void (async () => {
          const confirmed = await requestHostConfirm({
            message: `Delete ${names.length} selected fields?`,
            confirmLabel: `Delete`,
          });
          if (confirmed) {
            sendDeleteFields(lastSelectedFormat, names);
          }
        })();
      }
      e.preventDefault();
      return;
    }

    if (e.key === `Tab`) {
      e.preventDefault();
      const format = activeDocument.formats.find(f => f.name === lastSelectedFormat);
      if (!format) {
        return;
      }
      const visible = format.fields.filter(f => f.displayType !== `hidden`);
      if (visible.length === 0) {
        return;
      }
      const currentName = selectedItems[0]?.field.name;
      let idx = visible.findIndex(f => f.name === currentName);
      idx = e.shiftKey ? (idx - 1 + visible.length) % visible.length : (idx + 1) % visible.length;
      const next = visible[idx];
      const group = fieldLayer?.findOne(`#${next.name}`);
      if (group) {
        setActiveField(group, next);
      }
      return;
    }

    const step = e.shiftKey ? 5 : 1;
    let dx = 0;
    let dy = 0;
    switch (e.key) {
      case `ArrowLeft`: dx = -step; break;
      case `ArrowRight`: dx = step; break;
      case `ArrowUp`: dy = -step; break;
      case `ArrowDown`: dy = step; break;
      default:
        return;
    }
    e.preventDefault();

    // Mutate local field positions so held keys accumulate before the flush.
    const bounds = currentPositionBounds();
    let clampedAny = false;
    const updates = selectedItems.map(({ field, group }) => {
      const wasY0 = field.position.y === 0;
      const len = fieldContentLength(field);
      const rawX = field.position.x + dx;
      const rawY = wasY0 ? 0 : field.position.y + dy;
      const nextPos = clampFieldPosition(rawX, rawY, {
        ...bounds,
        wasY0,
        length: len,
      });
      if (rawX > nextPos.x || (rawY > 0 && rawY > nextPos.y)) {
        clampedAny = true;
      }
      field.position = nextPos;
      if (group) {
        group.absolutePosition(fieldPositionToPixels(nextPos));
      }
      return {
        originalFieldName: field.name,
        fieldInfo: { ...field, position: { ...nextPos } },
      };
    });
    fieldLayer?.batchDraw();

    if (clampedAny) {
      showDesignError(
        `Content past record length of ${bounds.maxX}. Fields were kept inside the screen.`,
      );
    } else {
      const peers = currentFormatFields().map((f) => {
        const moved = updates.find(
          (u) => u.originalFieldName === f.name || isSameFieldRef(u.fieldInfo, f),
        );
        return moved ? moved.fieldInfo : f;
      });
      for (const u of updates) {
        const overlapMsg = formatOverlapWarning(u.fieldInfo, peers);
        if (overlapMsg) {
          showDesignError(overlapMsg);
          break;
        }
      }
    }

    scheduleNudgeUpdate(lastSelectedFormat, updates);
  });
}

/** Select the first visible field on the active format (keyboard entry into the canvas). */
function selectFirstVisibleField() {
  if (!activeDocument || !lastSelectedFormat) {
    return;
  }
  const format = activeDocument.formats.find((f) => f.name === lastSelectedFormat);
  if (!format) {
    return;
  }
  const visible = format.fields.filter((f) => f.displayType !== `hidden`);
  if (visible.length === 0) {
    announce(`No fields on ${lastSelectedFormat}`);
    return;
  }
  const first = visible[0];
  const matches = fieldLayer?.find((node) => node.getClassName() === `Group` && node.id() === first.name) || [];
  const group = matches[0];
  if (group) {
    setActiveField(group, first);
  }
}

function sendNewField(recordFormat, fieldInfo) {
  if (!editsAllowed()) {
    return;
  }
  vscode.postMessage({ command: `newField`, recordFormat, fieldInfo });
}

function sendNewFields(recordFormat, fields) {
  if (!editsAllowed() || !fields?.length) {
    return;
  }
  if (fields.length === 1) {
    sendNewField(recordFormat, fields[0]);
    return;
  }
  vscode.postMessage({ command: `newFields`, recordFormat, fields });
}

function sendDelete(recordFormat, fieldName) {
  if (!editsAllowed()) {
    return;
  }
  vscode.postMessage({ command: `deleteField`, recordFormat, fieldName });
}

function sendDeleteFields(recordFormat, fieldNames) {
  if (!editsAllowed()) {
    return;
  }
  vscode.postMessage({ command: `deleteFields`, recordFormat, fieldNames });
}

function sendFieldUpdate(recordFormat, originalFieldName, newFieldInfo) {
  if (!editsAllowed()) {
    return;
  }
  vscode.postMessage({
    command: `updateField`,
    recordFormat,
    originalFieldName,
    fieldInfo: newFieldInfo
  });
}

function sendFieldsUpdate(recordFormat, updates) {
  if (!editsAllowed()) {
    return;
  }
  vscode.postMessage({
    command: `updateFields`,
    recordFormat,
    updates
  });
}

function sendFormatHeaderUpdate(recordFormat, newKeywords) {
  if (!editsAllowed()) {
    return;
  }
  vscode.postMessage({
    command: `updateFormat`,
    recordFormat,
    newKeywords
  });
}

function openDesignPalette() {
  if (!editsAllowed()) {
    const sidebar = document.getElementById(`fieldInfoSidebar`);
    if (sidebar) {
      sidebar.innerHTML = connectionConnected
        ? `<div style="padding:1em;opacity:0.7">Preview mode (read-only)</div>`
        : `<div style="padding:1em;opacity:0.7">Disconnected — editing unavailable</div>`;
    }
    return;
  }
  const existingNames = (activeDocument?.formats || [])
    .map((f) => f.name)
    .filter((n) => n && n !== GLOBAL_RECORD_FORMAT);
  showFieldPalette(
    (field) => sendNewField(lastSelectedFormat, field),
    {
      existingNames,
      onCreateRecord: (request) => sendNewFormats(request.formats, request.selectFormat),
      onBrowseDatabase: () => {
        vscode.postMessage({ command: `browseDatabaseFields` });
      },
    }
  );
}

function sendNewFormats(formats, selectFormat) {
  if (!editsAllowed()) {
    return;
  }
  if (selectFormat) {
    lastSelectedFormat = selectFormat;
  }
  vscode.postMessage({
    command: `newFormats`,
    formats,
    selectFormat,
  });
}

/**
 * Handle host response after browsing database fields.
 * @param {{
 *   library: string,
 *   file: string,
 *   recordFormat: string,
 *   fields: Array<{ name: string, type: string, length: number, decimals: number, heading?: string }>,
 *   error?: string,
 * }} payload
 */
export function handleDatabaseFieldsResult(payload) {
  if (!editsAllowed() || !lastSelectedFormat) {
    return;
  }
  if (payload.error) {
    showHostError(payload.error);
    return;
  }
  if (!payload.fields?.length) {
    showHostError(`No fields returned.`);
    return;
  }

  const sidebar = document.getElementById(`fieldInfoSidebar`);
  if (!sidebar) {
    return;
  }
  sidebar.innerHTML = ``;
  const heading = document.createElement(`div`);
  heading.className = `palette-heading`;
  heading.innerText = `Place database fields`;
  sidebar.appendChild(heading);
  const hint = document.createElement(`div`);
  hint.className = `palette-hint`;
  hint.innerText = `${payload.library}/${payload.file} — select fields, usage, and heading placement.`;
  sidebar.appendChild(hint);

  const usageSelect = document.createElement(`select`);
  usageSelect.className = `prop-select`;
  usageSelect.style.margin = `0.5em 1em`;
  usageSelect.style.width = `calc(100% - 2em)`;
  for (const [v, l] of [[`both`, `Both (B)`], [`input`, `Input (I)`], [`output`, `Output (O)`]]) {
    const o = document.createElement(`option`);
    o.value = v;
    o.textContent = l;
    usageSelect.appendChild(o);
  }
  sidebar.appendChild(usageSelect);

  const placeSelect = document.createElement(`select`);
  placeSelect.className = `prop-select`;
  placeSelect.style.margin = `0 1em 0.5em`;
  placeSelect.style.width = `calc(100% - 2em)`;
  for (const [v, l] of [
    [`none`, `Field only`],
    [`left`, `Heading left (SDA &L)`],
    [`above`, `Heading above (SDA &C)`],
  ]) {
    const o = document.createElement(`option`);
    o.value = v;
    o.textContent = l;
    placeSelect.appendChild(o);
  }
  sidebar.appendChild(placeSelect);

  /** @type {Set<string>} */
  const picked = new Set();
  const list = document.createElement(`div`);
  list.className = `db-field-list`;
  for (const f of payload.fields) {
    const row = document.createElement(`label`);
    row.className = `db-field-row`;
    const cb = document.createElement(`input`);
    cb.type = `checkbox`;
    cb.value = f.name;
    cb.onchange = () => {
      if (cb.checked) {
        picked.add(f.name);
      } else {
        picked.delete(f.name);
      }
    };
    row.appendChild(cb);
    row.appendChild(document.createTextNode(` ${f.name}  ${f.type}(${f.length}${f.decimals ? `,${f.decimals}` : ``})`));
    list.appendChild(row);
  }
  sidebar.appendChild(list);

  const actions = document.createElement(`div`);
  actions.className = `palette-actions`;
  const cancel = document.createElement(`vscode-button`);
  cancel.setAttribute(`secondary`, `true`);
  cancel.innerText = `Cancel`;
  cancel.onclick = () => openDesignPalette();
  const place = document.createElement(`vscode-button`);
  place.setAttribute(`icon`, `add`);
  place.innerText = `Place selected`;
  place.onclick = () => {
    const selected = payload.fields.filter((f) => picked.has(f.name));
    if (!selected.length) {
      return;
    }
    let row = 2;
    let col = 2;
    /** @type {any[]} */
    const fields = [];
    const reffldSuffix = payload.library && payload.file
      ? ` ${payload.library}/${payload.file}`
      : ``;
    for (const f of selected) {
      const usage = /** @type {any} */ (usageSelect.value) || `both`;
      if (placeSelect.value === `left` && f.heading) {
        const label = String(f.heading).split(/\s+/).filter(Boolean).join(` `) || f.name;
        fields.push({
          value: `${label}:`,
          displayType: `const`,
          length: Math.min(30, label.length + 1),
          decimals: 0,
          position: { x: col, y: row },
          keywords: [],
          conditions: [],
        });
        col += Math.min(30, label.length + 3);
      } else if (placeSelect.value === `above` && f.heading) {
        const label = String(f.heading).split(/\s+/).filter(Boolean).join(` `) || f.name;
        fields.push({
          value: label,
          displayType: `const`,
          length: Math.min(30, label.length),
          decimals: 0,
          position: { x: col, y: row },
          keywords: [],
          conditions: [],
        });
        row += 1;
      }

      fields.push({
        name: f.name.substring(0, 10),
        type: `R`,
        isReference: true,
        reference: `${f.name}${reffldSuffix}`.trim(),
        length: f.length,
        decimals: f.decimals || 0,
        displayType: usage,
        primitiveType: `char`,
        position: { x: col, y: row },
        keywords: [
          { name: `REFFLD`, value: `${f.name}${reffldSuffix}`.trim(), conditions: [] },
        ],
        conditions: [],
        startRange: 0,
      });

      col = 2;
      row += placeSelect.value === `above` ? 2 : 1;
      if (row > (renderRows - 1)) {
        break;
      }
    }

    vscode.postMessage({
      command: `placeDatabaseFields`,
      recordFormat: lastSelectedFormat,
      fields,
    });
  };
  actions.appendChild(cancel);
  actions.appendChild(place);
  sidebar.appendChild(actions);
}
