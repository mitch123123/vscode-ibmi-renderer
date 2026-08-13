import { describe, expect, it } from "vitest";
import {
  filterConstValueInput,
  filterDigitInput,
  filterFieldNameInput,
  filterIndicatorInput,
  filterReferenceInput,
  FIELD_NAME_MAX,
  LENGTH_INPUT_MAX_CHARS,
} from "../../webui/src/propInputLimits.js";

describe("propInputLimits", () => {
  it("strips spaces and caps field names at 10 characters", () => {
    expect(filterFieldNameInput(`cust name`)).toBe(`CUSTNAME`);
    expect(filterFieldNameInput(`abcdefghijkl`)).toBe(`ABCDEFGHIJ`);
    expect(filterFieldNameInput(`1BAD`)).toBe(`BAD`);
    expect(filterFieldNameInput(`@ok#1`)).toBe(`@OK#1`);
    expect(filterFieldNameInput(`has_under`)).toBe(`HASUNDER`);
    expect(filterFieldNameInput(`x`.repeat(20)).length).toBe(FIELD_NAME_MAX);
  });

  it("keeps length/decimals digit-only within DDS column width", () => {
    expect(filterDigitInput(`12a3`, LENGTH_INPUT_MAX_CHARS)).toBe(`123`);
    expect(filterDigitInput(`999999`, LENGTH_INPUT_MAX_CHARS)).toBe(`99999`);
    expect(filterDigitInput(`9x9`, 2)).toBe(`99`);
  });

  it("normalizes indicator slots to N? + up to 2 digits", () => {
    expect(filterIndicatorInput(`n05`)).toBe(`N05`);
    expect(filterIndicatorInput(` 20 `)).toBe(`20`);
    expect(filterIndicatorInput(`N`)).toBe(`N`);
    expect(filterIndicatorInput(`N999`)).toBe(`N99`);
    expect(filterIndicatorInput(`AB`)).toBe(``);
  });

  it("blocks quotes and control characters in const values", () => {
    expect(filterConstValueInput(`O'Brien`)).toBe(`OBrien`);
    expect(filterConstValueInput(`a\nb`)).toBe(`ab`);
    expect(filterConstValueInput(`x`.repeat(600)).length).toBe(512);
  });

  it("uppercases and sanitizes REFFLD reference text", () => {
    expect(filterReferenceInput(`name custfile`)).toBe(`NAME CUSTFILE`);
    expect(filterReferenceInput(`FLD LIB/FILE!`)).toBe(`FLD LIB/FILE`);
  });
});
