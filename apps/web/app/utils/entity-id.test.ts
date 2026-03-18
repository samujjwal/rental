import { describe, expect, it } from "vitest";

import { isAppEntityId } from "./entity-id";

describe("isAppEntityId", () => {
  it("accepts UUID ids", () => {
    expect(
      isAppEntityId("11111111-1111-1111-8111-111111111111")
    ).toBe(true);
  });

  it("accepts CUID ids", () => {
    expect(isAppEntityId("ckx1234567890abcdefghijkl")).toBe(true);
  });

  it("rejects malformed ids", () => {
    expect(isAppEntityId("bad-id")).toBe(false);
  });
});
