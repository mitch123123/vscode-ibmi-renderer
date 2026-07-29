"use strict";
(() => {
  // webui/src/constants.js
  var colours = {
    RED: `red`,
    BLU: `#4287f5`,
    WHT: `#FFFFFF`,
    GRN: `green`,
    TRQ: `turquoise`,
    YLW: `yellow`,
    PNK: `pink`,
    BLK: `black`
  };
  var SELECTED_COLOUR = `#383838`;
  var PROTECT_COLOUR = `#666666`;
  var dateFormats = {
    "*MDY": `mm/dd/yyyy`,
    "*DMY": `dd/mm/yyyy`,
    "*YMD": `yyyy/mm/dd`,
    "*JUL": "yy/ddd",
    "*ISO": "yyyy-mm-dd",
    "*USA": "mm/dd/yyyy",
    "*EUR": "dd.mm.yyyy",
    "*JIS": "yyyy-mm-dd"
  };
  var timeFormats = {
    "*HMS": "hh:mm:ss",
    "*ISO": "hh.mm.ss",
    "*USA": "hh:mm am",
    "*EUR": "hh.mm.ss",
    "*JIS": "hh:mm:ss"
  };
  var GLOBAL_RECORD_FORMAT = `_GLOBAL`;
  var pxwPerChar = 8.45;
  var pxhPerLine = 20;
  var pxhPerChar = 12.5;
  var RULER_LEFT = 28;
  var RULER_TOP = 18;
  function snapToFixedGrid(x, y) {
    const newX = Math.round(x / pxwPerChar) * pxwPerChar;
    const newY = Math.round(y / pxhPerLine) * pxhPerLine;
    return { x: newX, y: newY };
  }
  function gridCordsToFieldCords(x, y) {
    return {
      x: Math.round(x / pxwPerChar) + 1,
      y: Math.round(y / pxhPerLine) + 1
    };
  }
  function widthInP(x) {
    return x * pxwPerChar;
  }
  function heightInP(x) {
    return x * pxhPerLine;
  }
  function parseParms(string) {
    if (!string) {
      return [];
    }
    let items = [];
    let inString = false;
    let current = ``;
    for (let i = 0; i < string.length; i++) {
      switch (string[i]) {
        case `'`:
          inString = !inString;
          break;
        case ` `:
          if (inString) {
            current += string[i];
          } else {
            items.push(current);
            current = ``;
          }
          break;
        default:
          current += string[i];
          break;
      }
    }
    if (current.trim().length > 0) {
      items.push(current.trim());
    }
    return items;
  }
  function conditionsPass(conditions, activeIndicators2) {
    if (!conditions || conditions.length === 0) {
      return true;
    }
    return conditions.every((c) => activeIndicators2.has(Number(c.indicator)) !== !!c.negate);
  }

  // webui/src/editcode.js
  function formatEditCode(length, decimals, edtcde, edtwrd) {
    if (edtwrd) {
      let digit = 1;
      return edtwrd.replace(/[0-9]/g, () => String(digit++ % 10));
    }
    if (!edtcde) {
      return void 0;
    }
    const code = edtcde.trim().toUpperCase().replace(/['"]/g, ``).split(/\s+/)[0];
    const intDigits = Math.max(1, (length || 7) - (decimals || 0));
    let intPart = ``;
    for (let i = 0; i < intDigits; i++) {
      intPart += String((i + 1) % 10);
    }
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
        const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, `,`);
        const signed = code === `J` || code === `K` || code === `N` || code === `O` ? `-` : ``;
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

  // webui/src/indicators.js
  var activeIndicators = /* @__PURE__ */ new Set();
  var onChange;
  function setIndicatorChangeHandler(cb) {
    onChange = cb;
  }
  function setIndicator(indicator, on) {
    if (on) {
      activeIndicators.add(indicator);
    } else {
      activeIndicators.delete(indicator);
    }
    if (onChange) {
      onChange();
    }
  }
  function clearAllIndicators() {
    activeIndicators = /* @__PURE__ */ new Set();
    if (onChange) {
      onChange();
    }
  }
  function renderIndicatorPanel(container) {
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
      activeIndicators = /* @__PURE__ */ new Set();
      renderIndicatorPanel(container);
      if (onChange) {
        onChange();
      }
    });
    container.appendChild(clearBtn);
  }

  // webui/src/keywordCatalog.js
  var opt = (value, label) => ({ value, label: label || value });
  var GROUP_ORDER = [
    `File`,
    `General`,
    `Display`,
    `Editing`,
    `Validity`,
    `Subfile`,
    `Window`,
    `Response`
  ];
  var COLOR_OPTIONS = [
    opt(`GRN`, `GRN \u2014 Green (default)`),
    opt(`WHT`, `WHT \u2014 White`),
    opt(`RED`, `RED \u2014 Red`),
    opt(`TRQ`, `TRQ \u2014 Turquoise`),
    opt(`YLW`, `YLW \u2014 Yellow`),
    opt(`PNK`, `PNK \u2014 Pink`),
    opt(`BLU`, `BLU \u2014 Blue`)
  ];
  var DSPATR_OPTIONS = [
    opt(`BL`, `BL \u2014 Blinking`),
    opt(`CS`, `CS \u2014 Column separator`),
    opt(`HI`, `HI \u2014 High intensity`),
    opt(`ND`, `ND \u2014 Non-display`),
    opt(`PC`, `PC \u2014 Position cursor`),
    opt(`RI`, `RI \u2014 Reverse image`),
    opt(`UL`, `UL \u2014 Underline`),
    opt(`MDT`, `MDT \u2014 Set MDT (input)`),
    opt(`OID`, `OID \u2014 Operator ID (input)`),
    opt(`PR`, `PR \u2014 Protect (input)`),
    opt(`SP`, `SP \u2014 Light pen select (input)`)
  ];
  var CHECK_OPTIONS = [
    opt(`AB`, `AB \u2014 Allow blanks`),
    opt(`ME`, `ME \u2014 Mandatory enter`),
    opt(`MF`, `MF \u2014 Mandatory fill`),
    opt(`M10`, `M10 \u2014 Modulus 10`),
    opt(`M10F`, `M10F \u2014 Modulus 10 (IBM)`),
    opt(`M11`, `M11 \u2014 Modulus 11`),
    opt(`M11F`, `M11F \u2014 Modulus 11 (IBM)`),
    opt(`VN`, `VN \u2014 Name check`),
    opt(`VNE`, `VNE \u2014 Extended name check`),
    opt(`ER`, `ER \u2014 Auto enter`),
    opt(`FE`, `FE \u2014 Field exit required`),
    opt(`LC`, `LC \u2014 Lowercase allowed`),
    opt(`RB`, `RB \u2014 Right-adjust blank fill`),
    opt(`RZ`, `RZ \u2014 Right-adjust zero fill`),
    opt(`RL`, `RL \u2014 Right-to-left`),
    opt(`RLTB`, `RLTB \u2014 Right-to-left tab`)
  ];
  var EDTCDE_OPTIONS = [
    opt(`1`, `1 \u2014 Commas, no sign`),
    opt(`2`, `2 \u2014 Commas, leading zero`),
    opt(`3`, `3 \u2014 No commas, no sign`),
    opt(`4`, `4 \u2014 No commas, leading zero`),
    opt(`A`, `A \u2014 Commas + CR`),
    opt(`B`, `B \u2014 Commas + CR (leading 0)`),
    opt(`C`, `C \u2014 Commas + trailing -`),
    opt(`D`, `D \u2014 Commas + trailing - (leading 0)`),
    opt(`J`, `J \u2014 Commas + trailing -`),
    opt(`K`, `K \u2014 Commas + trailing - (leading 0)`),
    opt(`N`, `N \u2014 Commas + leading -`),
    opt(`O`, `O \u2014 Commas + leading - (leading 0)`),
    opt(`Y`, `Y \u2014 Date edit`),
    opt(`Z`, `Z \u2014 Suppress leading zeros`),
    opt(`5`, `5 \u2014 User-defined QEDIT5`),
    opt(`6`, `6 \u2014 User-defined QEDIT6`),
    opt(`7`, `7 \u2014 User-defined QEDIT7`),
    opt(`8`, `8 \u2014 User-defined QEDIT8`),
    opt(`9`, `9 \u2014 User-defined QEDIT9`)
  ];
  var DATFMT_OPTIONS = [
    opt(`*JOB`, `*JOB`),
    opt(`*MDY`, `*MDY`),
    opt(`*DMY`, `*DMY`),
    opt(`*YMD`, `*YMD`),
    opt(`*JUL`, `*JUL`),
    opt(`*ISO`, `*ISO`),
    opt(`*USA`, `*USA`),
    opt(`*EUR`, `*EUR`),
    opt(`*JIS`, `*JIS`)
  ];
  var TIMFMT_OPTIONS = [
    opt(`*JOB`, `*JOB`),
    opt(`*HMS`, `*HMS`),
    opt(`*ISO`, `*ISO`),
    opt(`*USA`, `*USA`),
    opt(`*EUR`, `*EUR`),
    opt(`*JIS`, `*JIS`)
  ];
  var DATSEP_OPTIONS = [
    opt(`*JOB`, `*JOB`),
    opt(`/`, `/`),
    opt(`-`, `-`),
    opt(`.`, `.`),
    opt(`,`, `,`),
    opt(`&`, `& (blank)`)
  ];
  var TIMSEP_OPTIONS = [
    opt(`*JOB`, `*JOB`),
    opt(`:`, `:`),
    opt(`.`, `.`),
    opt(`,`, `,`),
    opt(`&`, `& (blank)`)
  ];
  var DSPSIZ_OPTIONS = [
    opt(`*DS3`, `*DS3 \u2014 24 \xD7 80`),
    opt(`*DS4`, `*DS4 \u2014 27 \xD7 132`),
    opt(`24 80`, `24 80`),
    opt(`27 132`, `27 132`)
  ];
  var MAPVAL_COMMON = [
    opt(`*BLANK`, `*BLANK`),
    opt(`*ZERO`, `*ZERO`),
    opt(`*HIVAL`, `*HIVAL`),
    opt(`*LOVAL`, `*LOVAL`)
  ];
  var LOCK_OPTIONS = [
    opt(``, `(none)`),
    opt(`*ONLY`, `*ONLY`)
  ];
  var KEYWORD_CATALOG = [
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
    { name: `HTML`, levels: [`field`], valueMode: `text`, placeholder: `'html content'`, group: `General`, description: `HTML data for the field` }
  ];
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
          group: `Response`
        });
      }
    }
  }
  function keywordsForLevel(level) {
    const seen = /* @__PURE__ */ new Set();
    return KEYWORD_CATALOG.filter((k) => k.levels.includes(level)).filter((k) => {
      if (seen.has(k.name)) {
        return false;
      }
      seen.add(k.name);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }
  function findKeywordDef(name, level) {
    const upper = (name || ``).toUpperCase();
    return KEYWORD_CATALOG.find(
      (k) => k.name === upper && (!level || k.levels.includes(level))
    ) || KEYWORD_CATALOG.find((k) => k.name === upper);
  }
  function keywordNameOptionsGrouped(level) {
    const byGroup = /* @__PURE__ */ new Map();
    for (const k of keywordsForLevel(level)) {
      const group = k.group || `General`;
      if (!byGroup.has(group)) {
        byGroup.set(group, []);
      }
      byGroup.get(group).push({
        value: k.name,
        label: k.description ? `${k.name} \u2014 ${k.description}` : k.name
      });
    }
    const groupRank = (name) => {
      const idx = GROUP_ORDER.indexOf(name);
      return idx >= 0 ? idx : GROUP_ORDER.length;
    };
    return [...byGroup.entries()].sort(([a], [b]) => {
      const ra = groupRank(a);
      const rb = groupRank(b);
      if (ra !== rb) {
        return ra - rb;
      }
      return a.localeCompare(b);
    }).map(([group, options]) => ({
      group,
      options: options.sort((x, y) => x.value.localeCompare(y.value))
    }));
  }
  function keywordConflicts(keywords) {
    const warnings = [];
    const list = Array.isArray(keywords) ? keywords : [];
    const names = new Set(list.map((k) => String(k?.name || ``).toUpperCase()).filter(Boolean));
    const has = (name) => names.has(name);
    const valuesOf = (name) => list.filter((k) => String(k?.name || ``).toUpperCase() === name).map((k) => String(k?.value || ``).toUpperCase());
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

  // webui/src/keywordEditor.js
  function createKeywordPanel(id, inputKeywords, onUpdate, level = `field`) {
    const keywords = JSON.parse(JSON.stringify(inputKeywords || []));
    const section = document.createElement(`div`);
    section.id = id;
    const tree = document.createElement(`vscode-tree`);
    tree.id = id + `-tree`;
    const actions = onUpdate ? [
      { icon: "edit", actionId: "edit", tooltip: "Edit" },
      { icon: "trash", actionId: "delete", tooltip: "Delete" }
    ] : [];
    const icons = {
      branch: "folder",
      leaf: "circle-filled",
      open: "folder-opened"
    };
    let conflictWarning = null;
    const refreshConflictWarnings = () => {
      if (!conflictWarning) {
        return;
      }
      const messages = keywordConflicts(keywords);
      if (messages.length === 0) {
        conflictWarning.style.display = `none`;
        conflictWarning.textContent = ``;
        return;
      }
      conflictWarning.style.display = `block`;
      conflictWarning.textContent = messages.join(` `);
    };
    const rerenderTree = () => {
      tree.data = keywords.map((keyword) => ({
        icons,
        label: keyword.name,
        value: keyword,
        description: keyword.value,
        actions,
        subItems: (keyword.conditions || []).map((c) => ({
          label: String(c.indicator),
          description: c.negate ? `Negated` : void 0,
          icons
        }))
      }));
      refreshConflictWarnings();
    };
    rerenderTree();
    tree.addEventListener("vsc-run-action", (event) => {
      const currentKeyword = event.detail.value;
      const oldKeywordIndex = keywords.findIndex((k) => k.name === currentKeyword.name && k.value === currentKeyword.value);
      switch (event.detail.actionId) {
        case `delete`:
          if (oldKeywordIndex >= 0) {
            keywords.splice(oldKeywordIndex, 1);
          }
          rerenderTree();
          break;
        case `edit`:
          editKeyword((newKeyword) => {
            if (oldKeywordIndex >= 0) {
              keywords[oldKeywordIndex] = newKeyword;
            } else {
              keywords.push(newKeyword);
            }
            clearKeywordEditor();
            rerenderTree();
          }, event.detail.value, level);
          break;
      }
    });
    section.appendChild(tree);
    if (onUpdate) {
      const newKeyword = document.createElement(`vscode-button`);
      newKeyword.setAttribute(`icon`, `add`);
      newKeyword.innerText = `New Keyword`;
      newKeyword.style.margin = `1em`;
      newKeyword.style.display = `block`;
      newKeyword.addEventListener(`click`, () => {
        editKeyword((kw) => {
          keywords.push(kw);
          clearKeywordEditor();
          rerenderTree();
        }, void 0, level);
      });
      conflictWarning = document.createElement(`div`);
      conflictWarning.className = `keyword-conflict-warning`;
      conflictWarning.style.display = `none`;
      conflictWarning.style.margin = `0 1em`;
      conflictWarning.style.padding = `0.5em 0.75em`;
      conflictWarning.style.fontSize = `12px`;
      conflictWarning.style.lineHeight = `1.35`;
      conflictWarning.style.border = `1px solid var(--vscode-inputValidation-warningBorder, #cca700)`;
      conflictWarning.style.background = `var(--vscode-inputValidation-warningBackground, rgba(204, 167, 0, 0.15))`;
      conflictWarning.style.color = `var(--vscode-inputValidation-warningForeground, inherit)`;
      conflictWarning.style.borderRadius = `2px`;
      const updateButton = document.createElement(`vscode-button`);
      updateButton.innerText = `Update`;
      updateButton.style.margin = `1em`;
      updateButton.style.display = `block`;
      updateButton.addEventListener(`click`, () => {
        refreshConflictWarnings();
        onUpdate(keywords);
      });
      section.appendChild(newKeyword);
      section.appendChild(conflictWarning);
      section.appendChild(updateButton);
      refreshConflictWarnings();
    }
    return section;
  }
  function createValuesPanel(id, properties, onUpdate) {
    const section = document.createElement(`div`);
    section.id = id;
    const createLabelCell = (label) => {
      const cell = document.createElement(`vscode-table-cell`);
      cell.innerText = label;
      return cell;
    };
    const createInputCell = (fieldId, value, labelText) => {
      const cell = document.createElement(`vscode-table-cell`);
      const input = document.createElement(`code`);
      input.id = fieldId;
      input.className = `prop-input`;
      input.dataset.propId = fieldId;
      input.innerText = value == null ? `` : String(value);
      input.setAttribute(`contenteditable`, `true`);
      input.setAttribute(`role`, `textbox`);
      input.setAttribute(`aria-label`, labelText || fieldId);
      cell.appendChild(input);
      return cell;
    };
    const createSelectCell = (fieldId, value, options) => {
      const cell = document.createElement(`vscode-table-cell`);
      const select = document.createElement(`select`);
      select.id = fieldId;
      select.className = `prop-select`;
      select.dataset.propId = fieldId;
      for (const opt2 of options) {
        const option = document.createElement(`option`);
        if (typeof opt2 === `string`) {
          option.value = opt2;
          option.textContent = opt2 === `` ? `(blank)` : opt2;
        } else {
          option.value = opt2.value;
          option.textContent = opt2.label;
        }
        if (option.value === String(value ?? ``)) {
          option.selected = true;
        }
        select.appendChild(option);
      }
      const current = String(value ?? ``);
      if (current && ![...select.options].some((o) => o.value === current)) {
        const option = document.createElement(`option`);
        option.value = current;
        option.textContent = current;
        option.selected = true;
        select.appendChild(option);
      }
      cell.appendChild(select);
      return cell;
    };
    const table = document.createElement(`vscode-table`);
    const tableBody = document.createElement(`vscode-table-body`);
    const hasEditableData = properties.some((prop) => prop.id !== void 0);
    for (let prop of properties) {
      const row = document.createElement(`vscode-table-row`);
      row.appendChild(createLabelCell(prop.label));
      if (prop.id && prop.options) {
        row.append(createSelectCell(prop.id, prop.value, prop.options));
      } else if (prop.id) {
        row.append(createInputCell(prop.id, prop.value, prop.label));
      } else {
        row.append(createLabelCell(String(prop.value ?? ``)));
      }
      tableBody.appendChild(row);
    }
    table.appendChild(tableBody);
    section.appendChild(table);
    if (hasEditableData) {
      const updateButton = document.createElement(`vscode-button`);
      updateButton.innerText = `Update`;
      updateButton.style.margin = `1em`;
      updateButton.style.display = `block`;
      updateButton.addEventListener(`click`, () => {
        const newProperties = {};
        section.querySelectorAll(`[data-prop-id]`).forEach((el) => {
          const propId = el.dataset.propId;
          if (!propId) {
            return;
          }
          if (el instanceof HTMLSelectElement) {
            newProperties[propId] = el.value;
          } else {
            newProperties[propId] = el.innerText;
          }
        });
        onUpdate(newProperties);
      });
      section.appendChild(updateButton);
    }
    return section;
  }
  function clearKeywordEditor() {
    const keywordEditorArea = document.getElementById(`keywordEditorArea`);
    if (keywordEditorArea) {
      keywordEditorArea.innerHTML = ``;
    }
  }
  function ensureRightSidebarVisible() {
    const sidebar = document.getElementById(`rightSidebar`);
    const rail = document.getElementById(`expandRightSidebar`);
    if (sidebar) {
      sidebar.classList.remove(`collapsed`);
    }
    if (rail) {
      rail.hidden = true;
    }
  }
  function editKeyword(onUpdate, keyword, level = `field`) {
    const group = document.createElement(`vscode-form-group`);
    group.id = `currentKeywordEditor`;
    group.setAttribute(`variant`, `vertical`);
    group.style.paddingLeft = `1em`;
    group.style.paddingRight = `1em`;
    const createLabel = (label, forId) => {
      const labelElement = document.createElement(`vscode-label`);
      labelElement.setAttribute(`for`, forId);
      labelElement.innerText = label;
      labelElement.style.marginTop = `0.5em`;
      return labelElement;
    };
    const createTextField = (id, value, placeholder) => {
      const input = document.createElement(`vscode-textfield`);
      input.setAttribute(`id`, id);
      input.setAttribute(`value`, value || ``);
      if (placeholder) {
        input.setAttribute(`placeholder`, placeholder);
      }
      return input;
    };
    const createNativeSelect = (id, options, selected) => {
      const select = document.createElement(`select`);
      select.id = id;
      select.className = `prop-select keyword-select`;
      for (const o of options) {
        const option = document.createElement(`option`);
        option.value = o.value;
        option.textContent = o.label;
        if (option.value === String(selected ?? ``)) {
          option.selected = true;
        }
        select.appendChild(option);
      }
      const current = String(selected ?? ``);
      if (current && ![...select.options].some((o) => o.value === current)) {
        const option = document.createElement(`option`);
        option.value = current;
        option.textContent = current;
        option.selected = true;
        select.appendChild(option);
      }
      return select;
    };
    const createGroupedNativeSelect = (id, groups, selected) => {
      const select = document.createElement(`select`);
      select.id = id;
      select.className = `prop-select keyword-select`;
      const custom = document.createElement(`option`);
      custom.value = ``;
      custom.textContent = `(custom / type below)`;
      select.appendChild(custom);
      for (const g of groups) {
        const og = document.createElement(`optgroup`);
        og.label = g.group;
        for (const o of g.options) {
          const option = document.createElement(`option`);
          option.value = o.value;
          option.textContent = o.label;
          og.appendChild(option);
        }
        select.appendChild(og);
      }
      const current = String(selected ?? ``);
      if (current && ![...select.options].some((o) => o.value === current)) {
        const option = document.createElement(`option`);
        option.value = current;
        option.textContent = current;
        select.appendChild(option);
      }
      select.value = current && [...select.options].some((o) => o.value === current) ? current : ``;
      return select;
    };
    const createIndicatorSelect = (id, defaultValue) => {
      const select = document.createElement(`vscode-single-select`);
      select.setAttribute(`id`, id);
      const options = [`None`];
      for (let i = 1; i <= 99; i++) {
        options.push(String(i));
      }
      options.forEach((option) => {
        const optionElement = document.createElement(`vscode-option`);
        optionElement.setAttribute(`value`, option);
        optionElement.innerText = option;
        if (String(option) === String(defaultValue)) {
          optionElement.setAttribute(`selected`, `true`);
        }
        select.appendChild(optionElement);
      });
      return select;
    };
    const createCheckbox = (id, label, checked) => {
      const checkbox = document.createElement(`vscode-checkbox`);
      checkbox.setAttribute(`id`, id);
      checkbox.setAttribute(`label`, label);
      if (checked) {
        checkbox.setAttribute(`checked`, checked);
      }
      return checkbox;
    };
    group.appendChild(createLabel(`Keyword`, `keywordPick`));
    const nameSelect = createGroupedNativeSelect(
      `keywordPick`,
      keywordNameOptionsGrouped(level),
      keyword?.name && findKeywordDef(keyword.name, level) ? keyword.name.toUpperCase() : ``
    );
    group.appendChild(nameSelect);
    group.appendChild(createLabel(`Custom name (if not listed)`, `keyword`));
    const nameInput = createTextField(`keyword`, keyword ? keyword.name : ``, `e.g. COLOR`);
    group.appendChild(nameInput);
    const help = document.createElement(`div`);
    help.className = `keyword-help`;
    help.style.fontSize = `11px`;
    help.style.opacity = `0.75`;
    help.style.marginTop = `0.25em`;
    group.appendChild(help);
    const valueHost = document.createElement(`div`);
    valueHost.id = `keywordValueHost`;
    group.appendChild(valueHost);
    const rebuildValueUi = (name, currentValue) => {
      valueHost.innerHTML = ``;
      const def = findKeywordDef(name, level);
      help.textContent = def?.description || ``;
      if (!def || def.valueMode === `none`) {
        if (!def) {
          valueHost.appendChild(createLabel(`Value`, `value`));
          valueHost.appendChild(createTextField(`value`, currentValue || ``, `parameter(s)`));
        } else {
          const none = document.createElement(`div`);
          none.style.fontSize = `12px`;
          none.style.opacity = `0.7`;
          none.style.marginTop = `0.5em`;
          none.textContent = `This keyword takes no parameters.`;
          valueHost.appendChild(none);
          const hidden = createTextField(`value`, ``);
          hidden.style.display = `none`;
          valueHost.appendChild(hidden);
        }
        return;
      }
      if (def.valueMode === `select` && def.options) {
        valueHost.appendChild(createLabel(`Value`, `value`));
        valueHost.appendChild(createNativeSelect(`value`, def.options, currentValue || def.options[0]?.value));
        return;
      }
      if (def.valueMode === `multi` && def.options) {
        valueHost.appendChild(createLabel(`Value (select one or more)`, `valueMulti`));
        const box = document.createElement(`div`);
        box.className = `keyword-multi`;
        box.id = `valueMulti`;
        const selected = new Set(
          String(currentValue || ``).trim().split(/[\s,]+/).filter(Boolean).map((s) => s.toUpperCase())
        );
        for (const o of def.options) {
          const row = document.createElement(`label`);
          row.className = `keyword-multi-row`;
          const cb = document.createElement(`input`);
          cb.type = `checkbox`;
          cb.value = o.value;
          cb.checked = selected.has(o.value.toUpperCase());
          row.appendChild(cb);
          row.appendChild(document.createTextNode(` ${o.label}`));
          box.appendChild(row);
        }
        valueHost.appendChild(box);
        const hidden = createTextField(`value`, currentValue || ``);
        hidden.style.display = `none`;
        valueHost.appendChild(hidden);
        return;
      }
      valueHost.appendChild(createLabel(`Value`, `value`));
      if (def.options?.length) {
        const suggest = createNativeSelect(
          `valueSuggest`,
          [{ value: ``, label: `(type custom below)` }, ...def.options],
          ``
        );
        suggest.addEventListener(`change`, () => {
          if (suggest.value) {
            const tf = (
              /** @type {any} */
              valueHost.querySelector(`#value`)
            );
            if (tf) {
              tf.setAttribute(`value`, suggest.value);
              tf.value = suggest.value;
            }
          }
        });
        valueHost.appendChild(suggest);
      }
      valueHost.appendChild(createTextField(`value`, currentValue || ``, def.placeholder));
    };
    const syncNameFromPick = () => {
      if (nameSelect.value) {
        nameInput.setAttribute(`value`, nameSelect.value);
        const el = nameInput;
        el.value = nameSelect.value;
        rebuildValueUi(nameSelect.value, keyword?.value);
      }
    };
    nameSelect.addEventListener(`change`, () => {
      syncNameFromPick();
    });
    nameInput.addEventListener(`change`, () => {
      const el = nameInput;
      const n = (el.value || ``).trim().toUpperCase();
      if (n && findKeywordDef(n, level)) {
        nameSelect.value = n;
      } else {
        nameSelect.value = ``;
      }
      rebuildValueUi(n, getCurrentValueString());
    });
    nameInput.addEventListener(`keyup`, () => {
      const el = nameInput;
      rebuildValueUi((el.value || ``).trim().toUpperCase(), getCurrentValueString());
    });
    function getCurrentValueString() {
      const multi = valueHost.querySelector(`#valueMulti`);
      if (multi) {
        return [...multi.querySelectorAll(`input[type=checkbox]:checked`)].map((cb) => (
          /** @type {HTMLInputElement} */
          cb.value
        )).join(` `);
      }
      const sel = valueHost.querySelector(`select#value`);
      if (sel) {
        return sel.value;
      }
      const tf = valueHost.querySelector(`#value`);
      return tf?.value || ``;
    }
    const initialName = (keyword?.name || nameSelect.value || ``).toUpperCase();
    if (initialName && findKeywordDef(initialName, level)) {
      nameSelect.value = initialName;
    }
    rebuildValueUi(initialName, keyword?.value);
    group.appendChild(createLabel(`Indicator 1`, `ind1`));
    group.appendChild(createIndicatorSelect(`ind1`, keyword ? keyword.conditions?.[0]?.indicator : void 0));
    group.appendChild(createCheckbox(`neg1`, `Negate`, keyword ? keyword.conditions?.[0]?.negate : void 0));
    group.appendChild(createLabel(`Indicator 2`, `ind2`));
    group.appendChild(createIndicatorSelect(`ind2`, keyword ? keyword.conditions?.[1]?.indicator : void 0));
    group.appendChild(createCheckbox(`neg2`, `Negate`, keyword ? keyword.conditions?.[1]?.negate : void 0));
    group.appendChild(createLabel(`Indicator 3`, `ind3`));
    group.appendChild(createIndicatorSelect(`ind3`, keyword ? keyword.conditions?.[2]?.indicator : void 0));
    group.appendChild(createCheckbox(`neg3`, `Negate`, keyword ? keyword.conditions?.[2]?.negate : void 0));
    const button = document.createElement(`vscode-button`);
    button.setAttribute(`icon`, `check`);
    button.style.marginTop = `1em`;
    button.style.display = `block`;
    button.innerText = `Confirm`;
    button.onclick = () => {
      const nameEl = group.querySelector(`#keyword`);
      let keywordName = (nameSelect.value || nameEl?.value || ``).trim().toUpperCase();
      if (!keywordName) {
        return;
      }
      let keywordValue = getCurrentValueString().trim();
      const def = findKeywordDef(keywordName, level);
      if (def?.valueMode === `none`) {
        keywordValue = ``;
      }
      const ind1 = (
        /** @type {any} */
        group.querySelector(`#ind1`).value
      );
      const neg1 = (
        /** @type {any} */
        group.querySelector(`#neg1`).checked
      );
      const ind2 = (
        /** @type {any} */
        group.querySelector(`#ind2`).value
      );
      const neg2 = (
        /** @type {any} */
        group.querySelector(`#neg2`).checked
      );
      const ind3 = (
        /** @type {any} */
        group.querySelector(`#ind3`).value
      );
      const neg3 = (
        /** @type {any} */
        group.querySelector(`#neg3`).checked
      );
      const newKeyword = {
        name: keywordName,
        value: keywordValue ? keywordValue : void 0,
        conditions: []
      };
      if (ind1 !== `None`) {
        newKeyword.conditions.push({ indicator: Number(ind1), negate: !!neg1 });
      }
      if (ind2 !== `None`) {
        newKeyword.conditions.push({ indicator: Number(ind2), negate: !!neg2 });
      }
      if (ind3 !== `None`) {
        newKeyword.conditions.push({ indicator: Number(ind3), negate: !!neg3 });
      }
      onUpdate(newKeyword);
    };
    group.appendChild(button);
    ensureRightSidebarVisible();
    const keywordEditorArea = document.getElementById(`keywordEditorArea`);
    if (!keywordEditorArea) {
      return;
    }
    keywordEditorArea.innerHTML = ``;
    const title = document.createElement(`div`);
    title.className = `palette-heading`;
    title.innerText = keyword ? `Edit keyword` : `New keyword`;
    keywordEditorArea.appendChild(title);
    keywordEditorArea.appendChild(group);
    keywordEditorArea.scrollTop = 0;
  }
  function renderSections(sidebar, sections) {
    const active = document.activeElement;
    let focusKey;
    if (active instanceof HTMLElement && sidebar.contains(active)) {
      if (active.id) {
        focusKey = { kind: `id`, value: active.id };
      } else if (active.dataset?.propId) {
        focusKey = { kind: `propId`, value: active.dataset.propId };
      }
    }
    const openByTitle = /* @__PURE__ */ new Map();
    sidebar.querySelectorAll(`vscode-collapsible`).forEach((el) => {
      const title = el.getAttribute(`title`) || ``;
      if (title) {
        openByTitle.set(title, el.hasAttribute(`open`));
      }
    });
    sidebar.innerHTML = ``;
    for (let section of sections) {
      let newSection = document.createElement(`vscode-collapsible`);
      newSection.setAttribute(`title`, section.title);
      const wasOpen = openByTitle.has(section.title) ? openByTitle.get(section.title) : section.open;
      if (wasOpen) {
        newSection.setAttribute(`open`, ``);
      }
      if (typeof section.html === `string`) {
        newSection.innerHTML = section.html;
      } else {
        newSection.appendChild(section.html);
      }
      sidebar.appendChild(newSection);
    }
    if (focusKey) {
      let next = null;
      if (focusKey.kind === `id`) {
        next = sidebar.querySelector(`#${CSS.escape(focusKey.value)}`);
      } else {
        next = sidebar.querySelector(`[data-prop-id="${CSS.escape(focusKey.value)}"]`);
      }
      if (next instanceof HTMLElement) {
        next.focus();
        if (next.isContentEditable) {
          const range = document.createRange();
          range.selectNodeContents(next);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
    }
  }

  // src/shared/recordName.ts
  var RECORD_NAME_RE = /^[A-Z@#$][A-Z0-9@#$]{0,9}$/;
  function isValidRecordName2(name) {
    return RECORD_NAME_RE.test((name || ``).trim().toUpperCase());
  }

  // webui/src/palette.js
  var paletteItems = [
    {
      label: `Named field`,
      icon: `symbol-field`,
      field: () => ({
        name: `FIELD1`,
        length: 10,
        type: `A`,
        primitiveType: `char`,
        displayType: `both`,
        decimals: 0,
        position: { x: 1, y: 1 },
        keywords: [],
        conditions: []
      })
    },
    {
      label: `Date field`,
      icon: `calendar`,
      field: () => ({
        name: `DATE1`,
        length: 8,
        type: `L`,
        primitiveType: `char`,
        displayType: `output`,
        decimals: 0,
        position: { x: 1, y: 1 },
        keywords: [{ name: `DATFMT`, value: `*ISO`, conditions: [] }],
        conditions: []
      })
    },
    {
      label: `Time field`,
      icon: `calendar`,
      field: () => ({
        name: `TIME1`,
        length: 8,
        type: `T`,
        primitiveType: `char`,
        displayType: `output`,
        decimals: 0,
        position: { x: 1, y: 1 },
        keywords: [{ name: `TIMFMT`, value: `*ISO`, conditions: [] }],
        conditions: []
      })
    },
    {
      label: `Timestamp field`,
      icon: `calendar`,
      field: () => ({
        name: `TS1`,
        length: 26,
        type: `Z`,
        primitiveType: `char`,
        displayType: `output`,
        decimals: 0,
        position: { x: 1, y: 1 },
        keywords: [],
        conditions: []
      })
    },
    {
      label: `Constant text`,
      icon: `symbol-constant`,
      field: () => ({
        value: `Constant`,
        position: { x: 1, y: 1 },
        displayType: `const`,
        length: 8,
        decimals: 0,
        keywords: [],
        conditions: []
      })
    },
    {
      label: `System name`,
      icon: `account`,
      field: () => ({
        value: ``,
        position: { x: 1, y: 1 },
        displayType: `const`,
        length: 8,
        decimals: 0,
        keywords: [{ name: `SYSNAME`, conditions: [] }],
        conditions: []
      })
    },
    {
      label: `Date constant`,
      icon: `calendar`,
      field: () => ({
        value: ``,
        position: { x: 1, y: 1 },
        displayType: `const`,
        length: 10,
        decimals: 0,
        keywords: [
          { name: `DATE`, conditions: [] },
          { name: `DATFMT`, value: `*ISO`, conditions: [] }
        ],
        conditions: []
      })
    },
    {
      label: `Time constant`,
      icon: `calendar`,
      field: () => ({
        value: ``,
        position: { x: 1, y: 1 },
        displayType: `const`,
        length: 8,
        decimals: 0,
        keywords: [
          { name: `TIME`, conditions: [] },
          { name: `TIMFMT`, value: `*HMS`, conditions: [] }
        ],
        conditions: []
      })
    }
  ];
  var draggingField;
  function getDraggingField() {
    return draggingField;
  }
  function clearDraggingField() {
    draggingField = void 0;
  }
  function nextAvailableRecordName(prefix, existing) {
    const upperExisting = new Set([...existing].map((n) => n.toUpperCase()));
    for (let i = 1; i <= 99; i++) {
      const candidate = `${prefix}${String(i).padStart(2, `0`)}`;
      if (candidate.length <= 10 && !upperExisting.has(candidate)) {
        return candidate;
      }
    }
    return prefix.slice(0, 10).toUpperCase();
  }
  function appendHeading(parent, text) {
    const heading = document.createElement(`div`);
    heading.className = `palette-heading`;
    heading.innerText = text;
    parent.appendChild(heading);
  }
  function appendHint(parent, text) {
    const hint = document.createElement(`div`);
    hint.className = `palette-hint`;
    hint.innerText = text;
    parent.appendChild(hint);
  }
  function appendTextField(parent, label, id, value, placeholder) {
    const lab = document.createElement(`vscode-label`);
    lab.setAttribute(`for`, id);
    lab.innerText = label;
    parent.appendChild(lab);
    const input = document.createElement(`vscode-textfield`);
    input.id = id;
    input.setAttribute(`value`, value);
    if (placeholder) {
      input.setAttribute(`placeholder`, placeholder);
    }
    input.style.width = `100%`;
    input.style.marginBottom = `0.5em`;
    parent.appendChild(input);
    return input;
  }
  function readTextField(el) {
    const any = el;
    return String(any?.value ?? el.getAttribute(`value`) ?? ``).trim().toUpperCase();
  }
  function renderPalette(sidebar, onClickCreate, opts = {}) {
    sidebar.innerHTML = ``;
    const existing = new Set((opts.existingNames || []).map((n) => n.toUpperCase()));
    const onCreateRecord = opts.onCreateRecord;
    appendHeading(sidebar, `Add field`);
    appendHint(sidebar, `Drag onto the screen or click to add at 1,1`);
    for (const item of paletteItems) {
      const button = document.createElement(`vscode-button`);
      button.setAttribute(`secondary`, `true`);
      button.setAttribute(`icon`, item.icon);
      button.className = `palette-btn`;
      button.innerText = item.label;
      button.setAttribute(`draggable`, `true`);
      button.addEventListener(`dragstart`, (e) => {
        draggingField = item.field();
        e.dataTransfer?.setData(`application/x-dds-field`, JSON.stringify(draggingField));
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = `copy`;
        }
      });
      button.addEventListener(`dragend`, () => {
        draggingField = void 0;
      });
      button.onclick = () => onClickCreate(item.field());
      sidebar.appendChild(button);
    }
    if (!onCreateRecord) {
      return;
    }
    if (opts.onBrowseDatabase) {
      const dbDivider = document.createElement(`vscode-divider`);
      dbDivider.style.margin = `0.75em 0`;
      sidebar.appendChild(dbDivider);
      appendHeading(sidebar, `Database fields`);
      appendHint(sidebar, `Browse a PF/LF via Code for IBM i and place REFFLD fields (SDA F10).`);
      const dbBtn = document.createElement(`vscode-button`);
      dbBtn.setAttribute(`secondary`, `true`);
      dbBtn.setAttribute(`icon`, `database`);
      dbBtn.className = `palette-btn`;
      dbBtn.innerText = `Add from database\u2026`;
      dbBtn.onclick = () => opts.onBrowseDatabase();
      sidebar.appendChild(dbBtn);
    }
    const divider = document.createElement(`vscode-divider`);
    divider.style.margin = `0.75em 0`;
    sidebar.appendChild(divider);
    appendHeading(sidebar, `Add record`);
    appendHint(
      sidebar,
      `Standard record, or a subfile pair (SFL + SFLCTL) with common control keywords.`
    );
    const formHost = document.createElement(`div`);
    formHost.className = `record-form-host`;
    sidebar.appendChild(formHost);
    const showForm = (mode) => {
      formHost.innerHTML = ``;
      if (mode === `pick`) {
        const stdBtn = document.createElement(`vscode-button`);
        stdBtn.setAttribute(`secondary`, `true`);
        stdBtn.setAttribute(`icon`, `file`);
        stdBtn.className = `palette-btn`;
        stdBtn.innerText = `Standard record`;
        stdBtn.onclick = () => showForm(`standard`);
        formHost.appendChild(stdBtn);
        const sflBtn = document.createElement(`vscode-button`);
        sflBtn.setAttribute(`secondary`, `true`);
        sflBtn.setAttribute(`icon`, `table`);
        sflBtn.className = `palette-btn`;
        sflBtn.innerText = `Subfile (SFL + CTL)`;
        sflBtn.onclick = () => showForm(`subfile`);
        formHost.appendChild(sflBtn);
        const msgBtn = document.createElement(`vscode-button`);
        msgBtn.setAttribute(`secondary`, `true`);
        msgBtn.setAttribute(`icon`, `mail`);
        msgBtn.className = `palette-btn`;
        msgBtn.innerText = `Message subfile (SFLMSG)`;
        msgBtn.onclick = () => showForm(`sflmsg`);
        formHost.appendChild(msgBtn);
        const usrBtn = document.createElement(`vscode-button`);
        usrBtn.setAttribute(`secondary`, `true`);
        usrBtn.setAttribute(`icon`, `symbol-misc`);
        usrBtn.className = `palette-btn`;
        usrBtn.innerText = `User-defined (USRDFN)`;
        usrBtn.onclick = () => showForm(`usrdfn`);
        formHost.appendChild(usrBtn);
        return;
      }
      const error = document.createElement(`div`);
      error.className = `palette-error`;
      error.hidden = true;
      formHost.appendChild(error);
      const setError = (msg) => {
        error.textContent = msg;
        error.hidden = !msg;
      };
      if (mode === `standard`) {
        appendHint(formHost, `Creates one record format (R name).`);
        const nameInput = appendTextField(
          formHost,
          `Record name`,
          `newRecordName`,
          nextAvailableRecordName(`REC`, existing),
          `REC01`
        );
        const overlay = document.createElement(`vscode-checkbox`);
        overlay.id = `newRecordOverlay`;
        overlay.setAttribute(`label`, `Add OVERLAY`);
        formHost.appendChild(overlay);
        const asWindow = document.createElement(`vscode-checkbox`);
        asWindow.id = `newRecordWindow`;
        asWindow.setAttribute(`label`, `WINDOW (5 10 12 40)`);
        formHost.appendChild(asWindow);
        const actions = document.createElement(`div`);
        actions.className = `palette-actions`;
        const cancel = document.createElement(`vscode-button`);
        cancel.setAttribute(`secondary`, `true`);
        cancel.innerText = `Back`;
        cancel.onclick = () => showForm(`pick`);
        const create = document.createElement(`vscode-button`);
        create.setAttribute(`icon`, `add`);
        create.innerText = `Create`;
        create.onclick = () => {
          const name = readTextField(nameInput);
          if (!isValidRecordName(name)) {
            setError(`Name must be 1\u201310 chars (A\u2013Z, 0\u20139, @ # $), starting with a letter.`);
            return;
          }
          if (existing.has(name)) {
            setError(`Record ${name} already exists.`);
            return;
          }
          const keywords = [];
          const ov = overlay;
          if (ov?.checked) {
            keywords.push({ name: `OVERLAY`, conditions: [] });
          }
          const win = asWindow;
          if (win?.checked) {
            keywords.push({ name: `WINDOW`, value: `5 10 12 40`, conditions: [] });
          }
          onCreateRecord({
            kind: `standard`,
            formats: [{ name, keywords }],
            selectFormat: name
          });
        };
        actions.appendChild(cancel);
        actions.appendChild(create);
        formHost.appendChild(actions);
        return;
      }
      if (mode === `subfile`) {
        appendHint(
          formHost,
          `Creates SFL (row) then SFLCTL (control) with SFLDSP / SFLCLR / SFLPAG.`
        );
        const sflInput = appendTextField(
          formHost,
          `Subfile record (SFL)`,
          `newSflName`,
          nextAvailableRecordName(`SFL`, existing),
          `SFL01`
        );
        const ctlInput = appendTextField(
          formHost,
          `Control record (SFLCTL)`,
          `newCtlName`,
          nextAvailableRecordName(`CTL`, existing),
          `CTL01`
        );
        const pageInput = appendTextField(formHost, `SFLPAG (rows per page)`, `newSflPag`, `10`, `10`);
        const overlay = document.createElement(`vscode-checkbox`);
        overlay.id = `newSflOverlay`;
        overlay.setAttribute(`label`, `Add OVERLAY on control`);
        overlay.setAttribute(`checked`, ``);
        formHost.appendChild(overlay);
        const actions = document.createElement(`div`);
        actions.className = `palette-actions`;
        const cancel = document.createElement(`vscode-button`);
        cancel.setAttribute(`secondary`, `true`);
        cancel.innerText = `Back`;
        cancel.onclick = () => showForm(`pick`);
        const create = document.createElement(`vscode-button`);
        create.setAttribute(`icon`, `add`);
        create.innerText = `Create pair`;
        create.onclick = () => {
          const sflName = readTextField(sflInput);
          const ctlName = readTextField(ctlInput);
          const pageRaw = readTextField(pageInput) || `10`;
          const page = Number(pageRaw);
          if (!isValidRecordName(sflName) || !isValidRecordName(ctlName)) {
            setError(`Names must be 1\u201310 chars (A\u2013Z, 0\u20139, @ # $), starting with a letter.`);
            return;
          }
          if (sflName === ctlName) {
            setError(`SFL and CTL names must be different.`);
            return;
          }
          if (existing.has(sflName) || existing.has(ctlName)) {
            setError(`One of those record names already exists.`);
            return;
          }
          if (!Number.isInteger(page) || page < 1 || page > 999) {
            setError(`SFLPAG must be an integer from 1 to 999.`);
            return;
          }
          const ctlKeywords = [
            { name: `SFLCTL`, value: sflName, conditions: [] },
            { name: `SFLDSP`, conditions: [] },
            { name: `SFLDSPCTL`, conditions: [] },
            { name: `SFLCLR`, conditions: [] },
            { name: `SFLPAG`, value: String(page), conditions: [] },
            { name: `SFLSIZ`, value: String(page), conditions: [] }
          ];
          const ov = overlay;
          if (ov?.checked) {
            ctlKeywords.push({ name: `OVERLAY`, conditions: [] });
          }
          onCreateRecord({
            kind: `subfile`,
            formats: [
              { name: sflName, keywords: [{ name: `SFL`, conditions: [] }] },
              { name: ctlName, keywords: ctlKeywords }
            ],
            selectFormat: ctlName
          });
        };
        actions.appendChild(cancel);
        actions.appendChild(create);
        formHost.appendChild(actions);
        return;
      }
      if (mode === `usrdfn`) {
        appendHint(formHost, `Creates a USRDFN record (advanced / user-written DDS body).`);
        const nameInput = appendTextField(
          formHost,
          `Record name`,
          `newUsrdfnName`,
          nextAvailableRecordName(`USR`, existing),
          `USR01`
        );
        const actions = document.createElement(`div`);
        actions.className = `palette-actions`;
        const cancel = document.createElement(`vscode-button`);
        cancel.setAttribute(`secondary`, `true`);
        cancel.innerText = `Back`;
        cancel.onclick = () => showForm(`pick`);
        const create = document.createElement(`vscode-button`);
        create.setAttribute(`icon`, `add`);
        create.innerText = `Create`;
        create.onclick = () => {
          const name = readTextField(nameInput);
          if (!isValidRecordName(name)) {
            setError(`Name must be 1\u201310 chars (A\u2013Z, 0\u20139, @ # $), starting with a letter.`);
            return;
          }
          if (existing.has(name)) {
            setError(`Record ${name} already exists.`);
            return;
          }
          onCreateRecord({
            kind: `standard`,
            formats: [{ name, keywords: [{ name: `USRDFN`, conditions: [] }] }],
            selectFormat: name
          });
        };
        actions.appendChild(cancel);
        actions.appendChild(create);
        formHost.appendChild(actions);
        return;
      }
      if (mode === `sflmsg`) {
        appendHint(
          formHost,
          `Creates a message subfile pair: SFL with SFLMSGRCD, plus SFLCTL with message-subfile keywords.`
        );
        const sflInput = appendTextField(
          formHost,
          `Message subfile (SFL)`,
          `newMsgSflName`,
          nextAvailableRecordName(`MSF`, existing),
          `MSF01`
        );
        const ctlInput = appendTextField(
          formHost,
          `Control record (SFLCTL)`,
          `newMsgCtlName`,
          nextAvailableRecordName(`MCTL`, existing),
          `MCTL01`
        );
        const actions = document.createElement(`div`);
        actions.className = `palette-actions`;
        const cancel = document.createElement(`vscode-button`);
        cancel.setAttribute(`secondary`, `true`);
        cancel.innerText = `Back`;
        cancel.onclick = () => showForm(`pick`);
        const create = document.createElement(`vscode-button`);
        create.setAttribute(`icon`, `add`);
        create.innerText = `Create pair`;
        create.onclick = () => {
          const sflName = readTextField(sflInput);
          const ctlName = readTextField(ctlInput);
          if (!isValidRecordName(sflName) || !isValidRecordName(ctlName)) {
            setError(`Names must be 1\u201310 chars (A\u2013Z, 0\u20139, @ # $), starting with a letter.`);
            return;
          }
          if (sflName === ctlName) {
            setError(`SFL and CTL names must be different.`);
            return;
          }
          if (existing.has(sflName) || existing.has(ctlName)) {
            setError(`One of those record names already exists.`);
            return;
          }
          onCreateRecord({
            kind: `subfile`,
            formats: [
              {
                name: sflName,
                keywords: [
                  { name: `SFL`, conditions: [] },
                  { name: `SFLMSGRCD`, value: `1`, conditions: [] }
                ]
              },
              {
                name: ctlName,
                keywords: [
                  { name: `SFLCTL`, value: sflName, conditions: [] },
                  { name: `SFLDSP`, conditions: [] },
                  { name: `SFLDSPCTL`, conditions: [] },
                  { name: `SFLINZ`, conditions: [] },
                  { name: `SFLPAG`, value: `1`, conditions: [] },
                  { name: `SFLSIZ`, value: `1`, conditions: [] },
                  { name: `OVERLAY`, conditions: [] }
                ]
              }
            ],
            selectFormat: ctlName
          });
        };
        actions.appendChild(cancel);
        actions.appendChild(create);
        formHost.appendChild(actions);
        return;
      }
    };
    showForm(`pick`);
  }

  // webui/src/sidebar.js
  function updateRecordFormatSidebar(recordInfo, globalInfo, allFormats, overlayFormats2, onFormatUpdate, onOverlayChange, onFileUpdate, onSelectField) {
    const sidebar = document.getElementById(`recordFormatSidebar`);
    let sections = [];
    if (globalInfo) {
      sections.push({
        title: `File Keywords`,
        html: createKeywordPanel(`keywords-${globalInfo.name}`, globalInfo.keywords, onFileUpdate, `file`),
        open: false
      });
    }
    sections.push({
      title: `Format Keywords`,
      html: createKeywordPanel(`keywords-${recordInfo.name}`, recordInfo.keywords, onFormatUpdate, `format`),
      open: false
    });
    const sflCtl = (recordInfo.keywords || []).find((k) => k.name === `SFLCTL`);
    if (sflCtl && onFormatUpdate) {
      const helpers = document.createElement(`div`);
      helpers.className = `sfl-helpers`;
      helpers.style.padding = `0.5em`;
      const hint = document.createElement(`div`);
      hint.className = `palette-hint`;
      hint.style.padding = `0`;
      hint.innerText = `Edit rows on the ${sflCtl.value || `SFL`} tab. Adjust page size here.`;
      helpers.appendChild(hint);
      const pag = (recordInfo.keywords || []).find((k) => k.name === `SFLPAG`);
      const siz = (recordInfo.keywords || []).find((k) => k.name === `SFLSIZ`);
      const endKw = (recordInfo.keywords || []).find((k) => k.name === `SFLEND`);
      const pagInput = document.createElement(`vscode-textfield`);
      pagInput.setAttribute(`value`, pag?.value || `10`);
      const sizInput = document.createElement(`vscode-textfield`);
      sizInput.setAttribute(`value`, siz?.value || pag?.value || `10`);
      const endSelect = document.createElement(`select`);
      endSelect.className = `prop-select`;
      for (const o of [``, `*MORE`, `*SCRBAR`]) {
        const opt2 = document.createElement(`option`);
        opt2.value = o;
        opt2.textContent = o || `(none)`;
        if ((endKw?.value || ``) === o) {
          opt2.selected = true;
        }
        endSelect.appendChild(opt2);
      }
      const lab = (t) => {
        const el = document.createElement(`div`);
        el.style.fontSize = `11px`;
        el.style.marginTop = `0.4em`;
        el.innerText = t;
        return el;
      };
      helpers.appendChild(lab(`SFLPAG`));
      helpers.appendChild(pagInput);
      helpers.appendChild(lab(`SFLSIZ`));
      helpers.appendChild(sizInput);
      helpers.appendChild(lab(`SFLEND`));
      helpers.appendChild(endSelect);
      const apply = document.createElement(`vscode-button`);
      apply.innerText = `Apply subfile sizes`;
      apply.style.marginTop = `0.5em`;
      apply.style.display = `block`;
      apply.onclick = () => {
        const pEl = pagInput;
        const sEl = sizInput;
        const pVal = String(pEl.value || pagInput.getAttribute(`value`) || `10`).trim();
        const sVal = String(sEl.value || sizInput.getAttribute(`value`) || pVal).trim();
        const next = JSON.parse(JSON.stringify(recordInfo.keywords || []));
        const upsert = (name, value) => {
          const i = next.findIndex((k) => k.name === name);
          if (i >= 0) {
            next[i].value = value;
          } else {
            next.push({ name, value, conditions: [] });
          }
        };
        upsert(`SFLPAG`, pVal);
        upsert(`SFLSIZ`, sVal);
        const endIdx = next.findIndex((k) => k.name === `SFLEND`);
        if (endSelect.value) {
          if (endIdx >= 0) {
            next[endIdx].value = endSelect.value;
          } else {
            next.push({ name: `SFLEND`, value: endSelect.value, conditions: [] });
          }
        } else if (endIdx >= 0) {
          next.splice(endIdx, 1);
        }
        onFormatUpdate(next);
      };
      helpers.appendChild(apply);
      sections.push({ title: `Subfile control`, html: helpers, open: false });
    }
    const winKw = (recordInfo.keywords || []).find((k) => k.name === `WINDOW`);
    if (winKw && onFormatUpdate) {
      const helpers = document.createElement(`div`);
      helpers.style.padding = `0.5em`;
      const hint = document.createElement(`div`);
      hint.className = `palette-hint`;
      hint.style.padding = `0`;
      hint.innerText = `Drag the blue handle on the canvas to resize, or edit WINDOW / title / border here.`;
      helpers.appendChild(hint);
      const winInput = document.createElement(`vscode-textfield`);
      winInput.setAttribute(`value`, winKw.value || `5 10 12 40`);
      const titleKw = (recordInfo.keywords || []).find((k) => k.name === `WDWTITLE`);
      const titleInput = document.createElement(`vscode-textfield`);
      titleInput.setAttribute(`value`, titleKw?.value || `*TEXT 'Title' *COLOR BLU *TOP *CENTER`);
      const borderKw = (recordInfo.keywords || []).find((k) => k.name === `WDWBORDER`);
      const borderColor = document.createElement(`select`);
      borderColor.className = `prop-select`;
      for (const c of [`BLU`, `GRN`, `WHT`, `RED`, `TRQ`, `YLW`, `PNK`]) {
        const o = document.createElement(`option`);
        o.value = c;
        o.textContent = c;
        const current = (borderKw?.value || `*COLOR BLU`).toUpperCase();
        if (current.includes(c)) {
          o.selected = true;
        }
        borderColor.appendChild(o);
      }
      const lab = (t) => {
        const el = document.createElement(`div`);
        el.style.fontSize = `11px`;
        el.style.marginTop = `0.4em`;
        el.innerText = t;
        return el;
      };
      helpers.appendChild(lab(`WINDOW (row col height width)`));
      helpers.appendChild(winInput);
      helpers.appendChild(lab(`WDWTITLE`));
      helpers.appendChild(titleInput);
      helpers.appendChild(lab(`WDWBORDER *COLOR`));
      helpers.appendChild(borderColor);
      const apply = document.createElement(`vscode-button`);
      apply.innerText = `Apply window`;
      apply.style.marginTop = `0.5em`;
      apply.style.display = `block`;
      apply.onclick = () => {
        const wEl = winInput;
        const tEl = titleInput;
        const wVal = String(wEl.value || winInput.getAttribute(`value`) || ``).trim();
        const tVal = String(tEl.value || titleInput.getAttribute(`value`) || ``).trim();
        const next = JSON.parse(JSON.stringify(recordInfo.keywords || []));
        const upsert = (name, value) => {
          const i = next.findIndex((k) => k.name === name);
          if (i >= 0) {
            next[i].value = value;
          } else {
            next.push({ name, value, conditions: [] });
          }
        };
        if (wVal) {
          upsert(`WINDOW`, wVal);
        }
        if (tVal) {
          upsert(`WDWTITLE`, tVal);
        }
        upsert(`WDWBORDER`, `*COLOR ${borderColor.value}`);
        onFormatUpdate(next);
      };
      helpers.appendChild(apply);
      sections.push({ title: `Window`, html: helpers, open: false });
    }
    const fieldList = document.createElement(`div`);
    fieldList.className = `field-list`;
    const fields = (recordInfo.fields || []).filter((f) => f.displayType !== `hidden`);
    if (fields.length === 0) {
      fieldList.innerText = `No fields yet`;
      fieldList.style.padding = `0.5em`;
      fieldList.style.opacity = `0.7`;
    } else {
      for (const f of fields) {
        const row = document.createElement(`button`);
        row.type = `button`;
        row.className = `field-list-item`;
        const usage = f.displayType || ``;
        row.textContent = `${f.name || `(const)`}  r${f.position?.y ?? `?`} c${f.position?.x ?? `?`}  ${usage}  len ${f.length ?? 0}`;
        row.title = row.textContent;
        row.onclick = () => {
          if (typeof onSelectField === `function`) {
            onSelectField(f.name);
          }
        };
        fieldList.appendChild(row);
      }
    }
    sections.push({ title: `Fields`, html: fieldList, open: false });
    const overlayDiv = document.createElement(`div`);
    overlayDiv.style.padding = `0.5em`;
    const formats = allFormats.filter((f) => f.name !== `_GLOBAL` && f.name !== recordInfo.name);
    if (formats.length > 0) {
      const label = document.createElement(`div`);
      label.innerText = `Overlay formats:`;
      label.style.marginBottom = `0.4em`;
      overlayDiv.appendChild(label);
      for (const f of formats) {
        const row = document.createElement(`label`);
        row.style.display = `block`;
        row.style.fontSize = `12px`;
        const cb = document.createElement(`input`);
        cb.type = `checkbox`;
        cb.checked = overlayFormats2.includes(f.name);
        cb.addEventListener(`change`, () => {
          const next = cb.checked ? [.../* @__PURE__ */ new Set([...overlayFormats2, f.name])] : overlayFormats2.filter((n) => n !== f.name);
          onOverlayChange(next);
        });
        row.appendChild(cb);
        row.appendChild(document.createTextNode(` ${f.name}`));
        overlayDiv.appendChild(row);
      }
    } else {
      overlayDiv.innerText = `No other formats to overlay`;
    }
    sections.push({
      title: `Overlays`,
      html: overlayDiv,
      open: false
    });
    const indicatorHost = document.createElement(`div`);
    indicatorHost.id = `indicatorPanelHost`;
    sections.push({
      title: `Runtime Indicators`,
      html: indicatorHost,
      open: false
    });
    renderSections(sidebar, sections);
    renderIndicatorPanel(indicatorHost);
  }
  function showFieldPalette(onCreate, opts) {
    clearKeywordEditor();
    const sidebar = document.getElementById(`fieldInfoSidebar`);
    renderPalette(sidebar, onCreate, opts);
  }
  var DISPLAY_TYPE_OPTIONS = [
    { value: `input`, label: `input (I)` },
    { value: `output`, label: `output (O)` },
    { value: `both`, label: `both (B)` },
    { value: `hidden`, label: `hidden (H)` },
    { value: `const`, label: `const (text)` }
  ];
  var DDS_TYPE_OPTIONS = [
    { value: ``, label: `(blank)` },
    { value: `A`, label: `A \u2014 Character` },
    { value: `S`, label: `S \u2014 Zoned decimal` },
    { value: `P`, label: `P \u2014 Packed decimal` },
    { value: `Y`, label: `Y \u2014 Numeric edit` },
    { value: `L`, label: `L \u2014 Date` },
    { value: `T`, label: `T \u2014 Time` },
    { value: `Z`, label: `Z \u2014 Timestamp` },
    { value: `F`, label: `F \u2014 Floating point` },
    { value: `I`, label: `I \u2014 Integer` },
    { value: `U`, label: `U \u2014 Unsigned` },
    { value: `B`, label: `B \u2014 Binary` },
    { value: `R`, label: `R \u2014 Reference` }
  ];
  var NUMERIC_DDS_TYPES = /* @__PURE__ */ new Set([`S`, `P`, `Y`, `F`, `I`, `U`, `B`]);
  function normalizeFieldProps(fieldInfo, newProps) {
    const prevDisplay = fieldInfo.displayType;
    const next = {
      ...fieldInfo,
      name: newProps.name !== void 0 ? newProps.name.trim() : fieldInfo.name,
      value: newProps.value !== void 0 ? newProps.value : fieldInfo.value,
      displayType: (
        /** @type {FieldInfo['displayType']} */
        newProps.displayType !== void 0 ? newProps.displayType : fieldInfo.displayType
      ),
      type: newProps.type !== void 0 ? newProps.type.trim() || void 0 : fieldInfo.type,
      length: newProps.length !== void 0 ? Number(newProps.length) || 0 : fieldInfo.length,
      decimals: newProps.decimals !== void 0 ? Number(newProps.decimals) || 0 : fieldInfo.decimals
    };
    if (newProps.reference !== void 0) {
      const ref = newProps.reference.trim();
      next.reference = ref || void 0;
    }
    if (next.displayType === `const`) {
      if (!next.value) {
        next.value = next.name || fieldInfo.value || `Constant`;
      }
      next.type = void 0;
      next.isReference = false;
      next.primitiveType = `char`;
      if (!next.length && next.value) {
        next.length = String(next.value).length;
      }
    }
    if (prevDisplay === `const` && next.displayType && next.displayType !== `const`) {
      if (!next.name) {
        const base = String(next.value || `FIELD`).replace(/[^A-Za-z0-9]/g, ``).toUpperCase() || `FIELD`;
        next.name = base.substring(0, 10);
      }
      if (!next.type || !String(next.type).trim()) {
        next.type = `A`;
      }
      if (!next.length) {
        next.length = Math.max(1, String(next.value || ``).length || 10);
      }
    }
    if (next.displayType !== `const` && !next.name) {
      next.name = `FIELD1`;
    }
    const typeUpper = (next.type || ``).toUpperCase();
    if (typeUpper === `R`) {
      next.isReference = true;
      next.type = `R`;
    } else if (next.type) {
      next.isReference = false;
    }
    if (typeUpper && NUMERIC_DDS_TYPES.has(typeUpper)) {
      next.primitiveType = `decimal`;
    } else if (next.displayType !== `const`) {
      next.primitiveType = `char`;
    }
    const parseCond = (raw) => {
      const s = String(raw || ``).trim().toUpperCase();
      if (!s) {
        return void 0;
      }
      const negate = s.startsWith(`N`);
      const num = Number(negate ? s.slice(1) : s);
      if (!Number.isInteger(num) || num < 1 || num > 99) {
        return void 0;
      }
      return { indicator: num, negate };
    };
    const c1 = parseCond(newProps.cond1);
    const c2 = parseCond(newProps.cond2);
    const c3 = parseCond(newProps.cond3);
    if (newProps.cond1 !== void 0 || newProps.cond2 !== void 0 || newProps.cond3 !== void 0) {
      next.conditions = [c1, c2, c3].filter(Boolean);
    }
    return next;
  }
  function updateSelectedFieldSidebar(fieldInfo, onUpdate, onDelete) {
    const sidebar = document.getElementById(`fieldInfoSidebar`);
    const properties = [
      { label: `Name`, value: fieldInfo.name || ``, id: `name` },
      {
        label: `Display Type`,
        value: fieldInfo.displayType || `output`,
        id: `displayType`,
        options: DISPLAY_TYPE_OPTIONS
      },
      {
        label: `Type`,
        value: fieldInfo.type || ``,
        id: `type`,
        options: DDS_TYPE_OPTIONS
      },
      { label: `Length`, value: fieldInfo.length ?? 0, id: `length` },
      { label: `Decimals`, value: fieldInfo.decimals ?? 0, id: `decimals` },
      { label: `Value`, value: fieldInfo.value ?? ``, id: `value` },
      { label: `Position`, value: `${fieldInfo.position.x}, ${fieldInfo.position.y}` },
      {
        label: `Ind 1`,
        value: fieldInfo.conditions?.[0] ? `${fieldInfo.conditions[0].negate ? `N` : ``}${fieldInfo.conditions[0].indicator}` : ``,
        id: `cond1`
      },
      {
        label: `Ind 2`,
        value: fieldInfo.conditions?.[1] ? `${fieldInfo.conditions[1].negate ? `N` : ``}${fieldInfo.conditions[1].indicator}` : ``,
        id: `cond2`
      },
      {
        label: `Ind 3`,
        value: fieldInfo.conditions?.[2] ? `${fieldInfo.conditions[2].negate ? `N` : ``}${fieldInfo.conditions[2].indicator}` : ``,
        id: `cond3`
      }
    ];
    if (fieldInfo.isReference || fieldInfo.reference || (fieldInfo.type || ``).toUpperCase() === `R`) {
      properties.push({
        label: `Reference`,
        value: fieldInfo.reference || ``,
        id: `reference`
      });
    }
    const sections = [
      {
        title: `Properties`,
        open: true,
        html: createValuesPanel(`properties-${fieldInfo.name || `field`}`, properties, (newProps) => {
          const next = normalizeFieldProps(fieldInfo, newProps);
          onUpdate(next);
        })
      },
      {
        title: `Keywords`,
        open: (fieldInfo.keywords || []).length > 0,
        html: createKeywordPanel(`keywords-${fieldInfo.name || `field`}`, fieldInfo.keywords || [], (keywords) => {
          onUpdate({ ...fieldInfo, keywords });
        }, `field`)
      }
    ];
    renderSections(sidebar, sections);
    const deleteButton = document.createElement(`vscode-button`);
    deleteButton.setAttribute(`secondary`, `true`);
    deleteButton.innerText = `Delete`;
    deleteButton.style.margin = `1em`;
    deleteButton.style.display = `block`;
    deleteButton.addEventListener(`click`, onDelete);
    sidebar.appendChild(deleteButton);
  }

  // webui/src/vscodeApi.js
  var vscode = acquireVsCodeApi();

  // webui/src/hostDialogs.js
  var pending = /* @__PURE__ */ new Map();
  var nextId = 1;
  function resolveHostDialog(requestId, value) {
    const resolve = pending.get(requestId);
    if (!resolve) {
      return;
    }
    pending.delete(requestId);
    resolve(value);
  }
  function requestHostInput(opts) {
    const requestId = String(nextId++);
    return new Promise((resolve) => {
      pending.set(requestId, resolve);
      vscode.postMessage({
        command: `requestInput`,
        requestId,
        title: opts.title,
        value: opts.value,
        prompt: opts.prompt,
        validate: opts.validate
      });
    });
  }
  function requestHostConfirm(opts) {
    const requestId = String(nextId++);
    return new Promise((resolve) => {
      pending.set(requestId, resolve);
      vscode.postMessage({
        command: `requestConfirm`,
        requestId,
        message: opts.message,
        confirmLabel: opts.confirmLabel
      });
    });
  }
  function showHostError(message) {
    vscode.postMessage({ command: `showError`, message });
  }

  // webui/src/a11y.js
  function announce(message) {
    const el = document.getElementById(`srStatus`);
    if (!el) {
      return;
    }
    el.textContent = ``;
    requestAnimationFrame(() => {
      el.textContent = message || ``;
    });
  }

  // webui/src/renderer.js
  var activeDocument = void 0;
  var activeDocumentType = `dds.dspf`;
  var lastSelectedFormat = void 0;
  var existingStage = void 0;
  var fieldLayer = void 0;
  var rulerLayer = void 0;
  var selectedItems = [];
  var clipboard = [];
  var overlayFormats = [];
  var screenSizeOverride = void 0;
  var editorMode = `design`;
  var connectionConnected = true;
  var renderCols = 80;
  var renderRows = 24;
  var pendingSelectionNames = [];
  var suppressNextBgClick = false;
  var activeWindowOrigin = void 0;
  var marqueeWindowCleanup = void 0;
  var formatTabMenuCleanup = void 0;
  function loadDDS(newDoc, type, withRerender = true, opts = {}) {
    const prevSelection = selectedItems.map((s) => s.field.name).filter(Boolean);
    activeDocument = newDoc;
    activeDocumentType = type || `dds.dspf`;
    if (withRerender) {
      if (opts.restoreSelection) {
        pendingSelectionNames = prevSelection;
      }
      const validFormats = activeDocument.formats.filter((format) => format.name !== GLOBAL_RECORD_FORMAT);
      setTabs(validFormats.map((format) => format.name), lastSelectedFormat);
      const chosenFormat = lastSelectedFormat || (validFormats[0] ? validFormats[0].name : void 0);
      if (chosenFormat) {
        setWindowForFormat(chosenFormat);
      }
    }
  }
  function getEditorMode() {
    return editorMode;
  }
  function requestShowSource() {
    vscode.postMessage({ command: `showSource` });
  }
  function setConnectionConnected(connected) {
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
  function setEditorMode(mode) {
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
  function setScreenSize(cols, rows) {
    if (cols == null || rows == null) {
      screenSizeOverride = void 0;
    } else {
      screenSizeOverride = { cols, rows };
    }
    if (lastSelectedFormat) {
      setWindowForFormat(lastSelectedFormat);
    }
  }
  function refreshCanvas() {
    if (lastSelectedFormat) {
      setWindowForFormat(lastSelectedFormat);
    }
  }
  function screenToFieldPosition(screenX, screenY, opts = {}) {
    let x = screenX;
    let y = screenY;
    if (activeWindowOrigin?.originX != null && activeWindowOrigin?.originY != null) {
      x = screenX - (activeWindowOrigin.originX - 1);
      y = screenY - (activeWindowOrigin.originY - 1);
      const maxX = activeWindowOrigin.baseWidth || renderCols;
      const maxY = activeWindowOrigin.baseHeight || renderRows;
      x = Math.min(Math.max(1, x), maxX);
      y = Math.min(Math.max(1, y), maxY);
    } else {
      x = Math.min(Math.max(1, x), renderCols);
      y = Math.min(Math.max(1, y), renderRows);
    }
    if (opts.wasY0) {
      y = 0;
    }
    return { x, y };
  }
  function setWindowForFormat(chosenFormat) {
    let cols = 80;
    let rows = 24;
    const formatChanged = chosenFormat !== lastSelectedFormat;
    suppressNextBgClick = false;
    if (marqueeWindowCleanup) {
      marqueeWindowCleanup();
      marqueeWindowCleanup = void 0;
    }
    activeWindowOrigin = void 0;
    const globalFormat = activeDocument.formats.find((f) => f.name === GLOBAL_RECORD_FORMAT || f.name === `GLOBAL`);
    const selectedFormat = activeDocument.formats.find((f) => f.name === chosenFormat);
    if (!selectedFormat) {
      console.error(`Format ${chosenFormat} not found`);
      return;
    }
    if (screenSizeOverride) {
      cols = screenSizeOverride.cols;
      rows = screenSizeOverride.rows;
    } else if (activeDocumentType === `dds.dspf` && globalFormat) {
      const displaySize = globalFormat.keywords.find((keyword) => keyword.name === `DSPSIZ`);
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
    clearSelection(false);
    if (existingStage) {
      existingStage.destroy();
    }
    existingStage = new Konva.Stage({
      container: "container",
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
    bg.on("pointerclick", (e) => {
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
    let marquee;
    let marqueeStart;
    let marqueeMoved = false;
    const endMarquee = () => {
      if (!marquee || !marqueeStart) {
        if (marqueeWindowCleanup) {
          marqueeWindowCleanup();
          marqueeWindowCleanup = void 0;
        }
        return;
      }
      const box = marquee.getClientRect();
      const wasMarquee = marqueeMoved;
      marquee.destroy();
      marquee = void 0;
      marqueeStart = void 0;
      marqueeMoved = false;
      if (marqueeWindowCleanup) {
        marqueeWindowCleanup();
        marqueeWindowCleanup = void 0;
      }
      if (!wasMarquee || box.width < 4 && box.height < 4) {
        suppressNextBgClick = false;
        return;
      }
      suppressNextBgClick = true;
      setTimeout(() => {
        suppressNextBgClick = false;
      }, 300);
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
    bg.on("mousedown", (e) => {
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
        listening: false
      });
      fieldLayer.add(marquee);
      const onWinUp = () => endMarquee();
      window.addEventListener(`mouseup`, onWinUp, { once: true });
      marqueeWindowCleanup = () => window.removeEventListener(`mouseup`, onWinUp);
    });
    existingStage.on("mousemove", () => {
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
      field.position = screenToFieldPosition(screen.x, screen.y);
      sendNewField(lastSelectedFormat, field);
    };
    fieldLayer.add(bg);
    overlayFormats = overlayFormats.filter((n) => n !== selectedFormat.name);
    for (const name of overlayFormats) {
      const fmt = activeDocument.formats.find((f) => f.name === name);
      if (fmt) {
        renderSelectedFormat(fieldLayer, fmt, true);
      }
    }
    renderSelectedFormat(fieldLayer, selectedFormat, false);
    existingStage.add(fieldLayer);
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
    const globalForSidebar = activeDocument.formats.find((f) => f.name === GLOBAL_RECORD_FORMAT);
    updateRecordFormatSidebar(
      selectedFormat,
      globalForSidebar,
      activeDocument.formats,
      overlayFormats,
      editorMode === `design` ? (keywords) => sendFormatHeaderUpdate(selectedFormat.name, keywords) : void 0,
      (next) => {
        overlayFormats = next;
        setWindowForFormat(chosenFormat);
      },
      editorMode === `design` ? (keywords) => sendFormatHeaderUpdate(GLOBAL_RECORD_FORMAT, keywords) : void 0,
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
      names.forEach((name) => {
        const field = findFieldByName(name);
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
  function drawRulers(layer, cols, rows) {
    const totalW = widthInP(cols) + RULER_LEFT;
    const totalH = heightInP(rows) + RULER_TOP;
    layer.add(new Konva.Rect({
      x: 0,
      y: 0,
      width: totalW,
      height: RULER_TOP,
      fill: `#2d2d2d`
    }));
    layer.add(new Konva.Rect({
      x: 0,
      y: 0,
      width: RULER_LEFT,
      height: totalH,
      fill: `#2d2d2d`
    }));
    for (let c = 1; c <= cols; c++) {
      const x = RULER_LEFT + widthInP(c - 1);
      if (c === 1 || c % 10 === 0) {
        layer.add(new Konva.Text({
          x,
          y: 2,
          text: String(c),
          fontSize: 9,
          fill: `#ccc`,
          fontFamily: `monospace`
        }));
      }
      layer.add(new Konva.Line({
        points: [x, RULER_TOP - (c % 5 === 0 ? 8 : 4), x, RULER_TOP],
        stroke: `#888`,
        strokeWidth: 1
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
          fontFamily: `monospace`
        }));
      }
      layer.add(new Konva.Line({
        points: [RULER_LEFT - (r % 5 === 0 ? 8 : 4), y, RULER_LEFT, y],
        stroke: `#888`,
        strokeWidth: 1
      }));
    }
  }
  function renderSelectedFormat(layer, format, displayOnly) {
    if (!displayOnly) {
      lastSelectedFormat = format.name;
    }
    let windowFormat;
    let windowConfig;
    let windowTitle;
    if (format.isWindow) {
      if (format.windowReference) {
        windowFormat = activeDocument.formats.find((f) => f.name === format.windowReference);
      } else {
        windowFormat = format;
      }
      const { x, y, width, height } = windowFormat.windowSize;
      windowConfig = {
        baseX: x,
        baseY: y,
        baseWidth: width,
        baseHeight: height,
        // Align with field grid: 1-based row/col → pixel offset via (n-1)
        x: RULER_LEFT + widthInP(Math.max(1, x) - 1),
        y: RULER_TOP + heightInP(Math.max(1, y) - 1),
        width: widthInP(width),
        height: heightInP(height),
        originX: x,
        originY: y
      };
      const borderInfo = windowFormat.keywords.find((k) => k.name === `WDWBORDER`);
      if (borderInfo) {
        const parts = parseParms(borderInfo.value);
        parts.forEach((part, index) => {
          if (part.toUpperCase() === `*COLOR`) {
            windowConfig.color = parts[index + 1];
          }
        });
      }
      const windowInfo = windowFormat.keywords.find((k) => k.name === `WDWTITLE`);
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
          startRange: -1
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
        if (!windowTitle.keywords.find((k) => k.name === `COLOR`)) {
          windowTitle.keywords.push({ name: `COLOR`, value: `BLU`, conditions: [] });
        }
        const txtLength = (windowTitle.value || ``).length;
        const yPosition = yPositionValue === `top` ? windowConfig.baseY : windowConfig.baseY + windowConfig.baseHeight - 1;
        let xPosition = windowConfig.baseX + 1;
        switch (xPositionValue) {
          case `center`:
            xPosition = windowConfig.baseX + 1 + Math.floor(windowConfig.baseWidth / 2 - txtLength / 2);
            break;
          case `right`:
            xPosition = windowConfig.baseX + 1 + windowConfig.baseWidth - txtLength;
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
        baseHeight: windowConfig.baseHeight
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
        draggable: false
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
              y: Math.max(minY, Math.min(pos.y, RULER_TOP + heightInP(renderRows) - 10))
            };
          }
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
        const titleEl = getElement(windowTitle, true);
        if (titleEl) {
          layer.add(titleEl);
        }
      }
      if (windowFormat.name !== format.name) {
        addFieldsToLayer(layer, windowFormat, true, windowConfig);
      }
    } else if (!displayOnly) {
      activeWindowOrigin = void 0;
    }
    addFieldsToLayer(layer, format, displayOnly, format.isWindow ? windowConfig : void 0);
  }
  function addFieldsToLayer(layer, format, displayOnly, windowOrigin) {
    const subfileFormat = format.keywords.find((k) => k.name === `SFLCTL`);
    const hasSflDsp = format.keywords.some((k) => k.name === `SFLDSP` || k.name === `SFLDSPCTL`);
    const sflClr = format.keywords.some((k) => k.name === `SFLCLR`);
    const showSubfile = subfileFormat && (!sflClr || hasSflDsp || format.keywords.some((k) => k.name === `SFLPAG`));
    if (showSubfile) {
      const subfilePage = format.keywords.find((k) => k.name === `SFLPAG`);
      const sflsiz = format.keywords.find((k) => k.name === `SFLSIZ`);
      const rows = Number(subfilePage ? subfilePage.value : sflsiz ? Math.min(Number(sflsiz.value), 10) : 1);
      const subfileRecord = activeDocument.formats.find((f) => f.name === subfileFormat.value);
      if (subfileRecord) {
        const subfileFields = subfileRecord.fields.filter(
          (f) => f.displayType !== `hidden` && f.position.x > 0 && f.position.y > 0
        );
        const headerConsts = format.fields.filter((f) => f.displayType === `const`);
        headerConsts.forEach((field) => {
          if (conditionsPass(field.conditions, activeIndicators) || editorMode === `design`) {
            const content = getElement(field, true, windowOrigin);
            if (content) {
              layer.add(content);
            }
          }
        });
        let linesPerItem = 1;
        if (subfileFields.length > 0) {
          const low = Math.min(...subfileFields.map((f) => f.position.y));
          const high = Math.max(...subfileFields.map((f) => f.position.y));
          linesPerItem = high - low + 1;
          for (let row = 0; row < rows; row++) {
            subfileFields.forEach((field) => {
              if (!conditionsPass(field.conditions, activeIndicators) && editorMode === `preview`) {
                return;
              }
              let subField = JSON.parse(JSON.stringify(field));
              subField.position.y += row * linesPerItem;
              subField.name = `${field.name}_${row}`;
              const content = getElement(subField, true, windowOrigin);
              if (content) {
                layer.add(content);
              }
            });
          }
        }
        if (format.keywords.some((k) => k.name === `SFLEND`)) {
          const maxY = Math.max(
            ...format.fields.filter((f) => f.position.y > 0).map((f) => f.position.y),
            1
          );
          const localWidth = windowOrigin?.baseWidth || renderCols;
          const endField = {
            name: `SFLEND_MARK`,
            displayType: `const`,
            value: `More...`,
            position: { x: Math.max(1, localWidth - 8), y: maxY + rows * linesPerItem },
            length: 7,
            decimals: 0,
            keywords: [{ name: `COLOR`, value: `BLU`, conditions: [] }],
            conditions: [],
            startRange: -1
          };
          const el = getElement(endField, true, windowOrigin);
          if (el) {
            layer.add(el);
          }
        }
      }
    }
    const fields = format.fields.filter((field) => field.displayType !== `hidden`);
    const skipConsts = showSubfile;
    fields.forEach((field) => {
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
  function getElement(fieldInfo, displayOnly = false, windowOrigin = void 0) {
    const keywords = fieldInfo.keywords || [];
    const effectiveKeywords = keywords.filter((k) => {
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
      draggable: !displayOnly && editsAllowed() && fieldInfo.position.y !== 0
    };
    const labelInfo = {
      value: fieldInfo.value || ``,
      colour: colours.GRN,
      fontStyle: `normal`,
      textDecoration: ``,
      opacity: 1
    };
    let isProtected = false;
    effectiveKeywords.forEach((keyword) => {
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
        case `DATE`: {
          const dateSep = effectiveKeywords.find((k) => k.name === `DATSEP`);
          const dateFormat = effectiveKeywords.find((k) => k.name === `DATFMT`);
          if (dateFormat) {
            labelInfo.value = dateFormats[dateFormat.value] || `?FORMAT?`;
            if (dateSep && dateSep.value.toUpperCase() !== `*JOB`) {
              labelInfo.value = labelInfo.value.replace(new RegExp(`[./-:]`, `g`), dateSep.value);
            }
          } else {
            labelInfo.value = dateFormats[`*ISO`];
          }
          break;
        }
        case `TIME`: {
          const sep = effectiveKeywords.find((k) => k.name === `TIMSEP`);
          const format = effectiveKeywords.find((k) => k.name === `TIMFMT`);
          if (format) {
            labelInfo.value = timeFormats[format.value] || `?FORMAT?`;
            if (sep && sep.value.toUpperCase() !== `*JOB`) {
              labelInfo.value = labelInfo.value.replace(new RegExp(`[./-:]`, `g`), sep.value);
            }
          } else {
            labelInfo.value = timeFormats[`*HMS`];
          }
          break;
        }
        case `UNDERLINE`:
          labelInfo.textDecoration = `underline`;
          break;
        case `HIGHLIGHT`:
          labelInfo.fontStyle = `bold`;
          break;
        case `DSPATR`:
          (keyword.value || ``).split(` `).forEach((value) => {
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
    const edtcde = effectiveKeywords.find((k) => k.name === `EDTCDE`);
    const edtwrd = effectiveKeywords.find((k) => k.name === `EDTWRD`);
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
          case `input`:
            padString = `I`;
            break;
          case `output`:
            padString = `O`;
            break;
          case `both`:
            padString = `B`;
            break;
        }
        break;
      case `decimal`:
        switch (fieldInfo.displayType) {
          case `input`:
            padString = `3`;
            break;
          case `output`:
            padString = `6`;
            break;
          case `both`:
            padString = `9`;
            break;
        }
        break;
    }
    if (fieldInfo.isReference && !labelInfo.value) {
      labelInfo.value = ``;
      padString = `R`;
    }
    const effectiveLength = fieldInfo.length > 0 ? fieldInfo.length : fieldInfo.resolvedLength && fieldInfo.resolvedLength > 0 ? fieldInfo.resolvedLength : 0;
    const displayLength = effectiveLength > 0 && labelInfo.value.length < effectiveLength ? effectiveLength : Math.max(labelInfo.value.length, 1);
    const displayValue = String(labelInfo.value).replace(new RegExp(`''`, `g`), `'`).padEnd(displayLength, padString);
    boxInfo.width = widthInP(displayLength);
    if (isProtected && editorMode === `preview`) {
      labelInfo.colour = PROTECT_COLOUR;
      labelInfo.opacity = 0.7;
    }
    let group = new Konva.Group(boxInfo);
    group.on("dragmove", (e) => {
      const cGroup = e.target;
      const boxPos = cGroup.absolutePosition();
      let snapped = snapToFixedGrid(boxPos.x - RULER_LEFT, boxPos.y - RULER_TOP);
      snapped = {
        x: Math.min(Math.max(0, snapped.x), widthInP(renderCols - 1)),
        y: Math.min(Math.max(0, snapped.y), heightInP(renderRows - 1))
      };
      cGroup.absolutePosition({
        x: snapped.x + RULER_LEFT,
        y: snapped.y + RULER_TOP
      });
    });
    group.on(`dragend`, (e) => {
      const cGroup = e.target;
      const boxPos = cGroup.absolutePosition();
      let snapped = snapToFixedGrid(boxPos.x - RULER_LEFT, boxPos.y - RULER_TOP);
      snapped = {
        x: Math.min(Math.max(0, snapped.x), widthInP(renderCols - 1)),
        y: Math.min(Math.max(0, snapped.y), heightInP(renderRows - 1))
      };
      cGroup.absolutePosition({
        x: snapped.x + RULER_LEFT,
        y: snapped.y + RULER_TOP
      });
      const screen = gridCordsToFieldCords(snapped.x, snapped.y);
      const newPos = screenToFieldPosition(screen.x, screen.y, { wasY0: fieldInfo.position.y === 0 });
      const dx = newPos.x - fieldInfo.position.x;
      const dy = fieldInfo.position.y === 0 ? 0 : newPos.y - fieldInfo.position.y;
      const moving = selectedItems.some((s) => s.field.name === fieldInfo.name) && selectedItems.length > 1 ? selectedItems : [{ group: cGroup, field: fieldInfo }];
      const updates = moving.map(({ field }) => ({
        originalFieldName: field.name,
        fieldInfo: {
          ...field,
          position: {
            x: Math.max(1, field.position.x + dx),
            y: field.position.y === 0 ? 0 : Math.max(1, field.position.y + dy)
          }
        }
      }));
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
      fill: colours.BLK,
      x: 0,
      y: 0,
      width: boxInfo.width,
      height: pxhPerChar
    }));
    group.add(new Konva.Text({
      text: displayValue,
      fontSize: 14,
      fontFamily: `Consolas, "Liberation Mono", Menlo, Courier, monospace`,
      fill: labelInfo.colour,
      fontStyle: labelInfo.fontStyle,
      textDecoration: labelInfo.textDecoration,
      opacity: labelInfo.opacity
    }));
    if (!displayOnly) {
      group.on("pointerclick", (e) => {
        e.cancelBubble = true;
        if (e.evt.shiftKey) {
          toggleSelection(group, fieldInfo);
        } else {
          setActiveField(group, fieldInfo);
        }
      });
    }
    return group;
  }
  function findFieldByName(name) {
    if (!activeDocument || !lastSelectedFormat) {
      return void 0;
    }
    const format = activeDocument.formats.find((f) => f.name === lastSelectedFormat);
    return format?.fields.find((f) => f.name === name);
  }
  function clearSelection(updatePalette = true) {
    selectedItems.forEach(({ group }) => {
      const bg = group.findOne(`#bg`);
      if (bg) {
        bg.fill(colours.BLK);
      }
    });
    selectedItems = [];
    if (updatePalette) {
      updateSelectionUi();
    }
  }
  function updateSelectionUi(opts = {}) {
    if (selectedItems.length === 1) {
      const selected = selectedItems[0];
      const originalFieldName = selected.field.name;
      updateSelectedFieldSidebar(
        selected.field,
        (field) => sendFieldUpdate(lastSelectedFormat, originalFieldName, field),
        () => sendDelete(lastSelectedFormat, originalFieldName)
      );
      prependSelectionTools(document.getElementById(`fieldInfoSidebar`), false);
      if (!opts.silent) {
        announce(`Selected ${selected.field.name || `constant`} at row ${selected.field.position?.y}, column ${selected.field.position?.x}`);
      }
    } else if (selectedItems.length > 1) {
      const sidebar = document.getElementById(`fieldInfoSidebar`);
      sidebar.innerHTML = ``;
      const count = document.createElement(`div`);
      count.style.padding = `1em`;
      count.innerText = `${selectedItems.length} fields selected`;
      sidebar.appendChild(count);
      prependSelectionTools(sidebar, true);
      if (!opts.silent) {
        announce(`${selectedItems.length} fields selected`);
      }
    } else if (editorMode === `design`) {
      openDesignPalette();
    } else {
      const sidebar = document.getElementById(`fieldInfoSidebar`);
      if (sidebar) {
        sidebar.innerHTML = `<div style="padding:1em;opacity:0.7">Preview mode (read-only)</div>`;
      }
    }
  }
  function prependSelectionTools(sidebar, multi) {
    if (!sidebar || !editsAllowed()) {
      return;
    }
    const tools = document.createElement(`div`);
    tools.className = `selection-tools`;
    const alignRow = document.createElement(`div`);
    alignRow.className = `selection-tools-row`;
    const aligns = [
      [`Left`, `left`],
      [`Center`, `center`],
      [`Right`, `right`],
      [`Top`, `top`]
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
    colorSelect.className = `prop-select`;
    colorSelect.innerHTML = `<option value="">COLOR\u2026</option>`;
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
      btn.onclick = () => applyKeywordToSelection(`DSPATR`, atr, true);
      colorRow.appendChild(btn);
    }
    tools.appendChild(colorRow);
    sidebar.insertBefore(tools, sidebar.firstChild);
  }
  function alignSelectedFields(mode) {
    if (!selectedItems.length || !editsAllowed()) {
      return;
    }
    const cols = activeWindowOrigin?.baseWidth || renderCols;
    const updates = [];
    if (mode === `center` && selectedItems.length === 1) {
      const item = selectedItems[0];
      const len = Math.max(1, item.field.length || String(item.field.value || ``).length || 1);
      const next = JSON.parse(JSON.stringify(item.field));
      next.position = { ...next.position, x: Math.max(1, Math.floor((cols - len) / 2) + 1) };
      updates.push({ originalFieldName: item.field.name, fieldInfo: next });
    } else if (mode === `left` || mode === `right` || mode === `top`) {
      const xs = selectedItems.map((s) => s.field.position.x);
      const ys = selectedItems.map((s) => s.field.position.y);
      const targetX = mode === `left` ? Math.min(...xs) : mode === `right` ? Math.max(...xs) : void 0;
      const targetY = mode === `top` ? Math.min(...ys) : void 0;
      for (const item of selectedItems) {
        const next = JSON.parse(JSON.stringify(item.field));
        if (targetX != null) {
          next.position.x = targetX;
        }
        if (targetY != null) {
          next.position.y = targetY;
        }
        updates.push({ originalFieldName: item.field.name, fieldInfo: next });
      }
    } else if (mode === `center` && selectedItems.length > 1) {
      for (const item of selectedItems) {
        const len = Math.max(1, item.field.length || String(item.field.value || ``).length || 1);
        const next = JSON.parse(JSON.stringify(item.field));
        next.position = { ...next.position, x: Math.max(1, Math.floor((cols - len) / 2) + 1) };
        updates.push({ originalFieldName: item.field.name, fieldInfo: next });
      }
    }
    if (updates.length === 1) {
      sendFieldUpdate(lastSelectedFormat, updates[0].originalFieldName, updates[0].fieldInfo);
    } else if (updates.length > 1) {
      sendFieldsUpdate(lastSelectedFormat, updates);
    }
  }
  function applyKeywordToSelection(name, value, mergeMulti) {
    if (!selectedItems.length || !editsAllowed()) {
      return;
    }
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
  function addToSelection(group, fieldInfo, updateUi = true) {
    if (selectedItems.some((s) => s.field.name === fieldInfo.name)) {
      return;
    }
    selectedItems.push({ group, field: fieldInfo });
    const bg = group.findOne(`#bg`);
    if (bg) {
      bg.fill(SELECTED_COLOUR);
    }
    if (updateUi) {
      updateSelectionUi();
    }
  }
  function toggleSelection(group, fieldInfo) {
    const idx = selectedItems.findIndex((s) => s.field.name === fieldInfo.name);
    if (idx >= 0) {
      const bg = selectedItems[idx].group.findOne(`#bg`);
      if (bg) {
        bg.fill(colours.BLK);
      }
      selectedItems.splice(idx, 1);
      updateSelectionUi();
    } else {
      addToSelection(group, fieldInfo);
    }
  }
  function setActiveField(konvaElement, fieldInfo) {
    clearKeywordEditor();
    clearSelection(false);
    if (konvaElement && fieldInfo) {
      addToSelection(konvaElement, fieldInfo);
    } else {
      updateSelectionUi();
    }
  }
  function setTabs(recordFormats, setActiveTab) {
    const tabs = document.getElementById(`recordFormatTabs`);
    if (!tabs) {
      return;
    }
    const active = setActiveTab && recordFormats.includes(setActiveTab) ? setActiveTab : recordFormats.includes(lastSelectedFormat) ? lastSelectedFormat : recordFormats[0];
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
  function syncFormatTabActive(formatName) {
    const tabs = document.getElementById(`recordFormatTabs`);
    if (!tabs || !formatName) {
      return;
    }
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
  function activateFormatTab(formatName) {
    if (!formatName || formatName === lastSelectedFormat) {
      return;
    }
    overlayFormats = [];
    clearAllIndicators();
    clearKeywordEditor();
    setWindowForFormat(formatName);
  }
  function setupTabsHandler() {
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
  function showFormatTabMenu(x, y, formatName) {
    if (formatTabMenuCleanup) {
      formatTabMenuCleanup();
      formatTabMenuCleanup = void 0;
    }
    document.getElementById(`formatTabMenu`)?.remove();
    const menu = document.createElement(`div`);
    menu.id = `formatTabMenu`;
    menu.className = `format-tab-menu`;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    const addItem = (label, onClick) => {
      const item = document.createElement(`button`);
      item.type = `button`;
      item.className = `format-tab-menu-item`;
      item.textContent = label;
      item.onclick = () => {
        if (formatTabMenuCleanup) {
          formatTabMenuCleanup();
          formatTabMenuCleanup = void 0;
        }
        menu.remove();
        onClick();
      };
      menu.appendChild(item);
    };
    addItem(`Rename\u2026`, async () => {
      const next = await requestHostInput({
        title: `Rename record format`,
        value: formatName,
        prompt: `New name for ${formatName}`,
        validate: `recordName`
      });
      if (!next) {
        return;
      }
      const name = next.trim().toUpperCase();
      if (name === formatName.toUpperCase()) {
        return;
      }
      if (!isValidRecordName2(name)) {
        showHostError(`Invalid record name. Use 1\u201310 characters: A\u2013Z, 0\u20139, @, #, $.`);
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
    addItem(`Copy\u2026`, async () => {
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
        validate: `recordName`
      });
      if (!next) {
        return;
      }
      const name = next.trim().toUpperCase();
      if (!isValidRecordName2(name)) {
        showHostError(`Invalid record name. Use 1\u201310 characters: A\u2013Z, 0\u20139, @, #, $.`);
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
        confirmLabel: `Delete`
      });
      if (!confirmed) {
        return;
      }
      const others = (activeDocument?.formats || []).map((f) => f.name).filter((n) => n && n !== GLOBAL_RECORD_FORMAT && n !== formatName);
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
      formatTabMenuCleanup = void 0;
    };
    formatTabMenuCleanup = () => {
      menu.remove();
      document.removeEventListener(`mousedown`, close, true);
      formatTabMenuCleanup = void 0;
    };
    setTimeout(() => document.addEventListener(`mousedown`, close, true), 0);
  }
  var EDITING_VSCODE_TAGS = /* @__PURE__ */ new Set([
    `vscode-textfield`,
    `vscode-textarea`,
    `vscode-single-select`,
    `vscode-multi-select`,
    `vscode-checkbox`
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
  var nudgeTimer = void 0;
  var pendingNudge = void 0;
  function flushPendingNudge() {
    if (nudgeTimer) {
      clearTimeout(nudgeTimer);
      nudgeTimer = void 0;
    }
    if (!pendingNudge) {
      return;
    }
    const { recordFormat, updates } = pendingNudge;
    pendingNudge = void 0;
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
  function scheduleNudgeUpdate(recordFormat, updates) {
    pendingNudge = { recordFormat, updates };
    if (nudgeTimer) {
      clearTimeout(nudgeTimer);
    }
    nudgeTimer = setTimeout(() => {
      nudgeTimer = void 0;
      flushPendingNudge();
    }, 60);
  }
  function setupKeyboard() {
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
          clearSelection(true);
          document.getElementById(`container`)?.focus();
          announce(`Selection cleared`);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === `c`) {
        if (selectedItems.length > 0) {
          clipboard = selectedItems.map((s) => JSON.parse(JSON.stringify(s.field)));
          e.preventDefault();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === `v`) {
        if (clipboard.length > 0 && lastSelectedFormat) {
          const format = activeDocument.formats.find((f) => f.name === lastSelectedFormat);
          const existing = new Set((format?.fields || []).map((f) => f.name));
          const fields = clipboard.map((field) => {
            const copy = JSON.parse(JSON.stringify(field));
            copy.position = { x: field.position.x, y: Math.min(renderRows, field.position.y + 1) };
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
        const focusInCanvas = container && (document.activeElement === container || container.contains(document.activeElement));
        if (!focusInCanvas) {
          return;
        }
        const selectFirst = e.key === `Enter` || e.key === `Tab` || e.key === `ArrowLeft` || e.key === `ArrowRight` || e.key === `ArrowUp` || e.key === `ArrowDown`;
        if (!selectFirst) {
          return;
        }
        e.preventDefault();
        selectFirstVisibleField();
        return;
      }
      if (e.key === `Delete` || e.key === `Backspace`) {
        const names = selectedItems.map((s) => s.field.name).filter(Boolean);
        if (names.length === 1) {
          sendDelete(lastSelectedFormat, names[0]);
        } else if (names.length > 1) {
          void (async () => {
            const confirmed = await requestHostConfirm({
              message: `Delete ${names.length} selected fields?`,
              confirmLabel: `Delete`
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
        const format = activeDocument.formats.find((f) => f.name === lastSelectedFormat);
        if (!format) {
          return;
        }
        const visible = format.fields.filter((f) => f.displayType !== `hidden`);
        if (visible.length === 0) {
          return;
        }
        const currentName = selectedItems[0]?.field.name;
        let idx = visible.findIndex((f) => f.name === currentName);
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
        case `ArrowLeft`:
          dx = -step;
          break;
        case `ArrowRight`:
          dx = step;
          break;
        case `ArrowUp`:
          dy = -step;
          break;
        case `ArrowDown`:
          dy = step;
          break;
        default:
          return;
      }
      e.preventDefault();
      const updates = selectedItems.map(({ field, group }) => {
        const nextPos = {
          x: Math.min(renderCols, Math.max(1, field.position.x + dx)),
          y: Math.min(renderRows, Math.max(1, field.position.y + dy))
        };
        field.position = nextPos;
        if (group) {
          group.absolutePosition({
            x: (nextPos.x - 1) * pxwPerChar + RULER_LEFT,
            y: (nextPos.y - 1) * pxhPerLine + RULER_TOP
          });
        }
        return {
          originalFieldName: field.name,
          fieldInfo: { ...field, position: { ...nextPos } }
        };
      });
      fieldLayer?.batchDraw();
      scheduleNudgeUpdate(lastSelectedFormat, updates);
    });
  }
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
        sidebar.innerHTML = connectionConnected ? `<div style="padding:1em;opacity:0.7">Preview mode (read-only)</div>` : `<div style="padding:1em;opacity:0.7">Disconnected \u2014 editing unavailable</div>`;
      }
      return;
    }
    const existingNames = (activeDocument?.formats || []).map((f) => f.name).filter((n) => n && n !== GLOBAL_RECORD_FORMAT);
    showFieldPalette(
      (field) => sendNewField(lastSelectedFormat, field),
      {
        existingNames,
        onCreateRecord: (request) => sendNewFormats(request.formats, request.selectFormat),
        onBrowseDatabase: () => {
          vscode.postMessage({ command: `browseDatabaseFields` });
        }
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
      selectFormat
    });
  }
  function handleDatabaseFieldsResult(payload) {
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
    hint.innerText = `${payload.library}/${payload.file} \u2014 select fields, usage, and heading placement.`;
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
      [`above`, `Heading above (SDA &C)`]
    ]) {
      const o = document.createElement(`option`);
      o.value = v;
      o.textContent = l;
      placeSelect.appendChild(o);
    }
    sidebar.appendChild(placeSelect);
    const picked = /* @__PURE__ */ new Set();
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
      const fields = [];
      const reffldSuffix = payload.library && payload.file ? ` ${payload.library}/${payload.file}` : ``;
      for (const f of selected) {
        const usage = (
          /** @type {any} */
          usageSelect.value || `both`
        );
        if (placeSelect.value === `left` && f.heading) {
          const label = String(f.heading).split(/\s+/).filter(Boolean).join(` `) || f.name;
          fields.push({
            value: `${label}:`,
            displayType: `const`,
            length: Math.min(30, label.length + 1),
            decimals: 0,
            position: { x: col, y: row },
            keywords: [],
            conditions: []
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
            conditions: []
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
            { name: `REFFLD`, value: `${f.name}${reffldSuffix}`.trim(), conditions: [] }
          ],
          conditions: [],
          startRange: 0
        });
        col = 2;
        row += placeSelect.value === `above` ? 2 : 1;
        if (row > renderRows - 1) {
          break;
        }
      }
      vscode.postMessage({
        command: `placeDatabaseFields`,
        recordFormat: lastSelectedFormat,
        fields
      });
    };
    actions.appendChild(cancel);
    actions.appendChild(place);
    sidebar.appendChild(actions);
  }

  // webui/src/main.js
  setIndicatorChangeHandler(() => refreshCanvas());
  window.addEventListener("message", (event) => {
    const command = event.data.command;
    const docType = event.data.documentType || `dds.dspf`;
    switch (command) {
      case `load`:
        loadDDS(event.data.dds, docType, true, { restoreSelection: false });
        break;
      case `update`:
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
          setScreenSize(void 0, void 0);
        } else if (val === `ds3`) {
          setScreenSize(80, 24);
        } else if (val === `ds4`) {
          setScreenSize(132, 27);
        }
      });
    }
  }
})();
//# sourceMappingURL=main.js.map
