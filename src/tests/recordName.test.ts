import { describe, expect, it } from "vitest";
import {
  isValidFieldName,
  sanitizeFieldName,
  uniqueFieldName,
  uniquifyNewFieldNames,
} from "../shared/recordName";

describe("sanitizeFieldName", () => {
  it("strips underscores, spaces, and other illegal characters", () => {
    expect(sanitizeFieldName(`FIELD1_C`)).toBe(`FIELD1C`);
    expect(sanitizeFieldName(`cust name`)).toBe(`CUSTNAME`);
    expect(sanitizeFieldName(`has_under`)).toBe(`HASUNDER`);
  });

  it("caps at 10 characters and rejects a leading digit", () => {
    expect(sanitizeFieldName(`abcdefghijkl`)).toBe(`ABCDEFGHIJ`);
    expect(sanitizeFieldName(`1BAD`)).toBe(`BAD`);
    expect(sanitizeFieldName(`123`)).toBe(`FIELD`);
    expect(sanitizeFieldName(``)).toBe(`FIELD`);
  });
});

describe("uniqueFieldName", () => {
  it("keeps the original name when it is free", () => {
    expect(uniqueFieldName(`FIELD1`, new Set())).toBe(`FIELD1`);
    expect(uniqueFieldName(`CUSTNAME`, [])).toBe(`CUSTNAME`);
  });

  it("increments a trailing number instead of inserting an underscore", () => {
    expect(uniqueFieldName(`FIELD1`, new Set([`FIELD1`]))).toBe(`FIELD2`);
    expect(uniqueFieldName(`FIELD1`, [`FIELD1`, `FIELD2`])).toBe(`FIELD3`);
    expect(uniqueFieldName(`CUSTNAME`, new Set([`CUSTNAME`]))).toBe(`CUSTNAME2`);
  });

  it("never produces a name with an underscore", () => {
    const name = uniqueFieldName(`FIELD1_C`, new Set([`FIELD1`, `FIELD1C`]));
    expect(name.includes(`_`)).toBe(false);
    expect(isValidFieldName(name)).toBe(true);
  });

  it("stays within 10 characters and DDS grammar", () => {
    const taken = new Set([`ABCDEFGHIJ`]);
    const name = uniqueFieldName(`ABCDEFGHIJ`, taken);
    expect(name.length).toBeLessThanOrEqual(10);
    expect(isValidFieldName(name)).toBe(true);
    expect(name).toBe(`ABCDEFGHI2`);
  });

  it("skips names already in the existing set while pasting several copies", () => {
    const existing = new Set([`FIELD1`]);
    const first = uniqueFieldName(`FIELD1`, existing);
    existing.add(first);
    const second = uniqueFieldName(`FIELD1`, existing);
    existing.add(second);
    expect(first).toBe(`FIELD2`);
    expect(second).toBe(`FIELD3`);
    expect(isValidFieldName(first)).toBe(true);
    expect(isValidFieldName(second)).toBe(true);
  });
});

describe("uniquifyNewFieldNames", () => {
  it("keeps a free name and increments collisions against existing DDS fields", () => {
    const fields = [{ name: `FIELD1`, displayType: `both` }, { name: `CUSTNAME`, displayType: `both` }];
    uniquifyNewFieldNames(fields, [`FIELD1`, `DATE1`]);
    expect(fields[0].name).toBe(`FIELD2`);
    expect(fields[1].name).toBe(`CUSTNAME`);
  });

  it("increments names that collide with earlier fields in the same batch", () => {
    const fields = [
      { name: `CUSTNAME`, displayType: `both` },
      { name: `CUSTNAME`, displayType: `both` },
    ];
    uniquifyNewFieldNames(fields, []);
    expect(fields[0].name).toBe(`CUSTNAME`);
    expect(fields[1].name).toBe(`CUSTNAME2`);
  });

  it("leaves constants unnamed and still reserves existing TEXT* ids", () => {
    const fields = [
      { displayType: `const`, name: undefined as string | undefined },
      { name: `TEXT1`, displayType: `both` },
    ];
    uniquifyNewFieldNames(fields, [`TEXT1`]);
    expect(fields[0].name).toBeUndefined();
    expect(fields[1].name).toBe(`TEXT2`);
  });
});
