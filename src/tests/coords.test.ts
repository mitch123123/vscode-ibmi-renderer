import { describe, expect, it } from "vitest";
import {
  clampFieldPosition,
  fieldContentLength,
  fieldsOverlap,
  formatOverlapWarning,
  maxStartColumnForLength,
  overlappingFieldSet,
  validateFieldScreenFit,
} from "../../webui/src/coords.js";
import {
  sanitizeDialogString,
  validateConstValue,
  validateFieldEditPayload,
  validateFormatKeywords,
  validateKeyword,
} from "../shared/editValidation";

describe("clampFieldPosition", () => {
  it("clamps into window-relative bounds", () => {
    expect(clampFieldPosition(50, 20, { maxX: 40, maxY: 12 })).toEqual({ x: 40, y: 12 });
    expect(clampFieldPosition(0, 0, { maxX: 40, maxY: 12 })).toEqual({ x: 1, y: 1 });
  });

  it("preserves printer y=0 when wasY0 is set", () => {
    expect(clampFieldPosition(10, 5, { maxX: 80, maxY: 24, wasY0: true })).toEqual({
      x: 10,
      y: 0,
    });
  });

  it("keeps edge cells", () => {
    expect(clampFieldPosition(1, 1, { maxX: 80, maxY: 24 })).toEqual({ x: 1, y: 1 });
    expect(clampFieldPosition(80, 24, { maxX: 80, maxY: 24 })).toEqual({ x: 80, y: 24 });
  });

  it("limits start column so field length fits within maxX", () => {
    expect(clampFieldPosition(80, 1, { maxX: 80, maxY: 24, length: 3 })).toEqual({
      x: 78,
      y: 1,
    });
    expect(clampFieldPosition(79, 1, { maxX: 80, maxY: 24, length: 10 })).toEqual({
      x: 71,
      y: 1,
    });
    expect(maxStartColumnForLength(80, 1)).toBe(80);
    expect(maxStartColumnForLength(80, 5)).toBe(76);
  });
});

describe("validateFieldScreenFit", () => {
  it("rejects fields that would extend past the record length", () => {
    expect(
      validateFieldScreenFit(
        { position: { x: 78, y: 1 }, length: 5, displayType: `output` },
        { maxX: 80, maxY: 24 },
      ),
    ).toMatch(/past record length of 80/);

    expect(
      validateFieldScreenFit(
        { position: { x: 76, y: 1 }, length: 5, displayType: `output` },
        { maxX: 80, maxY: 24 },
      ),
    ).toBeUndefined();
  });

  it("uses const value length when checking fit", () => {
    expect(fieldContentLength({ displayType: `const`, value: `HELLO`, length: 2 })).toBe(5);
    expect(
      validateFieldScreenFit(
        { position: { x: 78, y: 21 }, displayType: `const`, value: `ABCDE` },
        { maxX: 80, maxY: 24 },
      ),
    ).toMatch(/past record length/);
  });

  it("allows blank column x<=0 (unpositioned P/H/M)", () => {
    expect(
      validateFieldScreenFit(
        { position: { x: 0, y: 0 }, length: 5, displayType: `program` },
        { maxX: 80, maxY: 24 },
      ),
    ).toBeUndefined();
    expect(
      validateFieldScreenFit(
        { position: { x: -1, y: -1 }, length: 5, displayType: `program` },
        { maxX: 80, maxY: 24 },
      ),
    ).toBeUndefined();
  });
});

describe("field overlap", () => {
  const a = { name: `FLD1`, position: { x: 10, y: 5 }, length: 5, displayType: `output` };
  const b = { name: `FLD2`, position: { x: 14, y: 5 }, length: 3, displayType: `both` };
  const c = { name: `FLD3`, position: { x: 15, y: 5 }, length: 2, displayType: `output` };
  const otherRow = { name: `FLD4`, position: { x: 10, y: 6 }, length: 5, displayType: `output` };

  it("detects overlapping column ranges on the same row", () => {
    expect(fieldsOverlap(a, b)).toBe(true); // 10-14 vs 14-16
    expect(fieldsOverlap(a, c)).toBe(false); // 10-14 vs 15-16
    expect(fieldsOverlap(a, otherRow)).toBe(false);
  });

  it("skips relative y=0 fields", () => {
    expect(
      fieldsOverlap(
        { name: `R1`, position: { x: 1, y: 0 }, length: 10 },
        { name: `R2`, position: { x: 1, y: 1 }, length: 10 },
      ),
    ).toBe(false);
  });

  it("formats a compile warning naming the other field", () => {
    expect(formatOverlapWarning(a, [a, b, otherRow])).toMatch(
      /Overlaps FLD2.*will not compile/i,
    );
    expect(formatOverlapWarning(a, [a, otherRow])).toBeUndefined();
  });

  it("collects all overlapping fields in a set", () => {
    const set = overlappingFieldSet([a, b, c, otherRow]);
    expect(set.has(a)).toBe(true);
    expect(set.has(b)).toBe(true);
    expect(set.has(c)).toBe(true); // overlaps b (14–16 vs 15–16)
    expect(set.has(otherRow)).toBe(false);
  });
});

describe("editValidation", () => {
  it("rejects invalid field names and out-of-range length", () => {
    expect(
      validateFieldEditPayload({
        name: `BAD NAME`,
        displayType: `both`,
        position: { x: 1, y: 1 },
        length: 5,
        decimals: 0,
        conditions: [],
        keywords: [],
        startRange: 0,
      }),
    ).toMatch(/Invalid field name/);

    expect(
      validateFieldEditPayload({
        name: `FLD1`,
        displayType: `both`,
        position: { x: 1, y: 1 },
        length: 100000,
        decimals: 0,
        conditions: [],
        keywords: [],
        startRange: 0,
      }),
    ).toMatch(/Length must be/);
  });

  it("allows y=0, x<=0, and blank length", () => {
    expect(
      validateFieldEditPayload({
        name: `AMT`,
        displayType: `output`,
        position: { x: 25, y: 0 },
        decimals: 2,
        conditions: [],
        keywords: [],
        startRange: 0,
      }),
    ).toBeUndefined();
    expect(
      validateFieldEditPayload({
        name: `PGMFLD`,
        displayType: `program`,
        position: { x: 0, y: 0 },
        length: 5,
        decimals: 0,
        conditions: [],
        keywords: [],
        startRange: 0,
      }),
    ).toBeUndefined();
    expect(
      validateFieldEditPayload({
        name: `PGMFLD`,
        displayType: `program`,
        position: { x: -1, y: -1 },
        length: 5,
        decimals: 0,
        conditions: [],
        keywords: [],
        startRange: 0,
      }),
    ).toBeUndefined();
  });

  it("validates SFLPAG/SFLSIZ and WINDOW keywords", () => {
    expect(
      validateFormatKeywords([
        { name: `SFLPAG`, value: `abc`, conditions: [] },
      ]),
    ).toMatch(/SFLPAG/);

    expect(
      validateFormatKeywords([
        { name: `SFLPAG`, value: `10`, conditions: [] },
        { name: `SFLSIZ`, value: `5`, conditions: [] },
      ]),
    ).toMatch(/SFLSIZ must be/);

    expect(
      validateFormatKeywords([{ name: `WINDOW`, value: `5 10`, conditions: [] }]),
    ).toMatch(/WINDOW must be/);

    expect(
      validateFormatKeywords([{ name: `WINDOW`, value: `5 10 12 40`, conditions: [] }]),
    ).toBeUndefined();

    expect(
      validateFormatKeywords([{ name: `WINDOW`, value: `*DFT 10 50`, conditions: [] }]),
    ).toBeUndefined();

    expect(
      validateFormatKeywords([{ name: `WINDOW`, value: `HEAD`, conditions: [] }]),
    ).toBeUndefined();
  });

  it("rejects unsafe keyword names and values", () => {
    expect(validateKeyword({ name: `COLOR;DROP`, conditions: [] })).toMatch(/Invalid keyword name/);
    expect(
      validateKeyword({ name: `COLOR`, value: `RED\u0000`, conditions: [] }),
    ).toMatch(/invalid characters/i);
    expect(
      validateFormatKeywords([{ name: `BAD NAME`, value: `x`, conditions: [] }]),
    ).toMatch(/Invalid keyword name/);
    expect(
      validateKeyword({ name: `TEXT`, value: `Hello\n     A          R INJECT`, conditions: [] }),
    ).toMatch(/invalid characters/i);
    expect(
      validateFormatKeywords([{ name: `WDWTITLE`, value: `Hi\r\nthere`, conditions: [] }]),
    ).toMatch(/invalid characters/i);
  });

  it("rejects const values that would break DDS string literals", () => {
    expect(validateConstValue(`O'Brien`)).toBeUndefined();
    expect(validateConstValue(`line\nbreak`)).toMatch(/invalid characters/i);
    expect(
      validateFieldEditPayload({
        displayType: `const`,
        value: `Hi'there`,
        position: { x: 1, y: 1 },
        decimals: 0,
        conditions: [],
        keywords: [],
        startRange: 0,
      }),
    ).toBeUndefined();
  });

  it("sanitizes dialog strings", () => {
    expect(sanitizeDialogString(`  hello\u0000world  `)).toBe(`helloworld`);
    expect(sanitizeDialogString(`x`.repeat(500)).length).toBe(200);
    expect(sanitizeDialogString(123 as unknown as string)).toBe(``);
  });
});
