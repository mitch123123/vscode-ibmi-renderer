/**
 * Clamp a DDS field position into valid 1-based row/col bounds.
 * Pure / dependency-free so it can be unit-tested without Konva or renderer state.
 *
 * @param {number} x
 * @param {number} y
 * @param {{ maxX: number, maxY: number, wasY0?: boolean }} opts
 * @returns {{ x: number, y: number }}
 */
export function clampFieldPosition(x, y, opts) {
  const maxX = Math.max(1, opts.maxX || 1);
  const maxY = Math.max(1, opts.maxY || 1);
  let nextX = Math.min(Math.max(1, x), maxX);
  let nextY = Math.min(Math.max(1, y), maxY);
  if (opts.wasY0) {
    // Printer-style X-only / relative positioning: keep row blank (y === 0).
    nextY = 0;
  }
  return { x: nextX, y: nextY };
}
