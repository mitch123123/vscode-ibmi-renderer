import { describe, expect, it } from "vitest";
import { COMMANDS, UPSTREAM_VIEW_TYPE, VIEW_TYPE } from "../shared/messages";

describe(`extension identity`, () => {
  it(`does not reuse the upstream Code for IBM i designer view type`, () => {
    expect(VIEW_TYPE).toBe(`mitchfiedler.dspfDesigner`);
    expect(VIEW_TYPE).not.toBe(UPSTREAM_VIEW_TYPE);
  });

  it(`namespaces commands under this fork's publisher`, () => {
    for (const id of Object.values(COMMANDS)) {
      expect(id.startsWith(`mitchfiedler.ddsDesigner.`)).toBe(true);
    }
  });
});
