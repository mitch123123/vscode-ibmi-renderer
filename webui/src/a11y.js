/**
 * Screen-reader announcements via a polite live region.
 * @param {string} message
 */
export function announce(message) {
  const el = document.getElementById(`srStatus`);
  if (!el) {
    return;
  }
  // Clear first so repeated identical messages are still announced.
  el.textContent = ``;
  // Defer so the clear is observed before the new text.
  requestAnimationFrame(() => {
    el.textContent = message || ``;
  });
}
