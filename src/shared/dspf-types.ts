/** Shared DDS model types used by extension host and webview. */

export interface DdsLineRange {
  start: number;
  endHeader?: number;
  end: number;
}

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

export type DisplayType = "input" | "output" | "both" | "const" | "hidden";

export interface FieldInfoData {
  startRange: number;
  endRange?: number;
  name?: string;
  value?: string;
  type?: string;
  primitiveType?: "char" | "decimal";
  displayType?: DisplayType;
  length: number;
  decimals: number;
  position: { x: number; y: number };
  conditions: Conditional[];
  keywords: Keyword[];
  /** Reference field target from REFFLD or type R */
  reference?: string;
  isReference?: boolean;
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
