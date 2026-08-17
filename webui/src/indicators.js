/**
 * Indicator toggle panel (01–99).
 */

/** @type {Set<number>} */
export let activeIndicators = new Set();

/** @type {(() => void) | undefined} */
let onChange;

/**
 * @param {() => void} cb
 */
export function setIndicatorChangeHandler(cb) {
  onChange = cb;
}

/**
 * @param {number} indicator
 * @param {boolean} on
 */
export function setIndicator(indicator, on) {
  if (on) {
    activeIndicators.add(indicator);
  } else {
    activeIndicators.delete(indicator);
  }
  if (onChange) {
    onChange();
  }
}

/**
 * Clear all runtime indicator checks.
 */
export function clearAllIndicators() {
  activeIndicators = new Set();
  if (onChange) {
    onChange();
  }
}

/**
 * @param {HTMLButtonElement} chip
 * @param {number} indicator
 * @param {boolean} on
 */
function syncChip(chip, indicator, on) {
  chip.classList.toggle(`active`, on);
  chip.setAttribute(`aria-pressed`, on ? `true` : `false`);
  chip.title = `Indicator ${String(indicator).padStart(2, `0`)}`;
}

/**
 * @param {HTMLElement} container
 */
export function renderIndicatorPanel(container) {
  container.innerHTML = ``;

  const grid = document.createElement(`div`);
  grid.className = `indicator-grid`;

  for (let i = 1; i <= 99; i++) {
    const chip = document.createElement(`button`);
    chip.type = `button`;
    chip.className = `indicator-chip`;
    chip.textContent = String(i).padStart(2, `0`);
    const on = activeIndicators.has(i);
    syncChip(chip, i, on);
    chip.addEventListener(`click`, () => {
      const next = !activeIndicators.has(i);
      setIndicator(i, next);
      syncChip(chip, i, next);
    });
    grid.appendChild(chip);
  }

  container.appendChild(grid);

  const clearBtn = document.createElement(`vscode-button`);
  clearBtn.setAttribute(`secondary`, `true`);
  clearBtn.className = `indicator-clear`;
  clearBtn.innerText = `Clear all`;
  clearBtn.addEventListener(`click`, () => {
    activeIndicators = new Set();
    renderIndicatorPanel(container);
    if (onChange) {
      onChange();
    }
  });
  container.appendChild(clearBtn);
}
