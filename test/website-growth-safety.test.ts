import { describe, expect, test } from "bun:test";
import { validateVerifiedDiff } from "../src/lib/domain/website-growth";

describe("website growth verified diff safety", () => {
  test("rejects traversal and metadata files outside the site scope", () => {
    expect(validateVerifiedDiff({ files: ["../server.ts"] }, 10).error).toContain("outside");
    expect(validateVerifiedDiff({ files: ["workspace.json"] }, 10).error).toContain("outside");
  });

  test("enforces the configured changed-file limit", () => {
    expect(validateVerifiedDiff({ files: ["a.html", "b.css"] }, 1).error).toContain("configured limit");
  });

  test("accepts a scoped changeset", () => {
    const result = validateVerifiedDiff({ files: ["index.html"], patch: "diff --git a/index.html b/index.html" }, 10);
    expect(result.error).toBeUndefined();
    expect(result.diff?.files).toEqual(["index.html"]);
  });
});
