import { expect, describe, it } from "vitest";
import { stripKeywordsForTypeChange } from "../../webui/src/fieldTypeKeywords.js";

describe("stripKeywordsForTypeChange", () => {
  it("removes TIME/TIMFMT/TIMSEP when leaving type T", () => {
    const field = {
      type: `A`,
      keywords: [
        { name: `TIME`, conditions: [] },
        { name: `TIMFMT`, value: `*ISO`, conditions: [] },
        { name: `TIMSEP`, value: `:`, conditions: [] },
        { name: `COLOR`, value: `YLW`, conditions: [] },
      ],
    };
    stripKeywordsForTypeChange(field, `T`, `A`);
    expect(field.keywords.map((k) => k.name)).toEqual([`COLOR`]);
  });

  it("removes DATE/DATFMT/DATSEP when leaving type L", () => {
    const field = {
      type: `A`,
      keywords: [
        { name: `DATE`, conditions: [] },
        { name: `DATFMT`, value: `*ISO`, conditions: [] },
        { name: `COLOR`, value: `BLU`, conditions: [] },
      ],
    };
    stripKeywordsForTypeChange(field, `L`, `S`);
    expect(field.keywords.map((k) => k.name)).toEqual([`COLOR`]);
  });

  it("removes REFFLD and clears reference when leaving type R", () => {
    const field = {
      type: `A`,
      reference: `CUSTNO`,
      keywords: [
        { name: `REFFLD`, value: `CUSTNO`, conditions: [] },
        { name: `COLOR`, value: `GRN`, conditions: [] },
      ],
    };
    stripKeywordsForTypeChange(field, `R`, `A`);
    expect(field.reference).toBeUndefined();
    expect(field.keywords.map((k) => k.name)).toEqual([`COLOR`]);
  });

  it("keeps type-tied keywords when type is unchanged", () => {
    const field = {
      type: `T`,
      keywords: [
        { name: `TIME`, conditions: [] },
        { name: `TIMFMT`, value: `*HMS`, conditions: [] },
      ],
    };
    stripKeywordsForTypeChange(field, `T`, `T`);
    expect(field.keywords.map((k) => k.name)).toEqual([`TIME`, `TIMFMT`]);
  });
});
