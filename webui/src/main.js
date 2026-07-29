import { loadDDS, setupTabsHandler, setupKeyboard, setEditorMode, setScreenSize, refreshCanvas, getEditorMode, setConnectionConnected, requestShowSource, handleDatabaseFieldsResult } from "./renderer.js";
import { setIndicatorChangeHandler } from "./indicators.js";
import { resolveHostDialog } from "./hostDialogs.js";
import { announce } from "./a11y.js";

setIndicatorChangeHandler(() => refreshCanvas());

window.addEventListener("message", (event) => {
  const command = event.data.command;
  const docType = event.data.documentType || `dds.dspf`;
  switch (command) {
    case `load`:
      loadDDS(event.data.dds, docType, true, { restoreSelection: false });
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
      break;
    case `requestInputResult`:
      resolveHostDialog(event.data.requestId, event.data.value);
      break;
    case `requestConfirmResult`:
      resolveHostDialog(event.data.requestId, event.data.confirmed === true);
      break;
  }
});

window.onload = () => {
  setupTabsHandler();
  setupKeyboard();
  setupToolbar();
  setupSidebarToggles();
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
  const modeBtn = document.getElementById(`modeToggle`);
  if (modeBtn) {
    modeBtn.innerText = `Switch to Preview`;
    modeBtn.addEventListener(`click`, () => {
      const next = getEditorMode() === `design` ? `preview` : `design`;
      setEditorMode(next);
    });
  }

  const sourceBtn = document.getElementById(`showSourceBtn`);
  if (sourceBtn) {
    sourceBtn.addEventListener(`click`, () => requestShowSource());
  }

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
