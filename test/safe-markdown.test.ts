import { describe, expect, test } from "bun:test";

import { renderSafeMarkdown } from "../src/lib/safe-markdown";

describe("safe proposal markdown", () => {
  test("formats proposal headings, lists, emphasis, and paragraphs", () => {
    const html = renderSafeMarkdown(`# Terms

Intro for **Client**.

1. First boundary
2. Second boundary

### Included Services

* Managed hosting
* **Daily** backups`);

    expect(html).toContain("<h2>Terms</h2>");
    expect(html).toContain("<p>Intro for <strong>Client</strong>.</p>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>First boundary</li>");
    expect(html).toContain("<h4>Included Services</h4>");
    expect(html).toContain("<li><strong>Daily</strong> backups</li>");
  });

  test("preserves ordered numbering around nested bullet groups", () => {
    const html = renderSafeMarkdown(`1. Fees
   * Setup fees
   * Recurring fees
2. Request management`);

    expect(html).toContain("<li>Fees</li>");
    expect(html).toContain("<ul>");
    expect(html).toContain('<ol start="2">');
    expect(html).toContain("<li>Request management</li>");
  });

  test("escapes raw HTML and script content", () => {
    const html = renderSafeMarkdown("<script>alert('x')</script>\n\n**Safe**");

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(html).toContain("<strong>Safe</strong>");
  });
});
