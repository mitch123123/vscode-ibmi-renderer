/** Shared DDS model types used by extension host and webview. */

/**
 * A 0-based inclusive line range from a parsed DDS source.
 *
 * Convention used by `DdsUpdate`:
 * - `end >= start` (typical) — replace/delete the inclusive `start..end` span.
 * - `end === start - 1`     — pure insert *before* line `start`; no lines are removed.
 *
 * `endHeader` is only populated for header ranges (record R-line + owned
 * keyword lines) and is the last owned header line, again inclusive.
 */
export interface DdsLineRange {
  start: number;
  endHeader?: number;
  end: number;
}

/**
 * Result of a model-level edit: the new lines to write, and the range they
 * apply to. Interpret `range` using the semantics documented on
 * `DdsLineRange` (an `end < start` range means insert-only).
 */
export interface DdsUpdate {
  newLines: string[];
  range?: DdsLineRange;
}

export interface Conditional {
  indicator: number;
  negate: boolean;
}

export interface Keyword {
  name: string;
  value?: string;
  conditions: Conditional[];
}

export type DisplayType =
  | "input"
  | "output"
  | "both"
  | "const"
  | "hidden"
  | "message"
  | "program";

export interface FieldInfoData {
  startRange: number;
  endRange?: number;
  name?: string;
  value?: string;
  type?: string;
  primitiveType?: "char" | "decimal";
  displayType?: DisplayType;
  /**
   * Field length from DDS cols 30–34. `undefined` means the source column was
   * blank and must stay blank on re-emit (do not invent `0`).
   */
  length?: number;
  decimals: number;
  position: { x: number; y: number };
  conditions: Conditional[];
  keywords: Keyword[];
  /** Reference field target from REFFLD or type R */
  reference?: string;
  isReference?: boolean;
  /**
   * Length resolved from the referenced database file (via SYSCOLUMNS) for
   * reference fields whose DDS source leaves the length column blank. Used
   * only for rendering — never emitted back to source, so round-trip is
   * preserved.
   */
  resolvedLength?: number;
  /**
   * Raw col-38 usage character when it is not one of the known mappings
   * (I/O/B/H/M/P). Preserved so re-emit never drops the definition line.
   */
  rawUsage?: string;
  /** Non-passthrough source lines owned by this field (definition + keywords). */
  ownedLines?: number[];
}

export interface RecordInfoData {
  name: string;
  fields: FieldInfoData[];
  range: DdsLineRange;
  isWindow: boolean;
  windowReference?: string;
  windowSize: { y: number; x: number; width: number; height: number };
  keywords: Keyword[];
  /** Comment / blank lines preserved within this record (line index → text) */
  passthroughLines: PassthroughLine[];
}

export interface PassthroughLine {
  lineIndex: number;
  text: string;
}

export interface DisplayFileData {
  formats: RecordInfoData[];
}
