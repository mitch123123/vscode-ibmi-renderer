/**
 * Common IBM i DDS display-file keywords and parameter values.
 * Scoped by level: file / format / field.
 * Sources: IBM i DDS reference (COLOR, DSPATR, CHECK, EDTCDE, DATFMT, etc.).
 */

/** @typedef {'file'|'format'|'field'} KeywordLevel */
/** @typedef {'none'|'text'|'select'|'multi'} ValueMode */
/**
 * @typedef {{
 *   name: string,
 *   label?: string,
 *   levels: KeywordLevel[],
 *   valueMode: ValueMode,
 *   group?: string,
 *   options?: Array<{ value: string, label: string }>,
 *   placeholder?: string,
 *   description?: string,
 * }} KeywordDef
 */

/** @param {string} value @param {string} [label] */
const opt = (value, label) => ({ value, label: label || value });

/** Preferred group display order (unknown groups sort after these, A–Z). */
const GROUP_ORDER = [
  `File`,
  `General`,
  `Display`,
  `Editing`,
  `Validity`,
  `Subfile`,
  `Window`,
  `Response`,
];

export const COLOR_OPTIONS = [
  opt(`GRN`, `GRN — Green (default)`),
  opt(`WHT`, `WHT — White`),
  opt(`RED`, `RED — Red`),
  opt(`TRQ`, `TRQ — Turquoise`),
  opt(`YLW`, `YLW — Yellow`),
  opt(`PNK`, `PNK — Pink`),
  opt(`BLU`, `BLU — Blue`),
];

export const DSPATR_OPTIONS = [
  opt(`BL`, `BL — Blinking`),
  opt(`CS`, `CS — Column separator`),
  opt(`HI`, `HI — High intensity`),
  opt(`ND`, `ND — Non-display`),
  opt(`PC`, `PC — Position cursor`),
  opt(`RI`, `RI — Reverse image`),
  opt(`UL`, `UL — Underline`),
  opt(`MDT`, `MDT — Set MDT (input)`),
  opt(`OID`, `OID — Operator ID (input)`),
  opt(`PR`, `PR — Protect (input)`),
  opt(`SP`, `SP — Light pen select (input)`),
];

export const CHECK_OPTIONS = [
  opt(`AB`, `AB — Allow blanks`),
  opt(`ME`, `ME — Mandatory enter`),
  opt(`MF`, `MF — Mandatory fill`),
  opt(`M10`, `M10 — Modulus 10`),
  opt(`M10F`, `M10F — Modulus 10 (IBM)`),
  opt(`M11`, `M11 — Modulus 11`),
  opt(`M11F`, `M11F — Modulus 11 (IBM)`),
  opt(`VN`, `VN — Name check`),
  opt(`VNE`, `VNE — Extended name check`),
  opt(`ER`, `ER — Auto enter`),
  opt(`FE`, `FE — Field exit required`),
  opt(`LC`, `LC — Lowercase allowed`),
  opt(`RB`, `RB — Right-adjust blank fill`),
  opt(`RZ`, `RZ — Right-adjust zero fill`),
  opt(`RL`, `RL — Right-to-left`),
  opt(`RLTB`, `RLTB — Right-to-left tab`),
];

export const EDTCDE_OPTIONS = [
  opt(`1`, `1 — Commas, no sign`),
  opt(`2`, `2 — Commas, leading zero`),
  opt(`3`, `3 — No commas, no sign`),
  opt(`4`, `4 — No commas, leading zero`),
  opt(`A`, `A — Commas + CR`),
  opt(`B`, `B — Commas + CR (leading 0)`),
  opt(`C`, `C — Commas + trailing -`),
  opt(`D`, `D — Commas + trailing - (leading 0)`),
  opt(`J`, `J — Commas + trailing -`),
  opt(`K`, `K — Commas + trailing - (leading 0)`),
  opt(`N`, `N — Commas + leading -`),
  opt(`O`, `O — Commas + leading - (leading 0)`),
  opt(`Y`, `Y — Date edit`),
  opt(`Z`, `Z — Suppress leading zeros`),
  opt(`5`, `5 — User-defined QEDIT5`),
  opt(`6`, `6 — User-defined QEDIT6`),
  opt(`7`, `7 — User-defined QEDIT7`),
  opt(`8`, `8 — User-defined QEDIT8`),
  opt(`9`, `9 — User-defined QEDIT9`),
];

export const DATFMT_OPTIONS = [
  opt(`*JOB`, `*JOB`),
  opt(`*MDY`, `*MDY`),
  opt(`*DMY`, `*DMY`),
  opt(`*YMD`, `*YMD`),
  opt(`*JUL`, `*JUL`),
  opt(`*ISO`, `*ISO`),
  opt(`*USA`, `*USA`),
  opt(`*EUR`, `*EUR`),
  opt(`*JIS`, `*JIS`),
];

export const TIMFMT_OPTIONS = [
  opt(`*JOB`, `*JOB`),
  opt(`*HMS`, `*HMS`),
  opt(`*ISO`, `*ISO`),
  opt(`*USA`, `*USA`),
  opt(`*EUR`, `*EUR`),
  opt(`*JIS`, `*JIS`),
];

export const DATSEP_OPTIONS = [
  opt(`*JOB`, `*JOB`),
  opt(`/`, `/`),
  opt(`-`, `-`),
  opt(`.`, `.`),
  opt(`,`, `,`),
  opt(`&`, `& (blank)`),
];

export const TIMSEP_OPTIONS = [
  opt(`*JOB`, `*JOB`),
  opt(`:`, `:`),
  opt(`.`, `.`),
  opt(`,`, `,`),
  opt(`&`, `& (blank)`),
];

export const DSPSIZ_OPTIONS = [
  opt(`*DS3`, `*DS3 — 24 × 80`),
  opt(`*DS4`, `*DS4 — 27 × 132`),
  opt(`24 80`, `24 80`),
  opt(`27 132`, `27 132`),
];

export const MAPVAL_COMMON = [
  opt(`*BLANK`, `*BLANK`),
  opt(`*ZERO`, `*ZERO`),
  opt(`*HIVAL`, `*HIVAL`),
  opt(`*LOVAL`, `*LOVAL`),
];

export const LOCK_OPTIONS = [
  opt(``, `(none)`),
  opt(`*ONLY`, `*ONLY`),
];

/** @type {KeywordDef[]} */
export const KEYWORD_CATALOG = [
  // —— File ——
  { name: `DSPSIZ`, levels: [`file`], valueMode: `select`, options: DSPSIZ_OPTIONS, group: `File`, description: `Display size` },
  { name: `INDARA`, levels: [`file`], valueMode: `none`, group: `File`, description: `Indicator area` },
  { name: `PRINT`, levels: [`file`, `format`], valueMode: `none`, group: `File` },
  { name: `HELP`, levels: [`file`, `format`], valueMode: `text`, placeholder: `xx`, group: `Response`, description: `Help key / response` },
  { name: `HLPRTN`, levels: [`file`], valueMode: `none`, group: `File` },
  { name: `MSGLOC`, levels: [`file`], valueMode: `text`, placeholder: `row`, group: `File` },
  { name: `INVITE`, levels: [`file`, `format`], valueMode: `none`, group: `File` },
  { name: `ALWGPH`, levels: [`file`], valueMode: `none`, group: `File` },
  { name: `ALWROL`, levels: [`file`], valueMode: `none`, group: `File` },
  { name: `CSRINPONLY`, levels: [`file`, `format`], valueMode: `none`, group: `File`, description: `Cursor in input fields only` },
  { name: `CSRLOC`, levels: [`file`, `format`], valueMode: `text`, placeholder: `row-field col-field`, group: `File` },
  { name: `DSPMOD`, levels: [`file`], valueMode: `select`, options: [opt(`*DS3`), opt(`*DS4`)], group: `File` },
  { name: `ERRSFL`, levels: [`file`], valueMode: `none`, group: `File` },
  { name: `KEEP`, levels: [`file`, `format`], valueMode: `none`, group: `General` },
  { name: `LOCK`, levels: [`file`, `format`], valueMode: `select`, options: LOCK_OPTIONS, group: `File`, description: `Lock keyboard; optional *ONLY` },
  { name: `OPENPRT`, levels: [`file`], valueMode: `none`, group: `File` },
  { name: `PASSRCD`, levels: [`file`], valueMode: `text`, placeholder: `record-format`, group: `File` },
  { name: `REF`, levels: [`file`], valueMode: `text`, placeholder: `lib/file`, group: `File` },
  { name: `USRDFN`, levels: [`file`, `format`], valueMode: `none`, group: `File`, description: `User-defined record` },
  { name: `WDWBORDER`, levels: [`file`, `format`], valueMode: `text`, placeholder: `*COLOR BLU *DSPATR RI`, group: `Window` },
  { name: `CHGINPDFT`, levels: [`file`, `format`, `field`], valueMode: `multi`, options: CHECK_OPTIONS, group: `Display`, description: `Default input attributes` },

  // —— Format / record — General ——
  { name: `OVERLAY`, levels: [`format`], valueMode: `none`, group: `General` },
  { name: `PUTOVR`, levels: [`format`], valueMode: `none`, group: `General` },
  { name: `OVRATR`, levels: [`format`, `field`], valueMode: `none`, group: `General` },
  { name: `OVRDTA`, levels: [`format`, `field`], valueMode: `none`, group: `General` },
  { name: `PROTECT`, levels: [`format`], valueMode: `none`, group: `General` },
  { name: `CLRL`, levels: [`format`], valueMode: `select`, options: [opt(`*NO`), opt(`*END`), opt(`*ALL`), ...Array.from({ length: 27 }, (_, i) => opt(String(i + 1)))], group: `General` },
  { name: `SLNO`, levels: [`format`], valueMode: `text`, placeholder: `nn`, group: `General`, description: `Starting line number` },
  { name: `ASSUME`, levels: [`format`], valueMode: `none`, group: `General` },
  { name: `FRCDTA`, levels: [`format`], valueMode: `none`, group: `General` },
  { name: `BLANKS`, levels: [`format`, `field`], valueMode: `none`, group: `General` },
  { name: `CHANGE`, levels: [`format`, `field`], valueMode: `text`, placeholder: `response-indicator`, group: `General` },
  { name: `INZRRN`, levels: [`format`], valueMode: `none`, group: `General` },
  { name: `RTNCSRLOC`, levels: [`format`], valueMode: `text`, placeholder: `rec field`, group: `General` },
  { name: `USRRSTDSP`, levels: [`format`], valueMode: `none`, group: `General` },

  // —— Response ——
  { name: `ROLLUP`, levels: [`format`], valueMode: `text`, placeholder: `xx [response]`, group: `Response` },
  { name: `ROLLDOWN`, levels: [`format`], valueMode: `text`, placeholder: `xx [response]`, group: `Response` },
  { name: `PAGEDOWN`, levels: [`format`], valueMode: `text`, placeholder: `xx [response]`, group: `Response` },
  { name: `PAGEUP`, levels: [`format`], valueMode: `text`, placeholder: `xx [response]`, group: `Response` },
  { name: `HOME`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Response` },
  { name: `CLEAR`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Response` },
  { name: `CA01`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CA02`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CA03`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CA12`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF01`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF02`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF03`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF04`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF05`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF06`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF07`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF08`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF09`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF10`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF11`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF12`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF13`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF14`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF15`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF16`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF17`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF18`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF19`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF20`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF21`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF22`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF23`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `CF24`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response` },
  { name: `ALARM`, levels: [`format`], valueMode: `none`, group: `Response` },
  { name: `SETOF`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Response` },
  { name: `RETKEY`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Response` },
  { name: `RETPAGE`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Response` },
  { name: `VLDCMDKEY`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Response` },

  // —— Window ——
  { name: `WINDOW`, levels: [`format`], valueMode: `text`, placeholder: `startrow startcol rows cols`, group: `Window` },
  { name: `WDWTITLE`, levels: [`format`], valueMode: `text`, placeholder: `*TEXT 'Title' *COLOR BLU`, group: `Window` },

  // —— Subfile ——
  { name: `SFL`, levels: [`format`], valueMode: `none`, group: `Subfile`, description: `Subfile record` },
  { name: `SFLCTL`, levels: [`format`], valueMode: `text`, placeholder: `subfile-record-name`, group: `Subfile` },
  { name: `SFLDSP`, levels: [`format`], valueMode: `none`, group: `Subfile` },
  { name: `SFLDSPCTL`, levels: [`format`], valueMode: `none`, group: `Subfile` },
  { name: `SFLCLR`, levels: [`format`], valueMode: `none`, group: `Subfile` },
  { name: `SFLINZ`, levels: [`format`], valueMode: `none`, group: `Subfile` },
  { name: `SFLEND`, levels: [`format`], valueMode: `select`, options: [opt(``), opt(`*MORE`), opt(`*SCRBAR`)], group: `Subfile` },
  { name: `SFLPAG`, levels: [`format`], valueMode: `text`, placeholder: `page-size`, group: `Subfile` },
  { name: `SFLSIZ`, levels: [`format`], valueMode: `text`, placeholder: `size`, group: `Subfile` },
  { name: `SFLMSG`, levels: [`format`, `field`], valueMode: `text`, placeholder: `msg-id [lib/msgf]`, group: `Subfile` },
  { name: `SFLMSGID`, levels: [`format`, `field`], valueMode: `text`, placeholder: `msg-id [lib/msgf]`, group: `Subfile` },
  { name: `SFLMSGRCD`, levels: [`format`], valueMode: `text`, placeholder: `line`, group: `Subfile`, description: `Message subfile record` },
  { name: `SFLMSGKEY`, levels: [`field`], valueMode: `none`, group: `Subfile`, description: `Message key field` },
  { name: `SFLNXTCHG`, levels: [`format`], valueMode: `none`, group: `Subfile` },
  { name: `SFLRCDNBR`, levels: [`format`], valueMode: `select`, options: [opt(``), opt(`*TOP`), opt(`CURSOR`)], group: `Subfile` },
  { name: `SFLROLVAL`, levels: [`format`], valueMode: `text`, group: `Subfile` },
  { name: `SFLDROP`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Subfile` },
  { name: `SFLFOLD`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Subfile` },
  { name: `SFLENTER`, levels: [`format`], valueMode: `none`, group: `Subfile` },

  // —— Field — Display ——
  { name: `COLOR`, levels: [`field`], valueMode: `select`, options: COLOR_OPTIONS, group: `Display` },
  { name: `DSPATR`, levels: [`field`], valueMode: `multi`, options: DSPATR_OPTIONS, group: `Display`, description: `One or more attributes (BL = blink)` },
  { name: `ENTFLDATR`, levels: [`field`], valueMode: `text`, placeholder: `*COLOR BLU *DSPATR HI`, group: `Display` },

  // —— Field — Editing ——
  { name: `EDTCDE`, levels: [`field`], valueMode: `select`, options: EDTCDE_OPTIONS, group: `Editing` },
  { name: `EDTWRD`, levels: [`field`], valueMode: `text`, placeholder: `'   /   /  '`, group: `Editing` },
  { name: `DATFMT`, levels: [`field`], valueMode: `select`, options: DATFMT_OPTIONS, group: `Editing` },
  { name: `DATSEP`, levels: [`field`], valueMode: `select`, options: DATSEP_OPTIONS, group: `Editing` },
  { name: `TIMFMT`, levels: [`field`], valueMode: `select`, options: TIMFMT_OPTIONS, group: `Editing` },
  { name: `TIMSEP`, levels: [`field`], valueMode: `select`, options: TIMSEP_OPTIONS, group: `Editing` },
  { name: `FLTFIXDEC`, levels: [`field`], valueMode: `none`, group: `Editing` },
  { name: `FLTPCN`, levels: [`field`], valueMode: `select`, options: [opt(`*SINGLE`), opt(`*DOUBLE`)], group: `Editing` },

  // —— Field — Validity ——
  { name: `CHECK`, levels: [`field`], valueMode: `multi`, options: CHECK_OPTIONS, group: `Validity` },
  { name: `COMP`, levels: [`field`], valueMode: `text`, placeholder: `EQ 'value'`, group: `Validity` },
  { name: `RANGE`, levels: [`field`], valueMode: `text`, placeholder: `low high`, group: `Validity` },
  { name: `VALUES`, levels: [`field`], valueMode: `text`, placeholder: `'A' 'B' 'C'`, group: `Validity` },
  { name: `MAPVAL`, levels: [`field`], valueMode: `text`, placeholder: `(*BLANK 0)`, options: MAPVAL_COMMON, group: `Validity` },
  { name: `ERRMSG`, levels: [`field`], valueMode: `text`, placeholder: `'message' [xx]`, group: `Validity` },
  { name: `ERRMSGID`, levels: [`field`], valueMode: `text`, placeholder: `msg-id [lib/msgf] [xx]`, group: `Validity` },

  // —— Field — General ——
  { name: `DATE`, levels: [`field`], valueMode: `none`, group: `General` },
  { name: `TIME`, levels: [`field`], valueMode: `none`, group: `General` },
  { name: `SYSNAME`, levels: [`field`], valueMode: `none`, group: `General` },
  { name: `USER`, levels: [`field`], valueMode: `none`, group: `General` },
  { name: `MSGID`, levels: [`field`], valueMode: `text`, placeholder: `msg-id [lib/msgf]`, group: `General` },
  { name: `DFT`, levels: [`field`], valueMode: `text`, placeholder: `'default'`, group: `General` },
  { name: `DFTVAL`, levels: [`field`], valueMode: `text`, placeholder: `'default'`, group: `General` },
  { name: `REFFLD`, levels: [`field`], valueMode: `text`, placeholder: `field-name [lib/file]`, group: `General` },
  { name: `REFSHIFT`, levels: [`field`], valueMode: `select`, options: [opt(`*NUM`), opt(`*STD`), opt(`*ALPHA`), opt(`*KATA`), opt(`*HIRAG`), opt(`*HEX`)], group: `General` },
  { name: `LOWER`, levels: [`field`], valueMode: `none`, group: `General` },
  { name: `AUTO`, levels: [`field`], valueMode: `multi`, options: [opt(`RAB`), opt(`RAZ`), opt(`RA`), opt(`FE`)], group: `General` },
  { name: `DUP`, levels: [`field`], valueMode: `none`, group: `General` },
  { name: `PUTRETAIN`, levels: [`field`], valueMode: `none`, group: `General` },
  { name: `INZINP`, levels: [`field`], valueMode: `none`, group: `General` },
  { name: `NOCCSID`, levels: [`field`], valueMode: `none`, group: `General` },
  { name: `PMTCTL`, levels: [`field`], valueMode: `text`, group: `General` },
  { name: `TEXT`, levels: [`file`, `format`, `field`], valueMode: `text`, placeholder: `'description'`, group: `General` },
  { name: `ALIAS`, levels: [`field`], valueMode: `text`, placeholder: `alias-name`, group: `General` },
  { name: `HTML`, levels: [`field`], valueMode: `text`, placeholder: `'html content'`, group: `General`, description: `HTML data for the field` },
];

// Expand CA/CF 01-24 if not already listed individually for catalog search
for (let i = 1; i <= 24; i++) {
  const n = String(i).padStart(2, `0`);
  for (const prefix of [`CA`, `CF`]) {
    const name = `${prefix}${n}`;
    if (!KEYWORD_CATALOG.some((k) => k.name === name)) {
      KEYWORD_CATALOG.push({
        name,
        levels: [`format`],
        valueMode: `text`,
        placeholder: `xx ['text']`,
        group: `Response`,
      });
    }
  }
}

/**
 * @param {KeywordLevel} level
 * @returns {KeywordDef[]}
 */
export function keywordsForLevel(level) {
  const seen = new Set();
  return KEYWORD_CATALOG
    .filter((k) => k.levels.includes(level))
    .filter((k) => {
      if (seen.has(k.name)) {
        return false;
      }
      seen.add(k.name);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {string} name
 * @param {KeywordLevel} [level]
 * @returns {KeywordDef|undefined}
 */
export function findKeywordDef(name, level) {
  const upper = (name || ``).toUpperCase();
  return KEYWORD_CATALOG.find(
    (k) => k.name === upper && (!level || k.levels.includes(level))
  ) || KEYWORD_CATALOG.find((k) => k.name === upper);
}

/**
 * @param {KeywordLevel} level
 * @returns {{ value: string, label: string }[]}
 */
export function keywordNameOptions(level) {
  return [
    { value: ``, label: `(custom / type below)` },
    ...keywordsForLevel(level).map((k) => ({
      value: k.name,
      label: k.description ? `${k.name} — ${k.description}` : k.name,
    })),
  ];
}

/**
 * Grouped keyword name options for `<optgroup>` pickers.
 * Groups and options within each group are sorted.
 * @param {KeywordLevel} level
 * @returns {Array<{ group: string, options: Array<{ value: string, label: string }> }>}
 */
export function keywordNameOptionsGrouped(level) {
  /** @type {Map<string, Array<{ value: string, label: string }>>} */
  const byGroup = new Map();

  for (const k of keywordsForLevel(level)) {
    const group = k.group || `General`;
    if (!byGroup.has(group)) {
      byGroup.set(group, []);
    }
    byGroup.get(group).push({
      value: k.name,
      label: k.description ? `${k.name} — ${k.description}` : k.name,
    });
  }

  const groupRank = (name) => {
    const idx = GROUP_ORDER.indexOf(name);
    return idx >= 0 ? idx : GROUP_ORDER.length;
  };

  return [...byGroup.entries()]
    .sort(([a], [b]) => {
      const ra = groupRank(a);
      const rb = groupRank(b);
      if (ra !== rb) {
        return ra - rb;
      }
      return a.localeCompare(b);
    })
    .map(([group, options]) => ({
      group,
      options: options.sort((x, y) => x.value.localeCompare(y.value)),
    }));
}

/**
 * Non-blocking conflict / compatibility hints for a keyword list.
 * Does not treat CHECK(ME MF) as a conflict (valid combination).
 * @param {Array<{ name?: string, value?: string }>} keywords
 * @returns {string[]}
 */
export function keywordConflicts(keywords) {
  /** @type {string[]} */
  const warnings = [];
  const list = Array.isArray(keywords) ? keywords : [];
  const names = new Set(list.map((k) => String(k?.name || ``).toUpperCase()).filter(Boolean));

  const has = (name) => names.has(name);
  const valuesOf = (name) =>
    list
      .filter((k) => String(k?.name || ``).toUpperCase() === name)
      .map((k) => String(k?.value || ``).toUpperCase());

  if (has(`EDTCDE`) && has(`EDTWRD`)) {
    warnings.push(`EDTCDE and EDTWRD should not be used together on the same field.`);
  }

  if (has(`DFT`) && has(`DFTVAL`)) {
    warnings.push(`DFT and DFTVAL are usually alternatives; using both may be redundant.`);
  }

  if (has(`RANGE`) && has(`VALUES`)) {
    warnings.push(`RANGE and VALUES are usually alternatives for validity checking.`);
  }

  if (has(`COMP`) && (has(`RANGE`) || has(`VALUES`))) {
    warnings.push(`COMP with RANGE/VALUES may overlap; confirm intended validity rules.`);
  }

  for (const raw of valuesOf(`DSPATR`)) {
    const attrs = raw.trim().split(/[\s,]+/).filter(Boolean);
    if (attrs.includes(`ND`) && attrs.some((a) => a !== `ND` && a !== `PR` && a !== `MDT` && a !== `PC` && a !== `OID` && a !== `SP`)) {
      warnings.push(`DSPATR(ND) with other display attributes: non-display typically hides visual attributes (HI/UL/RI/BL/CS).`);
      break;
    }
  }

  // CHECK ME+MF is a valid combination — explicitly no warning.
  // Note only clearly conflicting CHECK pairs if present.
  for (const raw of valuesOf(`CHECK`)) {
    const checks = new Set(raw.trim().split(/[\s,]+/).filter(Boolean));
    if (checks.has(`RB`) && checks.has(`RZ`)) {
      warnings.push(`CHECK RB and RZ are mutually exclusive right-adjust fill options.`);
    }
    if (checks.has(`RL`) && checks.has(`RLTB`)) {
      warnings.push(`CHECK RL and RLTB are usually alternatives.`);
    }
  }

  if (has(`SFL`) && has(`SFLCTL`)) {
    warnings.push(`SFL and SFLCTL belong on different record formats (subfile vs control).`);
  }

  if (has(`SFLMSGRCD`) && has(`SFLCTL`)) {
    warnings.push(`SFLMSGRCD is for the message subfile record; SFLCTL belongs on the control record.`);
  }

  return warnings;
}
