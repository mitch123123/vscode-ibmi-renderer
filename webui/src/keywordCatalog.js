/**
 * Common IBM i DDS display-file keywords and parameter values.
 * Scoped by level: file / format / field.
 * Sources: IBM i DDS reference (COLOR, DSPATR, CHECK, EDTCDE, DATFMT, etc.).
 *
 * `description` is shown in the keyword picker and editor help text.
 * Keep blurbs short (one line). Full reference: docs/DDS_KEYWORDS.md
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
  { name: `DSPSIZ`, levels: [`file`], valueMode: `select`, options: DSPSIZ_OPTIONS, group: `File`, description: `Display size (*DS3 24×80 or *DS4 27×132)` },
  { name: `INDARA`, levels: [`file`], valueMode: `none`, group: `File`, description: `Pass indicators in a separate indicator area` },
  { name: `PRINT`, levels: [`file`, `format`], valueMode: `none`, group: `File`, description: `Enable Print key for this file/record` },
  { name: `HELP`, levels: [`file`, `format`], valueMode: `text`, placeholder: `xx`, group: `Response`, description: `Enable Help key; optional response indicator` },
  { name: `HLPRTN`, levels: [`file`], valueMode: `none`, group: `File`, description: `Return to application after Help is used` },
  { name: `MSGLOC`, levels: [`file`], valueMode: `text`, placeholder: `row`, group: `File`, description: `Row where ERRMSG / status messages appear` },
  { name: `INVITE`, levels: [`file`, `format`], valueMode: `none`, group: `File`, description: `Invite device for read; used with multiple devices` },
  { name: `ALWGPH`, levels: [`file`], valueMode: `none`, group: `File`, description: `Allow graphics on the display` },
  { name: `ALWROL`, levels: [`file`], valueMode: `none`, group: `File`, description: `Allow roll/page keys to roll the display` },
  { name: `CSRINPONLY`, levels: [`file`, `format`], valueMode: `none`, group: `File`, description: `Cursor moves only among input-capable fields` },
  { name: `CSRLOC`, levels: [`file`, `format`], valueMode: `text`, placeholder: `row-field col-field`, group: `File`, description: `Program sets cursor row/column via named fields` },
  { name: `DSPMOD`, levels: [`file`], valueMode: `select`, options: [opt(`*DS3`), opt(`*DS4`)], group: `File`, description: `Switch display mode (*DS3 / *DS4)` },
  { name: `ERRSFL`, levels: [`file`], valueMode: `none`, group: `File`, description: `Show ERRMSG/ERRMSGID messages in an error subfile` },
  { name: `KEEP`, levels: [`file`, `format`], valueMode: `none`, group: `General`, description: `Keep display contents when the file is closed` },
  { name: `LOCK`, levels: [`file`, `format`], valueMode: `select`, options: LOCK_OPTIONS, group: `File`, description: `Keep keyboard locked after output; optional *ONLY` },
  { name: `OPENPRT`, levels: [`file`], valueMode: `none`, group: `File`, description: `Open the printer file used by PRINT` },
  { name: `PASSRCD`, levels: [`file`], valueMode: `text`, placeholder: `record-format`, group: `File`, description: `Record format passed between shared open files` },
  { name: `REF`, levels: [`file`], valueMode: `text`, placeholder: `lib/file`, group: `File`, description: `Default database/reference file for REFFLD` },
  { name: `USRDFN`, levels: [`file`, `format`], valueMode: `none`, group: `File`, description: `User-defined data stream (no DDS layout)` },
  { name: `WDWBORDER`, levels: [`file`, `format`], valueMode: `text`, placeholder: `*COLOR BLU *DSPATR RI`, group: `Window`, description: `Default window border color/attributes` },
  { name: `CHGINPDFT`, levels: [`file`, `format`, `field`], valueMode: `multi`, options: CHECK_OPTIONS, group: `Display`, description: `Change default input keyboard attributes` },

  // —— Format / record — General ——
  { name: `OVERLAY`, levels: [`format`], valueMode: `none`, group: `General`, description: `Write without clearing other records on the display` },
  { name: `PUTOVR`, levels: [`format`], valueMode: `none`, group: `General`, description: `Allow OVRATR/OVRDTA to override displayed fields` },
  { name: `OVRATR`, levels: [`format`, `field`], valueMode: `none`, group: `General`, description: `Override display attributes only (with PUTOVR)` },
  { name: `OVRDTA`, levels: [`format`, `field`], valueMode: `none`, group: `General`, description: `Override field data only (with PUTOVR)` },
  { name: `PROTECT`, levels: [`format`], valueMode: `none`, group: `General`, description: `Protect all input fields already on the display` },
  { name: `CLRL`, levels: [`format`], valueMode: `select`, options: [opt(`*NO`), opt(`*END`), opt(`*ALL`), ...Array.from({ length: 27 }, (_, i) => opt(String(i + 1)))], group: `General`, description: `Clear lines before display (*NO, *END, *ALL, or line #)` },
  { name: `SLNO`, levels: [`format`], valueMode: `text`, placeholder: `nn`, group: `General`, description: `Starting line number for this record` },
  { name: `ASSUME`, levels: [`format`], valueMode: `none`, group: `General`, description: `Assume record is already on the display at open` },
  { name: `FRCDTA`, levels: [`format`], valueMode: `none`, group: `General`, description: `Force immediate display without waiting for next I/O` },
  { name: `BLANKS`, levels: [`format`, `field`], valueMode: `none`, group: `General`, description: `Set response indicator when field is all blanks` },
  { name: `CHANGE`, levels: [`format`, `field`], valueMode: `text`, placeholder: `response-indicator`, group: `General`, description: `Set response indicator when data changes` },
  { name: `INZRRN`, levels: [`format`], valueMode: `none`, group: `General`, description: `Initialize subfile relative record number to 1` },
  { name: `RTNCSRLOC`, levels: [`format`], valueMode: `text`, placeholder: `rec field`, group: `General`, description: `Return cursor location (record and/or field names)` },
  { name: `USRRSTDSP`, levels: [`format`], valueMode: `none`, group: `General`, description: `User-restored display (app restores after help/etc.)` },

  // —— Response ——
  { name: `ROLLUP`, levels: [`format`], valueMode: `text`, placeholder: `xx [response]`, group: `Response`, description: `Roll Up key response indicator` },
  { name: `ROLLDOWN`, levels: [`format`], valueMode: `text`, placeholder: `xx [response]`, group: `Response`, description: `Roll Down key response indicator` },
  { name: `PAGEDOWN`, levels: [`format`], valueMode: `text`, placeholder: `xx [response]`, group: `Response`, description: `Page Down key response indicator` },
  { name: `PAGEUP`, levels: [`format`], valueMode: `text`, placeholder: `xx [response]`, group: `Response`, description: `Page Up key response indicator` },
  { name: `HOME`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Response`, description: `Home key response indicator` },
  { name: `CLEAR`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Response`, description: `Clear key response indicator` },
  { name: `CA01`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Attention key (no data returned)` },
  { name: `CA02`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Attention key (no data returned)` },
  { name: `CA03`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Attention key (no data returned)` },
  { name: `CA12`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Attention key (no data returned)` },
  { name: `CF01`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF02`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF03`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF04`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF05`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF06`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF07`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF08`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF09`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF10`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF11`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF12`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF13`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF14`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF15`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF16`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF17`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF18`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF19`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF20`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF21`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF22`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF23`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `CF24`, levels: [`format`], valueMode: `text`, placeholder: `xx ['text']`, group: `Response`, description: `Command Function key (returns field data)` },
  { name: `ALARM`, levels: [`format`], valueMode: `none`, group: `Response`, description: `Sound audible alarm when record is displayed` },
  { name: `SETOF`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Response`, description: `Set off response indicators on output` },
  { name: `RETKEY`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Response`, description: `Set indicator when Record Advance / Enter pressed` },
  { name: `RETPAGE`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Response`, description: `Set indicator when Page key pressed` },
  { name: `VLDCMDKEY`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Response`, description: `Set indicator when a valid command key is pressed` },

  // —— Window ——
  { name: `WINDOW`, levels: [`format`], valueMode: `text`, placeholder: `startrow startcol rows cols`, group: `Window`, description: `Define window position and size on the display` },
  { name: `WDWTITLE`, levels: [`format`], valueMode: `text`, placeholder: `*TEXT 'Title' *COLOR BLU`, group: `Window`, description: `Window title text, color, and placement` },

  // —— Subfile ——
  { name: `SFL`, levels: [`format`], valueMode: `none`, group: `Subfile`, description: `Identify this record as a subfile record format` },
  { name: `SFLCTL`, levels: [`format`], valueMode: `text`, placeholder: `subfile-record-name`, group: `Subfile`, description: `Subfile control record; names the SFL record` },
  { name: `SFLDSP`, levels: [`format`], valueMode: `none`, group: `Subfile`, description: `Display the subfile records` },
  { name: `SFLDSPCTL`, levels: [`format`], valueMode: `none`, group: `Subfile`, description: `Display the subfile control record` },
  { name: `SFLCLR`, levels: [`format`], valueMode: `none`, group: `Subfile`, description: `Clear all records from the subfile` },
  { name: `SFLINZ`, levels: [`format`], valueMode: `none`, group: `Subfile`, description: `Initialize subfile with blank/default records` },
  { name: `SFLEND`, levels: [`format`], valueMode: `select`, options: [opt(``), opt(`*MORE`), opt(`*SCRBAR`)], group: `Subfile`, description: `Show end-of-subfile / More… / scrollbar` },
  { name: `SFLPAG`, levels: [`format`], valueMode: `text`, placeholder: `page-size`, group: `Subfile`, description: `Number of subfile records per displayed page` },
  { name: `SFLSIZ`, levels: [`format`], valueMode: `text`, placeholder: `size`, group: `Subfile`, description: `Total subfile size (records in memory)` },
  { name: `SFLMSG`, levels: [`format`, `field`], valueMode: `text`, placeholder: `msg-id [lib/msgf]`, group: `Subfile`, description: `Subfile message text (constant or msg file)` },
  { name: `SFLMSGID`, levels: [`format`, `field`], valueMode: `text`, placeholder: `msg-id [lib/msgf]`, group: `Subfile`, description: `Subfile message from a message file` },
  { name: `SFLMSGRCD`, levels: [`format`], valueMode: `text`, placeholder: `line`, group: `Subfile`, description: `Message subfile record; line for first message` },
  { name: `SFLMSGKEY`, levels: [`field`], valueMode: `none`, group: `Subfile`, description: `Message key field for a message subfile` },
  { name: `SFLNXTCHG`, levels: [`format`], valueMode: `none`, group: `Subfile`, description: `Mark next changed records for READC` },
  { name: `SFLRCDNBR`, levels: [`format`], valueMode: `select`, options: [opt(``), opt(`*TOP`), opt(`CURSOR`)], group: `Subfile`, description: `Subfile record number field / display position` },
  { name: `SFLROLVAL`, levels: [`format`], valueMode: `text`, group: `Subfile`, description: `Number of records to roll for roll keys` },
  { name: `SFLDROP`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Subfile`, description: `Fold/truncate mode; key to drop folded lines` },
  { name: `SFLFOLD`, levels: [`format`], valueMode: `text`, placeholder: `xx`, group: `Subfile`, description: `Display folded (wrapped) subfile records` },
  { name: `SFLENTER`, levels: [`format`], valueMode: `none`, group: `Subfile`, description: `Enter key selects subfile record (selection list)` },

  // —— Field — Display ——
  { name: `COLOR`, levels: [`field`], valueMode: `select`, options: COLOR_OPTIONS, group: `Display`, description: `Field color on a color display (GRN, WHT, RED, …)` },
  { name: `DSPATR`, levels: [`field`], valueMode: `multi`, options: DSPATR_OPTIONS, group: `Display`, description: `Display attributes (HI, UL, RI, ND, PR, …)` },
  { name: `ENTFLDATR`, levels: [`field`], valueMode: `text`, placeholder: `*COLOR BLU *DSPATR HI`, group: `Display`, description: `Attributes while the cursor is in this entry field` },

  // —— Field — Editing ——
  { name: `EDTCDE`, levels: [`field`], valueMode: `select`, options: EDTCDE_OPTIONS, group: `Editing`, description: `Edit code for numeric output formatting` },
  { name: `EDTWRD`, levels: [`field`], valueMode: `text`, placeholder: `'   /   /  '`, group: `Editing`, description: `Custom edit word for numeric/date formatting` },
  { name: `DATFMT`, levels: [`field`], valueMode: `select`, options: DATFMT_OPTIONS, group: `Editing`, description: `Date format (*ISO, *USA, *MDY, …)` },
  { name: `DATSEP`, levels: [`field`], valueMode: `select`, options: DATSEP_OPTIONS, group: `Editing`, description: `Date separator character` },
  { name: `TIMFMT`, levels: [`field`], valueMode: `select`, options: TIMFMT_OPTIONS, group: `Editing`, description: `Time format (*ISO, *HMS, *USA, …)` },
  { name: `TIMSEP`, levels: [`field`], valueMode: `select`, options: TIMSEP_OPTIONS, group: `Editing`, description: `Time separator character` },
  { name: `FLTFIXDEC`, levels: [`field`], valueMode: `none`, group: `Editing`, description: `Display floating-point as fixed decimal` },
  { name: `FLTPCN`, levels: [`field`], valueMode: `select`, options: [opt(`*SINGLE`), opt(`*DOUBLE`)], group: `Editing`, description: `Floating-point precision (*SINGLE / *DOUBLE)` },

  // —— Field — Validity ——
  { name: `CHECK`, levels: [`field`], valueMode: `multi`, options: CHECK_OPTIONS, group: `Validity`, description: `Input check / keyboard control (ME, MF, RB, LC, …)` },
  { name: `COMP`, levels: [`field`], valueMode: `text`, placeholder: `EQ 'value'`, group: `Validity`, description: `Compare entered value (EQ, NE, GT, LT, …)` },
  { name: `RANGE`, levels: [`field`], valueMode: `text`, placeholder: `low high`, group: `Validity`, description: `Valid inclusive low–high range` },
  { name: `VALUES`, levels: [`field`], valueMode: `text`, placeholder: `'A' 'B' 'C'`, group: `Validity`, description: `List of allowed values` },
  { name: `MAPVAL`, levels: [`field`], valueMode: `text`, placeholder: `(*BLANK 0)`, options: MAPVAL_COMMON, group: `Validity`, description: `Map special values (*BLANK, *ZERO, …)` },
  { name: `ERRMSG`, levels: [`field`], valueMode: `text`, placeholder: `'message' [xx]`, group: `Validity`, description: `Error message text when indicator is on` },
  { name: `ERRMSGID`, levels: [`field`], valueMode: `text`, placeholder: `msg-id [lib/msgf] [xx]`, group: `Validity`, description: `Error message ID from a message file` },

  // —— Field — General ——
  { name: `DATE`, levels: [`field`], valueMode: `none`, group: `General`, description: `System date constant field` },
  { name: `TIME`, levels: [`field`], valueMode: `none`, group: `General`, description: `System time constant field` },
  { name: `SYSNAME`, levels: [`field`], valueMode: `none`, group: `General`, description: `System name constant field` },
  { name: `USER`, levels: [`field`], valueMode: `none`, group: `General`, description: `User profile name constant field` },
  { name: `MSGID`, levels: [`field`], valueMode: `text`, placeholder: `msg-id [lib/msgf]`, group: `General`, description: `Message constant from a message file` },
  { name: `DFT`, levels: [`field`], valueMode: `text`, placeholder: `'default'`, group: `General`, description: `Default value shown until the user changes it` },
  { name: `DFTVAL`, levels: [`field`], valueMode: `text`, placeholder: `'default'`, group: `General`, description: `Default value returned if the field is blank` },
  { name: `REFFLD`, levels: [`field`], valueMode: `text`, placeholder: `field-name [lib/file]`, group: `General`, description: `Reference another field’s attributes` },
  { name: `REFSHIFT`, levels: [`field`], valueMode: `select`, options: [opt(`*NUM`), opt(`*STD`), opt(`*ALPHA`), opt(`*KATA`), opt(`*HIRAG`), opt(`*HEX`)], group: `General`, description: `Keyboard shift for referenced field` },
  { name: `LOWER`, levels: [`field`], valueMode: `none`, group: `General`, description: `Allow lowercase entry (same as CHECK LC)` },
  { name: `AUTO`, levels: [`field`], valueMode: `multi`, options: [opt(`RAB`), opt(`RAZ`), opt(`RA`), opt(`FE`)], group: `General`, description: `Auto functions (right-adjust, field exit, …)` },
  { name: `DUP`, levels: [`field`], valueMode: `none`, group: `General`, description: `Allow Dup key to duplicate field data` },
  { name: `PUTRETAIN`, levels: [`field`], valueMode: `none`, group: `General`, description: `Retain displayed data on subsequent outputs` },
  { name: `INZINP`, levels: [`field`], valueMode: `none`, group: `General`, description: `Initialize input fields without always sending data` },
  { name: `NOCCSID`, levels: [`field`], valueMode: `none`, group: `General`, description: `Do not convert field data with CCSID` },
  { name: `PMTCTL`, levels: [`field`], valueMode: `text`, group: `General`, description: `Prompt control condition for conditional prompts` },
  { name: `TEXT`, levels: [`file`, `format`, `field`], valueMode: `text`, placeholder: `'description'`, group: `General`, description: `Descriptive text for the file, record, or field` },
  { name: `ALIAS`, levels: [`field`], valueMode: `text`, placeholder: `alias-name`, group: `General`, description: `Alternative (long) name for high-level languages` },
  { name: `HTML`, levels: [`field`], valueMode: `text`, placeholder: `'html content'`, group: `General`, description: `HTML content associated with the field` },
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
        description: prefix === `CA`
          ? `Command Attention key (no data returned)`
          : `Command Function key (returns field data)`,
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
