import { describe, expect, test } from "bun:test";
import { createSecureToken, hashSecureToken, isUnexpired } from "../src/lib/secure-handout";

describe("secure handout tokens", () => {
  test("stores only a one-way hash", () => {
    const token = createSecureToken();
    expect(token.raw.length).toBeGreaterThan(20);
    expect(token.hash).toBe(hashSecureToken(token.raw));
    expect(token.hash).not.toBe(token.raw);
  });
  test("expires at the boundary", () => expect(isUnexpired(new Date(Date.now() + 1000))).toBe(true));
});
