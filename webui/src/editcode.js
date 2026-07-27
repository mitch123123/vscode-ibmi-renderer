/**
 * Format a sample value for EDTCDE / EDTWRD preview.
 * @param {number} length
 * @param {number} decimals
 * @param {string} [edtcde]
 * @param {string} [edtwrd]
 */
export function formatEditCode(length, decimals, edtcde, edtwrd) {
  if (edtwrd) {
    // EDTWRD: replace digit placeholders with sample digits
    let digit = 1;
    return edtwrd.replace(/[0-9]/g, () => String((digit++) % 10));
  }

  if (!edtcde) {
    return undefined;
  }

  const code = edtcde.trim().toUpperCase().replace(/['"]/g, ``).split(/\s+/)[0];
  const intDigits = Math.max(1, (length || 7) - (decimals || 0));
  let intPart = ``;
  for (let i = 0; i < intDigits; i++) {
    intPart += String((i + 1) % 10);
  }
  // Use a readable sample rather than all digits for long fields
  if (intDigits > 4) {
    intPart = `1234`.padStart(Math.min(intDigits, 6), `0`).slice(-Math.min(intDigits, 6));
  }

  let frac = ``;
  if (decimals > 0) {
    frac = `.`;
    for (let i = 0; i < decimals; i++) {
      frac += String((i + 5) % 10);
    }
  }

  switch (code) {
    case `1`:
    case `2`:
    case `J`:
    case `K`:
    case `N`:
    case `O`: {
      // Comma-separated with optional trailing sign
      const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, `,`);
      const signed = (code === `J` || code === `K` || code === `N` || code === `O`) ? `-` : ``;
      return `${withCommas}${frac}${signed}`;
    }
    case `3`:
    case `4`:
      return `${intPart}${frac}`;
    case `A`:
    case `B`:
      return `${intPart}${frac}CR`;
    case `C`:
    case `D`:
      return `${intPart}${frac}-`;
    case `Y`:
      return `mm/dd/yy`;
    case `Z`:
      return intPart.replace(/^0+/, ``) || `0`;
    default:
      return `${intPart}${frac}`;
  }
}
