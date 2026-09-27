import { describe, expect, it } from "vitest";
import { createWindowLimiter } from "../../src/lib/runtime/rate-limit";

describe("Runtime rate limiter", () => {
  it("applies a per-identity minute window and resets at the next window", () => {
    let time = 0;
    const claim = createWindowLimiter(() => time);
    expect(claim("guest:a", 2)).toBe(true);
    expect(claim("guest:a", 2)).toBe(true);
    expect(claim("guest:a", 2)).toBe(false);
    expect(claim("guest:b", 2)).toBe(true);
    time = 60_000;
    expect(claim("guest:a", 2)).toBe(true);
  });
});
