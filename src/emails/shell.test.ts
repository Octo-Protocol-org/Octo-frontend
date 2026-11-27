import { describe, expect, it } from "vitest";
import { escapeHtml, shell } from "./shell";

describe("escapeHtml", () => {
  it.each([
    ["&", "&amp;"],
    ["<", "&lt;"],
    [">", "&gt;"],
    ['"', "&quot;"],
    ["'", "&#39;"],
  ])("escapes %s", (input, expected) => {
    expect(escapeHtml(input)).toBe(expected);
  });

  it("escapes a combined payload so it cannot form tags or attributes", () => {
    expect(escapeHtml(`<img src=x onerror=alert(1)>`)).toBe(
      "&lt;img src=x onerror=alert(1)&gt;",
    );
  });

  it("leaves backticks untouched (not HTML-significant)", () => {
    // Backticks are inert in HTML text and attribute values; escaping them is unnecessary.
    expect(escapeHtml("`code`")).toBe("`code`");
  });

  it("escapes every occurrence, not just the first", () => {
    expect(escapeHtml("a<b>&c<")).toBe("a&lt;b&gt;&amp;c&lt;");
  });
});

describe("shell", () => {
  it("wraps the body and returns HTML", () => {
    const html = shell("<p>hi</p>");
    expect(html).toContain("<p>hi</p>");
    expect(html).toContain("Octo");
  });

  it("renders the requested icon when one is given", () => {
    expect(shell("<p>hi</p>", "check")).toContain("/icon-check.png");
  });

  it("renders no icon badge when none is given", () => {
    expect(shell("<p>hi</p>")).not.toContain("/icon-check.png");
  });
});
