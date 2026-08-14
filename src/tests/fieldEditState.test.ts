import { describe, expect, it } from "vitest";
import {
  keywordsChanged,
  propValuesChanged,
  readPropValuesFromElement,
  snapshotPropValues,
} from "../../webui/src/fieldEditState.js";

describe(`fieldEditState`, () => {
  it(`snapshots only editable property ids`, () => {
    expect(snapshotPropValues([
      { id: `name`, value: `CUST` },
      { label: `Position`, value: `1, 2` },
      { id: `length`, value: 10 },
    ])).toEqual({ name: `CUST`, length: `10` });
  });

  it(`treats missing and empty property values as equal`, () => {
    expect(propValuesChanged({ name: `A`, length: `` }, { name: `A` })).toBe(false);
    expect(propValuesChanged({ name: `A` }, { name: `B` })).toBe(true);
    expect(propValuesChanged({ name: `A` }, { name: `A`, type: `S` })).toBe(true);
  });

  it(`detects keyword list edits`, () => {
    const original = [{ name: `COLOR`, value: `RED`, conditions: [] }];
    expect(keywordsChanged(original, original)).toBe(false);
    expect(keywordsChanged(original, [...original, { name: `DSPATR`, value: `HI`, conditions: [] }])).toBe(true);
    expect(keywordsChanged(undefined, [])).toBe(false);
  });

  it(`reads current values from data-prop-id controls`, () => {
    const input = { dataset: { propId: `name` }, value: `FIELD1` };
    const select = { dataset: { propId: `displayType` }, value: `both` };
    const root = {
      querySelectorAll: () => [input, select],
    };

    expect(readPropValuesFromElement(root)).toEqual({
      name: `FIELD1`,
      displayType: `both`,
    });
    expect(propValuesChanged(
      { name: `FIELD1`, displayType: `output` },
      readPropValuesFromElement(root),
    )).toBe(true);
  });
});
