import { describe, expect, it } from "vitest";
import { clampFieldPosition } from "../../webui/src/coords.js";
import { validateFieldEditPayload, validateFormatKeywords } from "../shared/editValidation";

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

  it("allows y=0 and blank length", () => {
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
  });
});
