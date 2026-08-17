import { describe, expect, it, vi } from "vitest";

vi.mock(`vscode`, () => ({
  extensions: { getExtension: () => undefined },
  workspace: { fs: { stat: async () => ({}) } },
  FilePermission: { Readonly: 1 },
}));

import { uriPathMatchesProtectedPath } from "../protectedSource";

describe("uriPathMatchesProtectedPath", () => {
  it("matches the exact path and nested children, not sibling prefixes", () => {
    expect(uriPathMatchesProtectedPath(`/home/foo`, `/home/foo`)).toBe(true);
    expect(uriPathMatchesProtectedPath(`/home/foo/bar.dspf`, `/home/foo`)).toBe(true);
    expect(uriPathMatchesProtectedPath(`/home/foo/`, `/home/foo`)).toBe(true);
    expect(uriPathMatchesProtectedPath(`/home/foobar`, `/home/foo`)).toBe(false);
    expect(uriPathMatchesProtectedPath(`/home/foo`, `/home/foo/`)).toBe(false);
    expect(uriPathMatchesProtectedPath(`/home/foo/a`, `/home/foo/`)).toBe(true);
  });
});
