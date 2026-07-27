import type { Conditional, DisplayType, DdsLineRange, DdsUpdate, Keyword, PassthroughLine } from "../shared/dspf-types";

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
              this.currentField.length = Number(len);
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
                case " ":
                case "O":
                  this.currentField.displayType = `output`;
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
                  case `L`: //Date
                    this.currentField.length = 8;
                    this.currentField.primitiveType = `char`;
                    this.currentField.keywords.push({
                      name: `DATE`,
                      value: undefined,
                      conditions: []
                    });
                    break;
                  case `T`: //Time
                    this.currentField.length = 8;
                    this.currentField.primitiveType = `char`;
                    this.currentField.keywords.push({
                      name: `TIME`,
                      value: undefined,
                      conditions: []
                    });
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

  /** Format one indicator as a 3-char IBM slot: " 05" or "N20" */
  static formatIndicatorSlot(c: Conditional): string {
    const num = String(c.indicator).padStart(2, `0`);
    return `${c.negate ? `N` : ` `}${num}`;
  }

  /** 9 chars after `A` covering cols 8-16 (col7 left as space via `A ` prefix). */
  static formatConditionString(conditions: Conditional[]): string {
    return conditions
      .slice(0, 3)
      .map(c => DisplayFile.formatIndicatorSlot(c))
      .join(``)
      .padEnd(9);
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

  public static getLinesForKeyword(keyword: Keyword): string[] {
    const lines: string[] = [];
    const condition = this.conditionalGroups(keyword.conditions);
    const firstConditions = condition[0] || [];
    const conditionStrings = DisplayFile.formatConditionString(firstConditions);

    lines.push(`     A ${conditionStrings}                            ${keyword.name}${keyword.value ? `(${keyword.value})` : ``}`);

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
      hidden: "H"
    };

    const x = String(field.position.x).padStart(3, ` `);
    const y = String(field.position.y).padStart(3, ` `);
    const displayType = FIELD_TYPE[field.displayType!];

    const condition = this.conditionalGroups(field.conditions);
    const firstConditions = condition[0] || [];
    const conditionStrings = DisplayFile.formatConditionString(firstConditions);

    if (field.displayType === `const`) {
      const value = field.value;
      newLines.push(
        `     A ${conditionStrings}                      ${y}${x}'${value}'`,
      );
    } else if (field.isReference && field.name) {
      const length = field.length ? String(field.length).padStart(5) : `     `;
      newLines.push(
        `     A ${conditionStrings}  ${field.name.padEnd(10)} ${length}R  ${displayType || ' '}${y}${x}`,
      );
    } else if (displayType !== undefined && field.name) {
      // Preserve blank type as spaces — never invent A/0 for typeless fields
      const hasType = !!(field.type && field.type.trim());
      const definitionType = hasType ? field.type! : ` `;
      const length = String(field.length).padStart(5);
      const emitDecimals = hasType && NUMERIC_TYPES.has(field.type!.toUpperCase());
      const decimals = (emitDecimals ? String(field.decimals) : ``).padStart(2);
      newLines.push(
        `     A ${conditionStrings}  ${field.name.padEnd(10)} ${length}${definitionType}${decimals}${displayType}${y}${x}`,
      );
    }

    for (let g = 1; g < condition.length; g++) {
      newLines.push(`     A ${DisplayFile.formatConditionString(condition[g])}`);
    }

    for (const keyword of field.keywords) {
      newLines.push(...DisplayFile.getLinesForKeyword(keyword));
    }

    return newLines;
  }

  /**
   * Field range based on owned (non-passthrough) lines. Mid-span comments are
   * returned separately so callers can re-insert them after regeneration.
   */
  public getRangeForField(recordFormat: string, fieldName: string): DdsLineRange | undefined {
    const currentFormat = this.formats.find(format => format.name === recordFormat);
    if (!currentFormat || currentFormat.name === GLOBAL_RECORD_NAME) {
      return undefined;
    }

    const index = currentFormat.fields.findIndex(field => field.name === fieldName);
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
    const currentFormat = this.formats.find(format => format.name === recordFormat);
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

    // New field insert
    const recordFormatDetail = this.formats.find(format => format.name === recordFormat);
    if (!recordFormatDetail) {
      return undefined;
    }
    return {
      newLines: generated,
      range: { start: recordFormatDetail.range.end, end: recordFormatDetail.range.end },
    };
  }

  /**
   * Apply a field update to a copy of source lines without touching unrelated lines.
   * Insert when start === end (and pointing at next format / EOF); replace otherwise.
   */
  public applyUpdateToLines(lines: string[], update: DdsUpdate): string[] {
    if (!update.range) {
      return lines;
    }
    const result = [...lines];
    const { start, end } = update.range;

    // Pure insert (new field): never delete the line at start
    if (start === end) {
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
      lines.push(`     A          R ${recordFormat}`);
    }

    for (const keyword of keywords) {
      lines.push(...DisplayFile.getLinesForKeyword(keyword));
    }

    return lines;
  }

  public getHeaderRangeForFormat(recordFormat: string): DdsLineRange | undefined {
    const currentFormat = this.formats.find(format => format.name === recordFormat);
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
    return /^[A-Z@#$][A-Z0-9@#$]{0,9}$/.test((name || ``).trim().toUpperCase());
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
      range: { start, end: start },
    };
  }

  /**
   * Inclusive line span for a real record format body (R line through line before next format / EOF).
   * `range.end` on RecordInfo is exclusive.
   */
  public getFormatBodyRange(recordFormat: string): DdsLineRange | undefined {
    const currentFormat = this.formats.find((format) => format.name === recordFormat);
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

  public deleteFormat(recordFormat: string): DdsUpdate | undefined {
    const body = this.getFormatBodyRange(recordFormat);
    if (!body) {
      return undefined;
    }
    return { newLines: [], range: body };
  }

  /**
   * Rename a record format and retarget SFLCTL / SFLMSGRCD references to the old name.
   */
  public renameFormat(oldName: string, newName: string): DdsUpdate | undefined {
    const from = (oldName || ``).trim().toUpperCase();
    const to = (newName || ``).trim().toUpperCase();
    if (!DisplayFile.isValidRecordName(to) || to === GLOBAL_RECORD_NAME) {
      return undefined;
    }
    const format = this.formats.find((f) => f.name === from);
    if (!format || format.name === GLOBAL_RECORD_NAME) {
      return undefined;
    }
    if (this.formats.some((f) => f.name === to && f.name !== from)) {
      return undefined;
    }

    const lines = [...this.sourceLines];
    const rIdx = format.range.start;
    if (rIdx < 0 || rIdx >= lines.length) {
      return undefined;
    }
    lines[rIdx] = DisplayFile.replaceRecordNameOnRLine(lines[rIdx], to);

    for (let i = 0; i < lines.length; i++) {
      lines[i] = DisplayFile.retargetFormatRefsInLine(lines[i], from, to);
    }

    return {
      newLines: lines,
      range: { start: 0, end: Math.max(0, lines.length - 1) },
    };
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
      range: { start, end: start },
    };
  }

  static replaceRecordNameOnRLine(line: string, newName: string): string {
    const padded = line.padEnd(80);
    // Name starts at column 19 (0-based 18) after `R `
    if (padded.length > 18 && padded[16] === `R`) {
      const before = padded.substring(0, 18);
      const after = padded.substring(18 + 10);
      return (before + newName.padEnd(10) + after).trimEnd();
    }
    return line.replace(/\bR\s+\S+/, `R ${newName}`);
  }

  static retargetFormatRefsInLine(line: string, oldName: string, newName: string): string {
    const re = new RegExp(`\\b(SFLCTL|SFLMSGRCD)\\(\\s*${oldName}\\s*\\)`, `gi`);
    return line.replace(re, (_m, kw: string) => `${kw.toUpperCase()}(${newName})`);
  }

  /** Mutate in-memory model after a successful document edit (incremental). */
  public replaceFieldInMemory(recordFormat: string, originalFieldName: string | undefined, fieldInfo: FieldInfo, newStart: number, newEnd: number) {
    const format = this.formats.find(f => f.name === recordFormat);
    if (!format) {
      return;
    }

    if (originalFieldName) {
      const idx = format.fields.findIndex(f => f.name === originalFieldName);
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
    const format = this.formats.find(f => f.name === recordFormat);
    if (!format) {
      return;
    }
    format.fields = format.fields.filter(f => f.name !== fieldName);
  }

  public replaceFormatKeywordsInMemory(recordFormat: string, keywords: Keyword[]) {
    const format = this.formats.find(f => f.name === recordFormat);
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
  public length: number = 0;
  public decimals: number = 0;
  public position: { x: number, y: number } = { x: 0, y: 0 };
  public keywordStrings: { keywordLines: string[], conditionalLines: { [lineIndex: number]: string } } = { keywordLines: [], conditionalLines: {} };
  public conditions: Conditional[] = [];
  public keywords: Keyword[] = [];
  public endRange: number | undefined;
  public reference: string | undefined;
  public isReference: boolean = false;
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
    field.length = data.length ?? 0;
    field.decimals = data.decimals ?? 0;
    field.position = data.position ? { ...data.position } : { x: 0, y: 0 };
    field.conditions = data.conditions ? [...data.conditions] : [];
    field.keywords = data.keywords ? data.keywords.map(k => ({ ...k, conditions: [...(k.conditions || [])] })) : [];
    field.endRange = data.endRange;
    field.reference = data.reference;
    field.isReference = data.isReference ?? false;
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
