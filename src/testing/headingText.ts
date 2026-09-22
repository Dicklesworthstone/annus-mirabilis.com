/**
 * Heading assertions for the browser lanes (am-edit-voice-lint-trmf).
 *
 * The browser tests assert that a section is PRESENT by looking for its heading. Three of them
 * spelled that as `expect(html).toContain("Some Title Cased Heading")`, which broke whenever the
 * de-slop pass moved a heading from Title Case to the site's sentence case although the section
 * was still rendering. The first repair was to lowercase both sides, and it traded one defect for
 * a worse one: it was measured on 2026-09-22 that deleting the `<h4>` from lq09/IonizationLab.tsx
 * outright left `src/testing/lq09.browser.test.tsx` fully green, because the same words appear two
 * elements later in
 *
 *     aria-label="Accepted laboratory telemetry snapshot table"
 *
 * which is already sentence case and so satisfied the lowercased substring. A case-sensitive
 * assertion on a Title Cased heading could not be fooled that way; the case-insensitive one could.
 *
 * So the comparison is scoped to heading ELEMENTS as well as case-folded. An aria-label, a caption
 * or a paragraph repeating the words can no longer stand in for the heading, and a change of case
 * still passes. This is a middle rung, not the destination: the durable fix is a stable id on each
 * heading, which these pages do not have (one section id covers a whole page), and a REWORDING
 * still breaks these assertions by design, because a reworded heading is a different heading and
 * somebody should look at it.
 *
 * Limits, stated rather than left to be discovered: the extractor is a regex over server-rendered
 * markup, so a `>` inside an attribute value of a heading's own tag would end the tag early, and
 * nested markup inside a heading is flattened to its text. Both are fine for `renderToStaticMarkup`
 * output and neither is fine for arbitrary HTML.
 */

const HEADING_ELEMENT = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;

const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
};

function decode(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|nbsp|#x27|#39);/g, (m) => ENTITIES[m] ?? m);
}

/** The flattened text of every h1-h6 element in `html`, in document order. */
export function headingTexts(html: string): string[] {
  const out: string[] = [];
  for (const match of html.matchAll(HEADING_ELEMENT)) {
    const inner = match[2] ?? "";
    const text = decode(inner.replace(/<[^>]*>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 0) out.push(text);
  }
  return out;
}

/**
 * True when some heading element's text contains `heading`, compared without regard to case.
 * Text outside a heading element never satisfies this, which is the whole point.
 */
export function containsHeading(html: string, heading: string): boolean {
  const needle = heading.replace(/\s+/g, " ").trim().toLowerCase();
  if (needle.length === 0) throw new Error("containsHeading: empty heading");
  return headingTexts(html).some((text) => text.toLowerCase().includes(needle));
}
