# DDS display-file keyword reference

Short descriptions for keywords in the designer catalog (`webui/src/keywordCatalog.js`).
Sourced from the IBM i DDS for Display Files reference. Prefer the IBM docs for full syntax and rules.

The same blurbs appear in the keyword picker (`Name — description`) and in the editor help text.

## File

| Keyword | Description |
|---------|-------------|
| DSPSIZ | Display size (*DS3 24×80 or *DS4 27×132) |
| INDARA | Pass indicators in a separate indicator area |
| PRINT | Enable Print key for this file/record |
| HLPRTN | Return to application after Help is used |
| MSGLOC | Row where ERRMSG / status messages appear |
| INVITE | Invite device for read; used with multiple devices |
| ALWGPH | Allow graphics on the display |
| ALWROL | Allow roll/page keys to roll the display |
| CSRINPONLY | Cursor moves only among input-capable fields |
| CSRLOC | Program sets cursor row/column via named fields |
| DSPMOD | Switch display mode (*DS3 / *DS4) |
| ERRSFL | Show ERRMSG/ERRMSGID messages in an error subfile |
| KEEP | Keep display contents when the file is closed |
| LOCK | Keep keyboard locked after output; optional *ONLY |
| OPENPRT | Open the printer file used by PRINT |
| PASSRCD | Record format passed between shared open files |
| REF | Default database/reference file for REFFLD |
| USRDFN | User-defined data stream (no DDS layout) |
| WDWBORDER | Default window border color/attributes |
| CHGINPDFT | Change default input keyboard attributes |

## General (record / field)

| Keyword | Description |
|---------|-------------|
| OVERLAY | Write without clearing other records on the display |
| PUTOVR | Allow OVRATR/OVRDTA to override displayed fields |
| OVRATR | Override display attributes only (with PUTOVR) |
| OVRDTA | Override field data only (with PUTOVR) |
| PROTECT | Protect all input fields already on the display |
| CLRL | Clear lines before display (*NO, *END, *ALL, or line #) |
| SLNO | Starting line number for this record |
| ASSUME | Assume record is already on the display at open |
| FRCDTA | Force immediate display without waiting for next I/O |
| BLANKS | Set response indicator when field is all blanks |
| CHANGE | Set response indicator when data changes |
| INZRRN | Initialize subfile relative record number to 1 |
| RTNCSRLOC | Return cursor location (record and/or field names) |
| USRRSTDSP | User-restored display (app restores after help/etc.) |
| DATE | System date constant field |
| TIME | System time constant field |
| SYSNAME | System name constant field |
| USER | User profile name constant field |
| MSGID | Message constant from a message file |
| DFT | Default value shown until the user changes it |
| DFTVAL | Default value returned if the field is blank |
| REFFLD | Reference another field’s attributes |
| REFSHIFT | Keyboard shift for referenced field |
| LOWER | Allow lowercase entry (same as CHECK LC) |
| AUTO | Auto functions (right-adjust, field exit, …) |
| DUP | Allow Dup key to duplicate field data |
| PUTRETAIN | Retain displayed data on subsequent outputs |
| INZINP | Initialize input fields without always sending data |
| NOCCSID | Do not convert field data with CCSID |
| PMTCTL | Prompt control condition for conditional prompts |
| TEXT | Descriptive text for the file, record, or field |
| ALIAS | Alternative (long) name for high-level languages |
| HTML | HTML content associated with the field |

## Display

| Keyword | Description |
|---------|-------------|
| COLOR | Field color on a color display (GRN, WHT, RED, …) |
| DSPATR | Display attributes (HI, UL, RI, ND, PR, …) |
| ENTFLDATR | Attributes while the cursor is in this entry field |
| CHGINPDFT | Change default input keyboard attributes |

## Editing

| Keyword | Description |
|---------|-------------|
| EDTCDE | Edit code for numeric output formatting |
| EDTWRD | Custom edit word for numeric/date formatting |
| DATFMT | Date format (*ISO, *USA, *MDY, …) |
| DATSEP | Date separator character |
| TIMFMT | Time format (*ISO, *HMS, *USA, …) |
| TIMSEP | Time separator character |
| FLTFIXDEC | Display floating-point as fixed decimal |
| FLTPCN | Floating-point precision (*SINGLE / *DOUBLE) |

## Validity

| Keyword | Description |
|---------|-------------|
| CHECK | Input check / keyboard control (ME, MF, RB, LC, …) |
| COMP | Compare entered value (EQ, NE, GT, LT, …) |
| RANGE | Valid inclusive low–high range |
| VALUES | List of allowed values |
| MAPVAL | Map special values (*BLANK, *ZERO, …) |
| ERRMSG | Error message text when indicator is on |
| ERRMSGID | Error message ID from a message file |

## Subfile

| Keyword | Description |
|---------|-------------|
| SFL | Identify this record as a subfile record format |
| SFLCTL | Subfile control record; names the SFL record |
| SFLDSP | Display the subfile records |
| SFLDSPCTL | Display the subfile control record |
| SFLCLR | Clear all records from the subfile |
| SFLINZ | Initialize subfile with blank/default records |
| SFLEND | Show end-of-subfile / More… / scrollbar |
| SFLPAG | Number of subfile records per displayed page |
| SFLSIZ | Total subfile size (records in memory) |
| SFLMSG | Subfile message text (constant or msg file) |
| SFLMSGID | Subfile message from a message file |
| SFLMSGRCD | Message subfile record; line for first message |
| SFLMSGKEY | Message key field for a message subfile |
| SFLNXTCHG | Mark next changed records for READC |
| SFLRCDNBR | Subfile record number field / display position |
| SFLROLVAL | Number of records to roll for roll keys |
| SFLDROP | Fold/truncate mode; key to drop folded lines |
| SFLFOLD | Display folded (wrapped) subfile records |
| SFLENTER | Enter key selects subfile record (selection list) |

## Window

| Keyword | Description |
|---------|-------------|
| WINDOW | Define window position and size on the display |
| WDWTITLE | Window title text, color, and placement |
| WDWBORDER | Default window border color/attributes |

## Response

| Keyword | Description |
|---------|-------------|
| HELP | Enable Help key; optional response indicator |
| ROLLUP | Roll Up key response indicator |
| ROLLDOWN | Roll Down key response indicator |
| PAGEDOWN | Page Down key response indicator |
| PAGEUP | Page Up key response indicator |
| HOME | Home key response indicator |
| CLEAR | Clear key response indicator |
| CAnn | Command Attention key (no data returned) |
| CFnn | Command Function key (returns field data) |
| ALARM | Sound audible alarm when record is displayed |
| SETOF | Set off response indicators on output |
| RETKEY | Set indicator when Record Advance / Enter pressed |
| RETPAGE | Set indicator when Page key pressed |
| VLDCMDKEY | Set indicator when a valid command key is pressed |

## External reference

- [IBM i DDS for display files](https://www.ibm.com/docs/en/i/7.5?topic=files-dds-display)
