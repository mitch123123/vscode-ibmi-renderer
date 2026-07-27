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
 * @param {HTMLElement} container
 */
export function renderIndicatorPanel(container) {
  container.innerHTML = ``;

  const title = document.createElement(`div`);
  title.style.padding = `0.5em`;
  title.style.fontWeight = `bold`;
  title.innerText = `Indicators`;
  container.appendChild(title);

  const grid = document.createElement(`div`);
  grid.className = `indicator-grid`;
  grid.style.display = `grid`;
  grid.style.gridTemplateColumns = `repeat(5, 1fr)`;
  grid.style.gap = `2px`;
  grid.style.padding = `0.5em`;
  grid.style.maxHeight = `200px`;
  grid.style.overflowY = `auto`;

  for (let i = 1; i <= 99; i++) {
    const label = document.createElement(`label`);
    label.style.fontSize = `11px`;
    label.style.display = `flex`;
    label.style.alignItems = `center`;
    label.style.gap = `2px`;
    label.title = `Indicator ${i}`;

    const cb = document.createElement(`input`);
    cb.type = `checkbox`;
    cb.checked = activeIndicators.has(i);
    cb.addEventListener(`change`, () => {
      setIndicator(i, cb.checked);
    });

    const span = document.createElement(`span`);
    span.innerText = String(i).padStart(2, `0`);

    label.appendChild(cb);
    label.appendChild(span);
    grid.appendChild(label);
  }

  container.appendChild(grid);

  const clearBtn = document.createElement(`vscode-button`);
  clearBtn.setAttribute(`secondary`, `true`);
  clearBtn.innerText = `Clear all`;
  clearBtn.style.margin = `0.5em`;
  clearBtn.style.display = `block`;
  clearBtn.addEventListener(`click`, () => {
    activeIndicators = new Set();
    renderIndicatorPanel(container);
    if (onChange) {
      onChange();
    }
  });
  container.appendChild(clearBtn);
}
