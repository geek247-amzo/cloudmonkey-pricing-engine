import { describe, expect, test } from "bun:test";
import { stripPii } from "../src/lib/pii";

describe("PII stripping", () => {
  test("redacts identifiers and credential fields recursively", () => {
    expect(stripPii({ email: "person@example.com", phone: "+27 82 123 4567", ip: "192.168.1.2", accessToken: "secret" })).toEqual({
      email: "[email]", phone: "[phone]", ip: "[ip]", accessToken: "[redacted]",
    });
  });
});
