import { loadDDS, setupTabsHandler, setupKeyboard, setEditorMode, setScreenSize, refreshCanvas, setConnectionConnected, handleDatabaseFieldsResult, selectRecordFormat, flushPendingEdits } from "./renderer.js";
import { setIndicatorChangeHandler } from "./indicators.js";
import { resolveHostDialog } from "./hostDialogs.js";
import { clearFieldEditController } from "./fieldEditGuard.js";
import { announce } from "./a11y.js";

setIndicatorChangeHandler(() => refreshCanvas());

const LAYOUT_STORAGE_KEY = `mitchellfiedler.dspfDesigner.layout`;
const MIN_SIDE_WIDTH = 180;
const MAX_SIDE_WIDTH = 480;
const MIN_BOTTOM_HEIGHT = 120;
const DEFAULT_LEFT_WIDTH = 240;
const DEFAULT_RIGHT_WIDTH = 280;
const DEFAULT_BOTTOM_HEIGHT = 240;

/** @type {'side'|'bottom'} */
let fieldsDock = `side`;
let leftWidth = DEFAULT_LEFT_WIDTH;
let rightWidth = DEFAULT_RIGHT_WIDTH;
let bottomHeight = DEFAULT_BOTTOM_HEIGHT;

window.addEventListener("message", (event) => {
  const command = event.data.command;
  const docType = event.data.documentType || `dds.dspf`;
  switch (command) {
    case `load`:
      loadDDS(event.data.dds, docType, true, {
        restoreSelection: false,
        selectFormat: event.data.selectFormat,
      });
      break;
    case `update`:
      // Rebuild canvas but restore field selection after drag/nudge
      loadDDS(event.data.dds, docType, true, { restoreSelection: true });
      break;
    case `connectionStatus`:
      setConnectionConnected(event.data.connected !== false);
      break;
    case `databaseFields`:
      handleDatabaseFieldsResult(event.data);
      break;
    case `editFailed`:
      announce(event.data.reason || `Edit failed`);
      clearFieldEditController();
      break;
    case `requestInputResult`:
      resolveHostDialog(event.data.requestId, event.data.value);
      break;
    case `requestConfirmResult`:
      resolveHostDialog(event.data.requestId, event.data.confirmed === true);
      break;
    case `requestSaveDiscardResult`:
      resolveHostDialog(event.data.requestId, event.data.choice || `cancel`);
      break;
    case `selectFormat`:
      selectRecordFormat(event.data.recordFormat);
      break;
    case `flushPendingEdits`:
      flushPendingEdits();
      break;
  }
});

window.addEventListener(`pagehide`, () => {
  flushPendingEdits();
});
document.addEventListener(`visibilitychange`, () => {
  if (document.visibilityState === `hidden`) {
    flushPendingEdits();
  }
});

window.onload = () => {
  setupTabsHandler();
  setupKeyboard();
  setupToolbar();
  setupSidebarToggles();
  setupPanelLayout();
};

/**
 * @param {'left'|'right'} side
 * @param {boolean} collapsed
 */
function setSidebarCollapsed(side, collapsed) {
  const sidebar = document.getElementById(side === `left` ? `leftSidebar` : `rightSidebar`);
  const rail = document.getElementById(side === `left` ? `expandLeftSidebar` : `expandRightSidebar`);
  if (sidebar) {
    sidebar.classList.toggle(`collapsed`, collapsed);
  }
  if (rail) {
    rail.hidden = !collapsed;
  }
  syncSplitterVisibility();
}

function setupSidebarToggles() {
  document.getElementById(`collapseLeftSidebar`)?.addEventListener(`click`, () => {
    setSidebarCollapsed(`left`, true);
  });
  document.getElementById(`expandLeftSidebar`)?.addEventListener(`click`, () => {
    setSidebarCollapsed(`left`, false);
  });
  document.getElementById(`collapseRightSidebar`)?.addEventListener(`click`, () => {
    setSidebarCollapsed(`right`, true);
  });
  document.getElementById(`expandRightSidebar`)?.addEventListener(`click`, () => {
    setSidebarCollapsed(`right`, false);
  });
}

function setupToolbar() {
  document.getElementById(`modeDesign`)?.addEventListener(`click`, () => {
    void setEditorMode(`design`);
  });
  document.getElementById(`modePreview`)?.addEventListener(`click`, () => {
    void setEditorMode(`preview`);
  });

  const sizeSelect = document.getElementById(`screenSizeSelect`);
  if (sizeSelect) {
    sizeSelect.addEventListener(`change`, () => {
      const val = sizeSelect.value;
      if (val === `auto`) {
        setScreenSize(undefined, undefined);
      } else if (val === `ds3`) {
        setScreenSize(80, 24);
      } else if (val === `ds4`) {
        setScreenSize(132, 27);
      }
    });
  }
}

function setupPanelLayout() {
  loadLayoutPrefs();
  applyLayoutSizes();
  applyFieldsDock(fieldsDock, false);

  document.getElementById(`dockFieldsSide`)?.addEventListener(`click`, () => {
    applyFieldsDock(`side`, true);
  });
  document.getElementById(`dockFieldsBottom`)?.addEventListener(`click`, () => {
    applyFieldsDock(`bottom`, true);
  });

  setupSplitterDrag(`leftSplitter`, `left`);
  setupSplitterDrag(`rightSplitter`, `right`);
  setupSplitterDrag(`bottomSplitter`, `bottom`);
}

function loadLayoutPrefs() {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed.fieldsDock === `side` || parsed.fieldsDock === `bottom`) {
      fieldsDock = parsed.fieldsDock;
    }
    if (Number.isFinite(parsed.leftWidth)) {
      leftWidth = clamp(parsed.leftWidth, MIN_SIDE_WIDTH, MAX_SIDE_WIDTH);
    }
    if (Number.isFinite(parsed.rightWidth)) {
      rightWidth = clamp(parsed.rightWidth, MIN_SIDE_WIDTH, MAX_SIDE_WIDTH);
    }
    if (Number.isFinite(parsed.bottomHeight)) {
      bottomHeight = Math.max(MIN_BOTTOM_HEIGHT, parsed.bottomHeight);
    }
  } catch {
    // ignore corrupt prefs
  }
}

function saveLayoutPrefs() {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({
      fieldsDock,
      leftWidth,
      rightWidth,
      bottomHeight,
    }));
  } catch {
    // ignore quota / private mode
  }
}

function applyLayoutSizes() {
  const layout = document.getElementById(`appLayout`);
  if (!layout) {
    return;
  }
  layout.style.setProperty(`--left-sidebar-width`, `${leftWidth}px`);
  layout.style.setProperty(`--right-sidebar-width`, `${rightWidth}px`);
  layout.style.setProperty(`--fields-panel-height`, `${bottomHeight}px`);
}

/**
 * @param {'side'|'bottom'} dock
 * @param {boolean} persist
 */
function applyFieldsDock(dock, persist) {
  fieldsDock = dock;
  const layout = document.getElementById(`appLayout`);
  const layoutCenter = document.getElementById(`layoutCenter`);
  const bottomSlot = document.getElementById(`fieldsBottomSlot`);
  const bottomSplitter = document.getElementById(`bottomSplitter`);
  const rightSplitter = document.getElementById(`rightSplitter`);
  const rightSidebar = document.getElementById(`rightSidebar`);
  const expandRight = document.getElementById(`expandRightSidebar`);
  const sideBtn = document.getElementById(`dockFieldsSide`);
  const bottomBtn = document.getElementById(`dockFieldsBottom`);
  if (!layout || !layoutCenter || !bottomSlot || !rightSidebar || !expandRight) {
    return;
  }
  layout.dataset.fieldsDock = dock;
  if (dock === `bottom`) {
    bottomSlot.hidden = false;
    if (bottomSplitter) {
      bottomSplitter.hidden = false;
    }
    if (rightSplitter) {
      rightSplitter.hidden = true;
    }
    bottomSlot.appendChild(expandRight);
    bottomSlot.appendChild(rightSidebar);
  } else {
    if (bottomSplitter) {
      bottomSplitter.hidden = true;
    }
    if (rightSplitter) {
      rightSplitter.hidden = false;
    }
    if (rightSplitter?.parentElement === layout) {
      layout.insertBefore(expandRight, rightSplitter.nextSibling);
      layout.insertBefore(rightSidebar, expandRight.nextSibling);
    } else {
      layout.appendChild(expandRight);
      layout.appendChild(rightSidebar);
    }
    bottomSlot.hidden = true;
  }
  if (sideBtn) {
    sideBtn.classList.toggle(`active`, dock === `side`);
    sideBtn.setAttribute(`aria-pressed`, dock === `side` ? `true` : `false`);
  }
  if (bottomBtn) {
    bottomBtn.classList.toggle(`active`, dock === `bottom`);
    bottomBtn.setAttribute(`aria-pressed`, dock === `bottom` ? `true` : `false`);
  }
  syncSplitterVisibility();
  applyLayoutSizes();
  if (persist) {
    saveLayoutPrefs();
  }
}

function syncSplitterVisibility() {
  const leftSidebar = document.getElementById(`leftSidebar`);
  const rightSidebar = document.getElementById(`rightSidebar`);
  const leftSplitter = document.getElementById(`leftSplitter`);
  const rightSplitter = document.getElementById(`rightSplitter`);
  const bottomSplitter = document.getElementById(`bottomSplitter`);
  const leftCollapsed = leftSidebar?.classList.contains(`collapsed`);
  const rightCollapsed = rightSidebar?.classList.contains(`collapsed`);
  if (leftSplitter) {
    leftSplitter.hidden = !!leftCollapsed;
  }
  if (fieldsDock === `side`) {
    if (rightSplitter) {
      rightSplitter.hidden = !!rightCollapsed;
    }
    if (bottomSplitter) {
      bottomSplitter.hidden = true;
    }
  } else {
    if (rightSplitter) {
      rightSplitter.hidden = true;
    }
    if (bottomSplitter) {
      bottomSplitter.hidden = !!rightCollapsed;
    }
  }
}

/**
 * @param {string} splitterId
 * @param {'left'|'right'|'bottom'} kind
 */
function setupSplitterDrag(splitterId, kind) {
  const splitter = document.getElementById(splitterId);
  const layout = document.getElementById(`appLayout`);
  if (!splitter || !layout) {
    return;
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   */
  const startDrag = (clientX, clientY) => {
    const startX = clientX;
    const startY = clientY;
    const startLeft = leftWidth;
    const startRight = rightWidth;
    const startBottom = bottomHeight;
    layout.classList.add(`resizing`);
    layout.classList.add(kind === `bottom` ? `resizing-row` : `resizing-col`);
    splitter.classList.add(`active`);

    /** @param {PointerEvent} ev */
    const onMove = (ev) => {
      if (kind === `left`) {
        leftWidth = clamp(startLeft + (ev.clientX - startX), MIN_SIDE_WIDTH, MAX_SIDE_WIDTH);
      } else if (kind === `right`) {
        rightWidth = clamp(startRight - (ev.clientX - startX), MIN_SIDE_WIDTH, MAX_SIDE_WIDTH);
      } else {
        const layoutRect = layout.getBoundingClientRect();
        const maxBottom = Math.max(MIN_BOTTOM_HEIGHT, Math.floor(layoutRect.height * 0.7));
        bottomHeight = clamp(startBottom - (ev.clientY - startY), MIN_BOTTOM_HEIGHT, maxBottom);
      }
      applyLayoutSizes();
    };

    const onUp = () => {
      window.removeEventListener(`pointermove`, onMove);
      window.removeEventListener(`pointerup`, onUp);
      layout.classList.remove(`resizing`, `resizing-row`, `resizing-col`);
      splitter.classList.remove(`active`);
      saveLayoutPrefs();
    };

    window.addEventListener(`pointermove`, onMove);
    window.addEventListener(`pointerup`, onUp);
  };

  splitter.addEventListener(`pointerdown`, (ev) => {
    if (ev.button !== 0) {
      return;
    }
    ev.preventDefault();
    startDrag(ev.clientX, ev.clientY);
  });

  splitter.addEventListener(`keydown`, (ev) => {
    const step = ev.shiftKey ? 24 : 8;
    let changed = false;
    if (kind === `left`) {
      if (ev.key === `ArrowLeft`) {
        leftWidth = clamp(leftWidth - step, MIN_SIDE_WIDTH, MAX_SIDE_WIDTH);
        changed = true;
      } else if (ev.key === `ArrowRight`) {
        leftWidth = clamp(leftWidth + step, MIN_SIDE_WIDTH, MAX_SIDE_WIDTH);
        changed = true;
      }
    } else if (kind === `right`) {
      if (ev.key === `ArrowLeft`) {
        rightWidth = clamp(rightWidth + step, MIN_SIDE_WIDTH, MAX_SIDE_WIDTH);
        changed = true;
      } else if (ev.key === `ArrowRight`) {
        rightWidth = clamp(rightWidth - step, MIN_SIDE_WIDTH, MAX_SIDE_WIDTH);
        changed = true;
      }
    } else if (kind === `bottom`) {
      if (ev.key === `ArrowUp`) {
        bottomHeight = Math.max(MIN_BOTTOM_HEIGHT, bottomHeight + step);
        changed = true;
      } else if (ev.key === `ArrowDown`) {
        bottomHeight = Math.max(MIN_BOTTOM_HEIGHT, bottomHeight - step);
        changed = true;
      }
    }
    if (changed) {
      ev.preventDefault();
      applyLayoutSizes();
      saveLayoutPrefs();
    }
  });
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
