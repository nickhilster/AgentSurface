/**
 * Deterministic, best-effort HTML -> Markdown extraction from a confirmed content
 * boundary in real rendered HTML. This is intentionally simple: it does not attempt
 * to preserve links, images, or rich inline formatting in v0.1. Known limitation,
 * documented in the dogfood report rather than silently accepted as "done".
 */

const BLOCK_TAGS = new Set(["p", "div", "section", "article", "ul", "ol", "li", "br", "h1", "h2", "h3", "h4", "h5", "h6"]);

export function extractContentBoundary(html: string, tag: string): string | null {
  const openRegex = new RegExp(`<${tag}[^>]*>`, "i");
  const openMatch = openRegex.exec(html);
  if (!openMatch) return null;

  const startIdx = openMatch.index + openMatch[0].length;
  const openTagRe = new RegExp(`<${tag}\\b`, "gi");
  const closeTagRe = new RegExp(`</${tag}>`, "gi");

  // Track nesting depth in case of a (currently unexpected but possible) nested tag of the same name.
  let depth = 1;
  let searchFrom = startIdx;
  let endIdx = -1;

  while (depth > 0) {
    openTagRe.lastIndex = searchFrom;
    closeTagRe.lastIndex = searchFrom;
    const nextOpen = openTagRe.exec(html);
    const nextClose = closeTagRe.exec(html);

    if (!nextClose) break; // malformed HTML, bail out rather than fabricate a boundary

    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      searchFrom = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      searchFrom = nextClose.index + nextClose[0].length;
      if (depth === 0) endIdx = nextClose.index;
    }
  }

  if (endIdx === -1) return null;
  return html.slice(startIdx, endIdx);
}

export function htmlToMarkdown(fragment: string): string {
  let text = fragment;

  // Remove script/style blocks entirely, including content.
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");

  // Headings -> Markdown headings.
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, inner) => `\n# ${stripTags(inner)}\n`);
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, inner) => `\n## ${stripTags(inner)}\n`);
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, inner) => `\n### ${stripTags(inner)}\n`);
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, inner) => `\n#### ${stripTags(inner)}\n`);
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, inner) => `\n##### ${stripTags(inner)}\n`);
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, inner) => `\n###### ${stripTags(inner)}\n`);

  // List items -> "- item".
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => `\n- ${stripTags(inner).trim()}`);

  // Paragraph/div/section/br boundaries become line breaks.
  for (const tag of ["p", "div", "section", "article"]) {
    text = text.replace(new RegExp(`<${tag}[^>]*>`, "gi"), "\n");
    text = text.replace(new RegExp(`</${tag}>`, "gi"), "\n");
  }
  text = text.replace(/<br\s*\/?>/gi, "\n");

  text = stripTags(text);
  text = decodeEntities(text);

  // Collapse excessive blank lines and trailing whitespace per line.
  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
