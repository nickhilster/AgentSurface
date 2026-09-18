import { describe, expect, it } from "vitest";
import { extractContentBoundary, htmlToMarkdown } from "./htmlToMarkdown.js";

describe("extractContentBoundary", () => {
  it("extracts content between a matched <main> pair", () => {
    const html = "<html><body><header>nav</header><main id=\"x\"><p>hello</p></main><footer>f</footer></body></html>";
    expect(extractContentBoundary(html, "main")).toBe("<p>hello</p>");
  });

  it("returns null when the tag is not present", () => {
    expect(extractContentBoundary("<html><body>no main here</body></html>", "main")).toBeNull();
  });

  it("returns null on malformed HTML with an unclosed tag", () => {
    expect(extractContentBoundary("<main><p>oops", "main")).toBeNull();
  });

  it("handles nested same-name tags by tracking depth", () => {
    const html = "<main><p>outer</p><main>inner</main><p>after</p></main>";
    expect(extractContentBoundary(html, "main")).toBe("<p>outer</p><main>inner</main><p>after</p>");
  });
});

describe("htmlToMarkdown", () => {
  it("converts headings and paragraphs", () => {
    const md = htmlToMarkdown("<h1>Title</h1><p>Body text.</p>");
    expect(md).toContain("# Title");
    expect(md).toContain("Body text.");
  });

  it("converts list items to markdown bullets", () => {
    const md = htmlToMarkdown("<ul><li>One</li><li>Two</li></ul>");
    expect(md).toContain("- One");
    expect(md).toContain("- Two");
  });

  it("decodes named and numeric HTML entities, including hex entities", () => {
    const md = htmlToMarkdown("<p>Don&#x27;t &amp; won&#39;t &mdash; really</p>");
    expect(md).toBe("Don't & won't — really");
  });

  it("strips script and style blocks entirely, including their content", () => {
    const md = htmlToMarkdown("<p>Keep</p><script>alert('drop me')</script><style>.x{color:red}</style>");
    expect(md).toBe("Keep");
  });

  it("collapses excessive blank lines", () => {
    const md = htmlToMarkdown("<p>A</p><div></div><div></div><div></div><p>B</p>");
    expect(md).not.toMatch(/\n{3,}/);
  });
});
