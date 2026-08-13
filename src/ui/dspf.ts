import type { Conditional, DisplayType, DdsLineRange, DdsUpdate, Keyword, PassthroughLine } from "../shared/dspf-types";
import { isValidRecordName as isValidRecordNameShared } from "../shared/recordName";

export type { Conditional, DisplayType, DdsLineRange, DdsUpdate, Keyword, PassthroughLine };

const GLOBAL_RECORD_NAME = `_GLOBAL`;
const NUMERIC_TYPES = new Set([`D`, `Z`, `Y`, `S`, `P`, `F`]);

/** Split document text into lines matching VS Code TextDocument line indexes (drop trailing empty from final EOL). */
export function splitDocumentLines(content: string): string[] {
  const lines = content.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === `` && content.match(/\r?\n$/)) {
    lines.pop();
  }
  return lines;
}

export class DisplayFile {
  public formats: RecordInfo[] = [];
  public currentField: FieldInfo | undefined;
  public currentFields: FieldInfo[] = [];
  public currentRecord: RecordInfo | undefined = new RecordInfo(GLOBAL_RECORD_NAME);
  /** Original source lines for round-trip / passthrough */
  public sourceLines: string[] = [];

  constructor() { }

  parse(lines: string[]) {
    this.sourceLines = [...lines];
    let textCounter = 0;

    let conditionals: string, name: string, len: string, type: string, dec: string, inout: string, x: string, y: string, keywords: string;

    lines.forEach((line, index) => {
      const originalLine = line;
      line = line.padEnd(80);

      // Preserve comments and blank lines as passthrough (not rewritten on field edits)
      if (line[6] === `*` || originalLine.trim() === ``) {
        if (this.currentRecord) {
          this.currentRecord.passthroughLines.push({ lineIndex: index, text: originalLine });
        }
        return;
      }

      conditionals = line.substring(6, 16).padEnd(10);
      name = line.substring(18, 28).trim();
      len = line.substring(29, 34).trim();
      type = line[34].toUpperCase().trim();
      dec = line.substring(35, 37).trim();
      inout = line[37].toUpperCase();
      y = line.substring(38, 41).trim();
      x = line.substring(41, 44).trim();
      keywords = line.substring(44).trimEnd();

      switch (line[16]) {
        case 'R':
          if (this.currentField) {
            this.currentField.endRange = index - 1;
            this.currentField.handleKeywords();
            this.currentFields.push(this.currentField);
          };
          if (this.currentRecord && this.currentFields) {
            this.currentRecord.fields = this.currentFields;
          }
          if (this.currentRecord) {
            this.currentRecord.range.end = index;
            this.currentRecord.handleKeywords();
            this.formats.push(this.currentRecord);
          }

          this.currentRecord = new RecordInfo(name);
          this.currentRecord.range.start = index;
          this.currentRecord.ownedHeaderLines = [index];

          this.currentFields = [];
          this.currentField = undefined;

          this.HandleKeywords(keywords, conditionals, index);
          break;

        case ' ':
          if ((x !== "" && y !== "") || inout === `H`) {
            if (this.currentField) {
              this.currentField.endRange = index - 1;
              this.currentField.handleKeywords();
              this.currentFields.push(this.currentField);
            }

            this.currentField = new FieldInfo(index);
            this.currentField.ownedLines = [index];
            this.currentField.position = {
              x: Number(x),
              y: Number(y)
            };
          } else if (x !== "" && y === "") {
            if (this.currentField) {
              this.currentField.endRange = index - 1;
              this.currentField.handleKeywords();
              this.currentFields.push(this.currentField);
            }

            let totalX = Number(x);
            if (x.startsWith(`+`)) {
              const prev = this.currentFields[this.currentFields.length - 1];
              if (prev) {
                totalX = prev.position.x + Number(x.substring(1));
                if (prev.value) {
                  totalX += prev.value.length;
                }
              } else {
                // First field in format with relative +n — treat as absolute from column 1
                totalX = Number(x.substring(1)) || 1;
              }
            }

            this.currentField = new FieldInfo(index);
            this.currentField.ownedLines = [index];
            this.currentField.position = {
              x: totalX,
              y: 0
            };
          } else if (name !== undefined && type !== "") {
            if (this.currentField) {
              this.currentField.endRange = index - 1;
              this.currentField.handleKeywords();
              this.currentFields.push(this.currentField);
            }

            this.currentField = new FieldInfo(index, name);
            this.currentField.ownedLines = [index];
            this.currentField.position = {
              x: -1,
              y: -1
            };
          }

          if (name !== "") {
            if (this.currentField) {
              this.currentField.name = name;
              this.currentField.value = "";
              // Leave length undefined when the DDS length column is blank so
              // re-emit does not invent `0` (which would corrupt cols 30-34).
              const parsedLen = len !== `` ? Number(len) : undefined;
              this.currentField.length = parsedLen !== undefined && !Number.isNaN(parsedLen)
                ? parsedLen
                : undefined;
              switch (inout) {
                case "I":
                  this.currentField.displayType = `input`;
                  break;
                case "B":
                  this.currentField.displayType = `both`;
                  break;
                case "H":
                  this.currentField.displayType = `hidden`;
                  break;
                case "M":
                  this.currentField.displayType = `message`;
                  break;
                case "P":
                  this.currentField.displayType = `program`;
                  break;
                case " ":
                case "O":
                  this.currentField.displayType = `output`;
                  break;
                default:
                  // Unknown usage — keep the raw col-38 char so emit never drops the line.
                  this.currentField.rawUsage = inout;
                  break;
              }

              this.currentField.type = type || undefined;

              if (type === `R`) {
                this.currentField.isReference = true;
                this.currentField.primitiveType = `char`;
              } else {
                this.currentField.decimals = 0;
                switch (type) {
                  case "D":
                  case "Z":
                  case "Y":
                  case "S":
                  case "P":
                    this.currentField.primitiveType = `decimal`;
                    if (dec !== "") { this.currentField.decimals = Number(dec); }
                    break;
                  case `L`: // Date data type (not the DATE keyword)
                    this.currentField.length = 8;
                    this.currentField.primitiveType = `char`;
                    break;
                  case `T`: // Time data type (not the TIME keyword)
                    this.currentField.length = 8;
                    this.currentField.primitiveType = `char`;
                    break;
                  default:
                    this.currentField.primitiveType = `char`;
                    break;
                }
              }

              this.currentField.conditions.push(
                ...DisplayFile.parseConditionals(conditionals)
              );
            }
            this.HandleKeywords(keywords, conditionals, index);
          }
          else {
            if (this.currentField) {
              if (!this.currentField.name) {
                textCounter++;
                this.currentField.name = `TEXT${textCounter}`;
                if (!this.currentField.value) { this.currentField.value = ""; }
                this.currentField.length = this.currentField.value.length;
                this.currentField.displayType = `const`;

                this.currentField.conditions.push(
                  ...DisplayFile.parseConditionals(conditionals)
                );
              }
            }
            this.HandleKeywords(keywords, conditionals, index);
          }
          break;

        default:
          // H / J / K / O (and any other non-blank col-17) are not modeled.
          // Keep them as passthrough so header/field rewrites cannot destroy them.
          if (this.currentRecord) {
            this.currentRecord.passthroughLines.push({ lineIndex: index, text: originalLine });
          }
          break;
      }
    });

    if (this.currentField) {
      this.currentField.endRange = lines.length - 1;
      this.currentField.handleKeywords();
      this.currentFields.push(this.currentField);
    };
    if (this.currentRecord) {
      if (this.currentFields) {
        this.currentRecord.fields = this.currentFields;
      }

      this.currentRecord.range.end = lines.length;
      this.currentRecord.handleKeywords();
      this.formats.push(this.currentRecord);
    }

    this.currentField = undefined;
    this.currentFields = [];
    this.currentRecord = undefined;
  }

  HandleKeywords(keywords: string, conditionals = ``, lineIndex?: number) {
    let insertIndex;

    if (this.currentField) {
      insertIndex = this.currentField.keywordStrings.keywordLines.push(keywords);
      this.currentField.keywordStrings.conditionalLines[insertIndex] = conditionals;
      this.currentField.endRange = (this.currentField.endRange ?? this.currentField.startRange);
      if (lineIndex !== undefined && !this.currentField.ownedLines.includes(lineIndex)) {
        // Only count as owned if this is a keyword continuation (not the definition line already added)
        if (lineIndex !== this.currentField.startRange) {
          this.currentField.ownedLines.push(lineIndex);
        }
      }
    } else if (this.currentRecord) {
      insertIndex = this.currentRecord.keywordStrings.keywordLines.push(keywords);
      this.currentRecord.keywordStrings.conditionalLines[insertIndex] = conditionals;
      if (lineIndex !== undefined && !this.currentRecord.ownedHeaderLines.includes(lineIndex)) {
        this.currentRecord.ownedHeaderLines.push(lineIndex);
      }
    }
  }

  /**
   * Parse indicator columns 7-16 (10 chars from line[6..15]).
   * IBM layout: col7 AND/OR (ignored for now), then up to three 3-char indicator slots.
   * Also accepts the legacy shifted layout used by older emitters.
   */
  static parseConditionals(conditionColumns: string): Conditional[] {
    if (conditionColumns.trim() === "") { return []; }

    const padded = conditionColumns.padEnd(10);
    const conditionals: Conditional[] = [];

    // Prefer IBM: skip col7 (AND/OR / space), read slots at 1,4,7 within the 10-char window
    // (absolute DDS cols 8-10, 11-13, 14-16 → indexes 1-3, 4-6, 7-9 in substring(6,16))
    const trySlots = (offsets: number[]) => {
      const found: Conditional[] = [];
      for (const cIndex of offsets) {
        const slot = padded.substring(cIndex, cIndex + 3);
        if (slot.trim() === "") {
          continue;
        }
        const negate = slot[0] === `N`;
        const indicator = Number(slot.substring(1, 3).trim());
        if (!Number.isNaN(indicator) && indicator > 0) {
          found.push({ indicator, negate });
        }
      }
      return found;
    };

    // IBM offsets within conditionColumns
    let found = trySlots([1, 4, 7]);
    // Legacy shifted emitter put first indicator at index 0 (col7): " 20      "
    if (found.length === 0) {
      found = trySlots([0, 3, 6]);
    }
    return found;
  }

  /**
   * Force a value into an exact DDS column width so overflow can never shift
   * subsequent columns. Truncates on the left for right-aligned numeric fields
   * (length / row / col) and on the right for left-aligned names.
   */
  static fitColumn(value: string | number | undefined | null, width: number, align: `left` | `right` = `left`, pad = ` `): string {
    const s = String(value ?? ``);
    if (s.length > width) {
      return align === `right` ? s.slice(s.length - width) : s.slice(0, width);
    }
    return align === `right` ? s.padStart(width, pad) : s.padEnd(width, pad);
  }

  /** Format one indicator as a 3-char IBM slot: " 05" or "N20" */
  static formatIndicatorSlot(c: Conditional): string {
    const num = DisplayFile.fitColumn(String(c.indicator), 2, `right`, `0`);
    return `${c.negate ? `N` : ` `}${num}`;
  }

  /** 9 chars after `A` covering cols 8-16 (col7 left as space via `A ` prefix). */
  static formatConditionString(conditions: Conditional[]): string {
    return DisplayFile.fitColumn(
      conditions
        .slice(0, 3)
        .map(c => DisplayFile.formatIndicatorSlot(c))
        .join(``),
      9,
      `left`,
    );
  }

  static parseKeywords(keywordStrings: string[], conditionalStrings?: { [line: number]: string }) {
    let result: { value: string, keywords: Keyword[], conditions: Conditional[] } = {
      value: ``,
      keywords: [],
      conditions: []
    };

    const newLineMark = `~`;
    let value = keywordStrings.join(newLineMark) + newLineMark;
    let conditionalLine = 1;

    if (value.length > 0) {
      value += ` `;

      let inBrackets = 0;
      let word = ``;
      let innerValue = ``;
      let inString = false;

      for (let i = 0; i < value.length; i++) {
        switch (value[i]) {
          case `+`:
          case `-`:
            if (value[i + 1] !== newLineMark) {
              innerValue += value[i];
            }
            break;

          case `'`:
            if (inBrackets > 0) {
              innerValue += value[i];
            } else {
              if (inString) {
                inString = false;
                result.value = innerValue;
                innerValue = ``;
              } else {
                inString = true;
              }
            }
            break;

          case `(`:
            if (inString) {
              innerValue += value[i];
            } else {
              inBrackets++;
            }
            break;
          case `)`:
            if (inString) {
              innerValue += value[i];
            } else {
              inBrackets--;
            }
            break;

          case newLineMark:
          case ` `:
            if (inBrackets > 0 || inString) {
              if (value[i] !== newLineMark) {
                innerValue += value[i];
              }
            } else {
              if (word.length > 0) {
                let conditionals = conditionalStrings ? conditionalStrings[conditionalLine] : undefined;

                result.keywords.push({
                  name: word.toUpperCase(),
                  value: innerValue.length > 0 ? innerValue : undefined,
                  conditions: conditionals ? DisplayFile.parseConditionals(conditionals) : []
                });

                word = ``;
                innerValue = ``;
              }
            }

            if (value[i] === newLineMark) { conditionalLine += 1; }
            break;
          default:
            if (inBrackets > 0 || inString) { innerValue += value[i]; }
            else { word += value[i]; }
            break;
        }
      }
    }

    return result;
  }

  private static conditionalGroups(conditions: Conditional[]) {
    return conditions.reduce((acc, curr, index) => {
      if (index % 3 === 0) {
        acc.push([curr]);
      } else {
        acc[acc.length - 1].push(curr);
      }
      return acc;
    }, [] as Conditional[][]);
  }

  /**
   * Pack text into the DDS keyword/function area (cols 45–80 = 36 chars).
   * When longer than 36, emit continuation lines with `-` in column 80.
   * Continuation lines use a blank indicator/body prefix (cols 1–44).
   *
   * @param prefix44 Exactly 44 characters covering cols 1–44 of the first line.
   * @param text Content for cols 45+ (const literal, KEYWORD, or KEYWORD(value)).
   */
  public static wrapKeywordArea(prefix44: string, text: string): string[] {
    const KEYWORD_WIDTH = 36;
    const CONT_WIDTH = KEYWORD_WIDTH - 1; // leave col 80 for `-`
    const CONT_PREFIX = `     A                                      `; // 44 chars

    const prefix = prefix44.length === 44
      ? prefix44
      : DisplayFile.fitColumn(prefix44, 44, `left`);
    const payload = text ?? ``;

    if (payload.length <= KEYWORD_WIDTH) {
      return [`${prefix}${payload}`];
    }

    const lines: string[] = [];
    let remaining = payload;
    let first = true;
    while (remaining.length > 0) {
      const isLast = remaining.length <= KEYWORD_WIDTH;
      const take = isLast ? remaining.length : Math.min(CONT_WIDTH, remaining.length);
      const chunk = remaining.slice(0, take);
      remaining = remaining.slice(take);
      const linePrefix = first ? prefix : CONT_PREFIX;
      first = false;
      lines.push(remaining.length > 0 ? `${linePrefix}${chunk}-` : `${linePrefix}${chunk}`);
    }
    return lines;
  }

  public static getLinesForKeyword(keyword: Keyword): string[] {
    const lines: string[] = [];
    const condition = this.conditionalGroups(keyword.conditions);
    const firstConditions = condition[0] || [];
    const conditionStrings = DisplayFile.formatConditionString(firstConditions);
    // Cols 45-80 = 36 chars for the keyword/function area; wrap with `-` continuations.
    const rawKeyword = `${keyword.name}${keyword.value ? `(${keyword.value})` : ``}`;
    lines.push(
      ...DisplayFile.wrapKeywordArea(
        `     A ${conditionStrings}                            `,
        rawKeyword,
      ),
    );

    for (let g = 1; g < condition.length; g++) {
      const group = condition[g];
      const groupStrings = DisplayFile.formatConditionString(group);
      lines.push(`     A ${groupStrings}`);
    }

    return lines;
  }

  public static getLinesForField(field: FieldInfo): string[] {
    const newLines: string[] = [];

    const FIELD_TYPE: { [name in DisplayType]: string } = {
      both: 'B',
      input: "I",
      output: "O",
      const: "",
      hidden: "H",
      message: "M",
      program: "P",
    };

    // y === 0 means printer-style "row column blank" — emit three spaces, never `0`.
    const x = DisplayFile.fitColumn(field.position.x, 3, `right`);
    const y = field.position.y === 0
      ? `   `
      : DisplayFile.fitColumn(field.position.y, 3, `right`);
    const mappedUsage = field.displayType ? FIELD_TYPE[field.displayType] : undefined;
    // Prefer a known mapping; otherwise preserve the raw col-38 char so we never
    // drop a named field's definition line for an unrecognized usage.
    const usageChar = mappedUsage !== undefined
      ? mappedUsage
      : (field.rawUsage && field.rawUsage.length > 0 ? field.rawUsage[0] : ` `);

    const condition = this.conditionalGroups(field.conditions);
    const firstConditions = condition[0] || [];
    const conditionStrings = DisplayFile.formatConditionString(firstConditions);
    const nameCol = DisplayFile.fitColumn(field.name || ``, 10, `left`);

    if (field.displayType === `const`) {
      const value = field.value ?? ``;
      newLines.push(
        ...DisplayFile.wrapKeywordArea(
          `     A ${conditionStrings}                      ${y}${x}`,
          `'${value}'`,
        ),
      );
    } else if (field.isReference && field.name) {
      const length = field.length !== undefined && field.length !== null && field.length !== 0
        ? DisplayFile.fitColumn(field.length, 5, `right`)
        : `     `;
      newLines.push(
        `     A ${conditionStrings}  ${nameCol} ${length}R  ${usageChar || ' '}${y}${x}`,
      );
    } else if (field.name) {
      // Preserve blank type as spaces — never invent A/0 for typeless fields
      const hasType = !!(field.type && field.type.trim());
      const definitionType = hasType ? field.type![0] : ` `;
      const length = field.length !== undefined && field.length !== null
        ? DisplayFile.fitColumn(field.length, 5, `right`)
        : `     `;
      const emitDecimals = hasType && NUMERIC_TYPES.has(field.type!.toUpperCase());
      const decimals = DisplayFile.fitColumn(
        emitDecimals ? String(field.decimals ?? 0) : ``,
        2,
        `right`,
      );
      newLines.push(
        `     A ${conditionStrings}  ${nameCol} ${length}${definitionType}${decimals}${usageChar}${y}${x}`,
      );
    }

    for (let g = 1; g < condition.length; g++) {
      newLines.push(`     A ${DisplayFile.formatConditionString(condition[g])}`);
    }

    // DATE/TIME keywords display system date/time on constants. DDS types L/T
    // already encode date/time; never re-emit stub DATE/TIME keywords that were
    // historically injected into the in-memory model for preview.
    const typeUpper = (field.type || ``).toUpperCase();
    for (const keyword of field.keywords) {
      const kwName = (keyword.name || ``).toUpperCase();
      if (typeUpper === `L` && kwName === `DATE`) {
        continue;
      }
      if (typeUpper === `T` && kwName === `TIME`) {
        continue;
      }
      newLines.push(...DisplayFile.getLinesForKeyword(keyword));
    }

    return newLines;
  }

  /**
   * Field range based on owned (non-passthrough) lines. Mid-span comments are
   * returned separately so callers can re-insert them after regeneration.
   *
   * @param recordFormat DDS record name (case-insensitive lookup).
   * @param fieldName Field name (case-insensitive lookup); must not be a TEXT* synthetic.
   */
  public getRangeForField(recordFormat: string, fieldName: string): DdsLineRange | undefined {
    const currentFormat = this.findFormat(recordFormat);
    if (!currentFormat || currentFormat.name === GLOBAL_RECORD_NAME) {
      return undefined;
    }

    const upperName = (fieldName || ``).trim().toUpperCase();
    const index = currentFormat.fields.findIndex(field => (field.name || ``).toUpperCase() === upperName);
    if (index < 0) {
      return undefined;
    }

    const field = currentFormat.fields[index];
    const owned = field.ownedLines.length > 0
      ? [...field.ownedLines].sort((a, b) => a - b)
      : undefined;

    let start = field.startRange;
    let end = field.endRange ?? field.startRange;

    if (owned && owned.length > 0) {
      start = owned[0];
      end = owned[owned.length - 1];
    } else {
      // Fallback: shrink trailing passthrough only
      const passthroughIndexes = new Set(currentFormat.passthroughLines.map(p => p.lineIndex));
      while (end > start && passthroughIndexes.has(end)) {
        end--;
      }
    }

    return { start, end };
  }

  /** Passthrough lines that sit strictly inside a field's start..end span. */
  public getMidSpanPassthrough(recordFormat: string, start: number, end: number): PassthroughLine[] {
    const currentFormat = this.findFormat(recordFormat);
    if (!currentFormat) {
      return [];
    }
    return currentFormat.passthroughLines
      .filter(p => p.lineIndex > start && p.lineIndex < end)
      .sort((a, b) => a.lineIndex - b.lineIndex);
  }

  public updateField(recordFormat: string, originalFieldName: string | undefined, fieldInfo: FieldInfo): DdsUpdate | undefined {
    const generated = DisplayFile.getLinesForField(fieldInfo);

    if (originalFieldName) {
      const range = this.getRangeForField(recordFormat, originalFieldName);
      if (!range) {
        // Failed lookup must NOT become an insert
        return undefined;
      }

      // Rebuild span keeping mid-span comments in their relative positions
      const mid = this.getMidSpanPassthrough(recordFormat, range.start, range.end);
      const midMap = new Map(mid.map(p => [p.lineIndex, p.text]));
      let gi = 0;
      const newLines: string[] = [];
      for (let i = range.start; i <= range.end; i++) {
        if (midMap.has(i)) {
          newLines.push(midMap.get(i)!);
        } else if (gi < generated.length) {
          newLines.push(generated[gi++]);
        }
      }
      while (gi < generated.length) {
        newLines.push(generated[gi++]);
      }

      return { newLines, range: { start: range.start, end: range.end } };
    }

    // New field insert (end < start → pure insert)
    const recordFormatDetail = this.findFormat(recordFormat);
    if (!recordFormatDetail || recordFormatDetail.name === GLOBAL_RECORD_NAME) {
      return undefined;
    }
    const insertAt = recordFormatDetail.range.end;
    return {
      newLines: generated,
      range: { start: insertAt, end: insertAt - 1 },
    };
  }

  /**
   * Apply a field/format update to a copy of source lines.
   * Insert when end < start; replace/delete inclusive start..end otherwise
   * (including start === end → replace that single line).
   */
  public applyUpdateToLines(lines: string[], update: DdsUpdate): string[] {
    if (!update.range) {
      return lines;
    }
    const result = [...lines];
    const { start, end } = update.range;

    // Pure insert: end < start (deleteCount would be 0)
    if (end < start) {
      if (start >= result.length) {
        result.push(...update.newLines);
      } else {
        result.splice(start, 0, ...update.newLines);
      }
      return result;
    }

    const deleteCount = Math.max(0, end - start + 1);
    result.splice(start, deleteCount, ...update.newLines);
    return result;
  }

  static getHeaderLinesForFormat(recordFormat: string, keywords: Keyword[]): string[] {
    const lines: string[] = [];

    if (recordFormat && recordFormat !== GLOBAL_RECORD_NAME) {
      const name = DisplayFile.fitColumn(recordFormat, 10, `left`).trimEnd();
      lines.push(`     A          R ${name}`);
    }

    for (const keyword of keywords) {
      lines.push(...DisplayFile.getLinesForKeyword(keyword));
    }

    return lines;
  }

  public getHeaderRangeForFormat(recordFormat: string): DdsLineRange | undefined {
    const currentFormat = this.findFormat(recordFormat);
    if (!currentFormat) {
      return undefined;
    }

    // File-level keywords live on the synthetic _GLOBAL format (before first R)
    if (currentFormat.name === GLOBAL_RECORD_NAME) {
      const owned = [...currentFormat.ownedHeaderLines].sort((a, b) => a - b);
      if (owned.length > 0) {
        return {
          start: owned[0],
          end: owned[owned.length - 1] + 1,
          endHeader: owned[owned.length - 1],
        };
      }

      // Insert before the first record format (or at EOF if none)
      const firstReal = this.formats.find((f) => f.name !== GLOBAL_RECORD_NAME);
      const insertAt = firstReal ? firstReal.range.start : this.sourceLines.length;
      return {
        start: insertAt,
        end: insertAt,
        endHeader: insertAt - 1, // end < start → insert (deleteCount 0)
      };
    }

    const range: DdsLineRange = { start: currentFormat.range.start, end: currentFormat.range.end };
    const firstField = currentFormat.fields[0];
    const passthroughIndexes = new Set(currentFormat.passthroughLines.map(p => p.lineIndex));

    if (currentFormat.ownedHeaderLines.length > 0) {
      const owned = [...currentFormat.ownedHeaderLines].sort((a, b) => a - b);
      range.endHeader = owned[owned.length - 1];
    } else if (firstField) {
      range.endHeader = firstField.startRange - 1;
      while (range.endHeader > range.start && passthroughIndexes.has(range.endHeader)) {
        range.endHeader--;
      }
    } else {
      // Empty format (keywords only): include all lines until next format / EOF
      range.endHeader = range.end > range.start ? range.end - 1 : range.start;
    }

    return range;
  }

  public updateFormatHeader(originalFormatName: string, keywords: Keyword[]): DdsUpdate | undefined {
    const generated = DisplayFile.getHeaderLinesForFormat(originalFormatName, keywords);
    const range = this.getHeaderRangeForFormat(originalFormatName);

    if (!range) {
      return undefined;
    }

    const start = range.start;
    const end = range.endHeader ?? range.end;
    const mid = this.getMidSpanPassthrough(originalFormatName, start, end);
    const midMap = new Map(mid.map(p => [p.lineIndex, p.text]));
    let gi = 0;
    const newLines: string[] = [];
    for (let i = start; i <= end; i++) {
      if (midMap.has(i)) {
        newLines.push(midMap.get(i)!);
      } else if (gi < generated.length) {
        newLines.push(generated[gi++]);
      }
    }
    while (gi < generated.length) {
      newLines.push(generated[gi++]);
    }

    return {
      newLines,
      range: { start, end },
    };
  }

  /** IBM i DDS record-format name: 1–10 chars, A–Z/@/#/$ then A–Z/0–9/@/#/$. */
  public static isValidRecordName(name: string): boolean {
    return isValidRecordNameShared(name);
  }

  /**
   * Append one or more new record formats at end of file.
   * Used for standard records and SFL + SFLCTL pairs.
   */
  public insertFormats(formats: { name: string; keywords?: Keyword[] }[]): DdsUpdate | undefined {
    if (!formats.length) {
      return undefined;
    }

    const taken = new Set(
      this.formats
        .map((f) => f.name.toUpperCase())
        .filter((n) => n && n !== GLOBAL_RECORD_NAME)
    );
    const newLines: string[] = [];

    for (const spec of formats) {
      const name = (spec.name || ``).trim().toUpperCase();
      if (!DisplayFile.isValidRecordName(name) || name === GLOBAL_RECORD_NAME || taken.has(name)) {
        return undefined;
      }
      taken.add(name);
      newLines.push(
        ...DisplayFile.getHeaderLinesForFormat(name, spec.keywords || [])
      );
    }

    const start = this.sourceLines.length;
    return {
      newLines,
      range: { start, end: start - 1 },
    };
  }

  /**
   * Case-insensitive record-format lookup by name.
   *
   * Note: this does NOT filter out the synthetic `_GLOBAL` format — callers
   * that only care about real record formats must additionally check
   * `result.name !== '_GLOBAL'`.
   */
  public findFormat(recordFormat: string): RecordInfo | undefined {
    const upper = (recordFormat || ``).trim().toUpperCase();
    return this.formats.find((f) => f.name.toUpperCase() === upper);
  }

  /**
   * Inclusive line span for a real record format body (R line through line before next format / EOF).
   * `range.end` on RecordInfo is exclusive.
   */
  public getFormatBodyRange(recordFormat: string): DdsLineRange | undefined {
    const currentFormat = this.findFormat(recordFormat);
    if (!currentFormat || currentFormat.name === GLOBAL_RECORD_NAME) {
      return undefined;
    }
    const start = currentFormat.range.start;
    const endExclusive = currentFormat.range.end > start
      ? currentFormat.range.end
      : this.sourceLines.length;
    const end = endExclusive - 1;
    if (start < 0 || end < start) {
      return undefined;
    }
    return { start, end };
  }

  /**
   * Names of formats that reference `recordFormat` via SFLCTL or SFLMSGRCD.
   * Used to block subfile-record deletion while the matching CTL still exists,
   * and to warn users before they invalidate a subfile pair.
   */
  public formatsReferencing(recordFormat: string): string[] {
    const target = (recordFormat || ``).trim().toUpperCase();
    const refs: string[] = [];
    for (const format of this.formats) {
      if (format.name === GLOBAL_RECORD_NAME || format.name.toUpperCase() === target) {
        continue;
      }
      for (const kw of format.keywords || []) {
        const name = (kw.name || ``).toUpperCase();
        if (name !== `SFLCTL` && name !== `SFLMSGRCD`) {
          continue;
        }
        if (String(kw.value || ``).trim().toUpperCase() === target) {
          refs.push(format.name);
          break;
        }
      }
    }
    return refs;
  }

  public deleteFormat(recordFormat: string): DdsUpdate | undefined {
    const body = this.getFormatBodyRange(recordFormat);
    if (!body) {
      return undefined;
    }
    if (this.formatsReferencing(recordFormat).length > 0) {
      return undefined;
    }
    return { newLines: [], range: body };
  }

  /**
   * Rename a record format and retarget SFLCTL / SFLMSGRCD references from the old name.
   * Returns scoped per-line updates (R-line + any referencing keyword lines) so the
   * host can apply a small WorkspaceEdit instead of rewriting the whole file.
   * Returns `undefined` when the rename is invalid (bad name, unknown source, collision)
   * or when the new name equals the old (no-op).
   */
  public renameFormat(oldName: string, newName: string): DdsUpdate[] | undefined {
    const from = (oldName || ``).trim().toUpperCase();
    const to = (newName || ``).trim().toUpperCase();
    if (!DisplayFile.isValidRecordName(to) || to === GLOBAL_RECORD_NAME) {
      return undefined;
    }
    if (from === to) {
      // Nothing to do; avoid emitting a spurious workspace edit.
      return undefined;
    }
    const format = this.findFormat(from);
    if (!format || format.name === GLOBAL_RECORD_NAME) {
      return undefined;
    }
    if (this.formats.some((f) => f.name.toUpperCase() === to)) {
      return undefined;
    }

    const lines = this.sourceLines;
    const rIdx = format.range.start;
    if (rIdx < 0 || rIdx >= lines.length) {
      return undefined;
    }

    const updates: DdsUpdate[] = [
      {
        newLines: [DisplayFile.replaceRecordNameOnRLine(lines[rIdx], to)],
        range: { start: rIdx, end: rIdx },
      },
    ];

    for (let i = 0; i < lines.length; i++) {
      if (i === rIdx) {
        continue;
      }
      const next = DisplayFile.retargetFormatRefsInLine(lines[i], from, to);
      if (next !== lines[i]) {
        updates.push({
          newLines: [next],
          range: { start: i, end: i },
        });
      }
    }

    return updates;
  }

  /** Duplicate a format at EOF under a new name. */
  public copyFormat(sourceName: string, newName: string): DdsUpdate | undefined {
    const from = (sourceName || ``).trim().toUpperCase();
    const to = (newName || ``).trim().toUpperCase();
    if (!DisplayFile.isValidRecordName(to) || to === GLOBAL_RECORD_NAME) {
      return undefined;
    }
    if (this.formats.some((f) => f.name.toUpperCase() === to)) {
      return undefined;
    }
    const body = this.getFormatBodyRange(from);
    if (!body) {
      return undefined;
    }

    const copied = this.sourceLines.slice(body.start, body.end + 1).map((line, i) => {
      if (i === 0) {
        return DisplayFile.replaceRecordNameOnRLine(line, to);
      }
      return line;
    });

    const start = this.sourceLines.length;
    return {
      newLines: copied,
      range: { start, end: start - 1 },
    };
  }

  static replaceRecordNameOnRLine(line: string, newName: string): string {
    const padded = line.padEnd(80);
    // Name starts at column 19 (0-based 18) after `R `
    if (padded.length > 18 && padded[16] === `R`) {
      const before = padded.substring(0, 18);
      const after = padded.substring(18 + 10);
      return (before + DisplayFile.fitColumn(newName, 10, `left`) + after).trimEnd();
    }
    return line.replace(/\bR\s+\S+/, `R ${DisplayFile.fitColumn(newName, 10, `left`).trimEnd()}`);
  }

  /**
   * Escape a string for safe use inside a `RegExp` literal.
   * Needed because DDS names may contain `$`, `#`, `@` — the first of which
   * has special meaning in regex replacement patterns.
   */
  static escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`);
  }

  /**
   * Retarget SFLCTL / SFLMSGRCD references to `oldName` on a single DDS line.
   * Case-insensitive on the keyword; preserves surrounding spaces inside the
   * parentheses. Non-matching lines are returned unchanged.
   */
  static retargetFormatRefsInLine(line: string, oldName: string, newName: string): string {
    const escaped = DisplayFile.escapeRegExp(oldName);
    const re = new RegExp(`\\b(SFLCTL|SFLMSGRCD)\\(\\s*${escaped}\\s*\\)`, `gi`);
    return line.replace(re, (_m, kw: string) => `${kw.toUpperCase()}(${newName})`);
  }

  /**
   * Mutate the in-memory model after a successful document edit (incremental).
   * Used by callers that don't want a full re-parse. Kept private-ish; the
   * host currently prefers `load()` / `refreshAfterEdit()` for correctness.
   */
  public replaceFieldInMemory(recordFormat: string, originalFieldName: string | undefined, fieldInfo: FieldInfo, newStart: number, newEnd: number) {
    const format = this.findFormat(recordFormat);
    if (!format) {
      return;
    }

    if (originalFieldName) {
      const upperName = originalFieldName.toUpperCase();
      const idx = format.fields.findIndex(f => (f.name || ``).toUpperCase() === upperName);
      if (idx >= 0) {
        const updated = FieldInfo.fromData(fieldInfo);
        updated.startRange = newStart;
        updated.endRange = newEnd;
        format.fields[idx] = updated;
        return;
      }
    }

    const created = FieldInfo.fromData(fieldInfo);
    created.startRange = newStart;
    created.endRange = newEnd;
    format.fields.push(created);
  }

  public removeFieldInMemory(recordFormat: string, fieldName: string) {
    const format = this.findFormat(recordFormat);
    if (!format) {
      return;
    }
    const upperName = (fieldName || ``).toUpperCase();
    format.fields = format.fields.filter(f => (f.name || ``).toUpperCase() !== upperName);
  }

  public replaceFormatKeywordsInMemory(recordFormat: string, keywords: Keyword[]) {
    const format = this.findFormat(recordFormat);
    if (!format) {
      return;
    }
    format.keywords = [...keywords];
    format.handleKeywordsFromList();
  }
}

export class RecordInfo {
  public fields: FieldInfo[] = [];
  public range: DdsLineRange = { start: -1, end: -1 };
  public isWindow: boolean = false;
  public windowReference: string | undefined = undefined;
  public windowSize: { y: number, x: number, width: number, height: number } = { y: 0, x: 0, width: 80, height: 24 };
  public keywordStrings: { keywordLines: string[], conditionalLines: { [lineIndex: number]: string } } = { keywordLines: [], conditionalLines: {} };
  public keywords: Keyword[] = [];
  public passthroughLines: PassthroughLine[] = [];
  /** Non-passthrough header lines (R line + keyword lines) */
  public ownedHeaderLines: number[] = [];

  constructor(public name: string) { }

  handleKeywords() {
    const data = DisplayFile.parseKeywords(this.keywordStrings.keywordLines, this.keywordStrings.conditionalLines);
    this.keywords.push(...data.keywords);
    this.applyWindowKeywords();
  }

  handleKeywordsFromList() {
    this.applyWindowKeywords();
  }

  private applyWindowKeywords() {
    this.isWindow = false;
    this.windowReference = undefined;
    this.keywords.forEach(keyword => {
      switch (keyword.name) {
        case "WINDOW":
          this.isWindow = true;
          if (keyword.value) {
            let points = keyword.value.split(' ');

            if (points.length >= 3 && points[0].toUpperCase() === `*DFT`) {
              this.windowSize = {
                y: 2,
                x: 2,
                width: Number(points[2]),
                height: Number(points[1])
              };
            } else {
              if (points.length === 1) {
                this.windowReference = points[0];
              } else if (points.length >= 4) {
                this.windowSize = {
                  y: Number(points[0]) || 2,
                  x: Number(points[1]) || 2,
                  width: Number(points[3]),
                  height: Number(points[2])
                };
              }
            }

            if (points.length === 1) {
              this.windowReference = points[0];
            }
          }
          break;
      }
    });
  }
}

export class FieldInfo {
  public value: string | undefined;
  public type: string | undefined;
  public primitiveType: "char" | "decimal" | undefined;
  public displayType: DisplayType | undefined;
  /**
   * Field length from DDS cols 30–34. `undefined` means the source column was
   * blank and must stay blank on re-emit (do not invent `0`).
   */
  public length: number | undefined = undefined;
  public decimals: number = 0;
  public position: { x: number, y: number } = { x: 0, y: 0 };
  public keywordStrings: { keywordLines: string[], conditionalLines: { [lineIndex: number]: string } } = { keywordLines: [], conditionalLines: {} };
  public conditions: Conditional[] = [];
  public keywords: Keyword[] = [];
  public endRange: number | undefined;
  public reference: string | undefined;
  public isReference: boolean = false;
  /**
   * Length resolved from the referenced database file (via SYSCOLUMNS) for
   * reference fields whose DDS source leaves the length column blank. Used
   * only for rendering — `getLinesForField` still emits from `length` so the
   * source column stays blank on round-trip.
   */
  public resolvedLength: number | undefined;
  /**
   * Raw col-38 usage character when it is not one of the known mappings.
   * Preserved so re-emit never drops the definition line.
   */
  public rawUsage: string | undefined;
  /** Non-passthrough lines owned by this field (definition + keywords) */
  public ownedLines: number[] = [];

  constructor(public startRange: number, public name?: string) {
    this.ownedLines = [startRange];
  }

  static fromData(data: Partial<FieldInfo> & { position?: { x: number; y: number } }): FieldInfo {
    const field = new FieldInfo(data.startRange ?? 0, data.name);
    field.value = data.value;
    field.type = data.type;
    field.primitiveType = data.primitiveType;
    field.displayType = data.displayType;
    field.length = data.length;
    field.decimals = data.decimals ?? 0;
    field.position = data.position ? { ...data.position } : { x: 0, y: 0 };
    field.conditions = data.conditions ? [...data.conditions] : [];
    field.keywords = data.keywords ? data.keywords.map(k => ({ ...k, conditions: [...(k.conditions || [])] })) : [];
    field.endRange = data.endRange;
    field.reference = data.reference;
    field.isReference = data.isReference ?? false;
    field.resolvedLength = data.resolvedLength;
    field.rawUsage = data.rawUsage;
    field.ownedLines = data.ownedLines ? [...data.ownedLines] : [field.startRange];
    return field;
  }

  handleKeywords() {
    const data = DisplayFile.parseKeywords(this.keywordStrings.keywordLines, this.keywordStrings.conditionalLines);

    this.keywords.push(...data.keywords);

    if (data.value.length > 0) {
      this.value = data.value;
    }

    const reffld = this.keywords.find(k => k.name === `REFFLD`);
    if (reffld?.value) {
      this.isReference = true;
      this.reference = reffld.value;
    }
  }
}
