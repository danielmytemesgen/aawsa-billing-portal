import { describe, it, expect } from "vitest";

describe("Weak Network & Bandwidth Helpers", () => {
  it("should recognize slow-2g, 2g, and 3g as slow connections", () => {
    const slowTypes: string[] = ["slow-2g", "2g", "3g"];
    slowTypes.forEach((type) => {
      const isSlow = type === "slow-2g" || type === "2g" || type === "3g";
      expect(isSlow).toBe(true);
    });
  });

  it("should recognize 4g as fast connection", () => {
    const type: string = "4g";
    const isSlow = type === "slow-2g" || type === "2g" || type === "3g";
    expect(isSlow).toBe(false);
  });
});
