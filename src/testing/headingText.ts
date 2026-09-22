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
 * WHEN THE HEADING IS CONTENT RATHER THAN CHROME, DO NOT NAME IT HERE AT ALL.
 *
 * The paragraph above is right that a reworded heading should break an assertion and bring
 * somebody to look. That holds where the heading is CHROME - a label the interface owns, like
 * "No network transmission", which changes rarely and deliberately.
 *
 * It is wrong where the heading is CONTENT: authored per record, expected to improve, and owned
 * by whoever is writing the copy rather than by the test. There, naming the string makes the test
 * fire on correct work, and it fires at the person least able to tell a regression from an
 * improvement - the copy author, mid-pass, reading a red lane.
 *
 * Measured, 2026-09-22, rather than offered as a preference. Two cases of each:
 *
 *   CHROME, and the test was right to break
 *     your-data/page.test.tsx named "Full Portability" and "Unilateral Deletion". Renaming them
 *     to plain English broke it, correctly: three privacy guarantees are interface labels and
 *     somebody should confirm all three still render. Repaired by updating the literals and
 *     moving all three to containsHeading (843ff3a0).
 *     papers/page.test.tsx asserted that the Brownian entry is identifiable without the words
 *     "Brownian motion". A copy pass tried to normalise that heading and the test refused. The
 *     test was right and the copy change was reverted; nothing here was loosened.
 *
 *   CONTENT, and naming the string was the defect
 *     foundCalculus.browser.test.mjs asserted the literal "One worked example" on four
 *     foundations and in print. That string was identical on all 27 foundation pages until each
 *     record gained an `exampleTitle` naming its case, at which point both AC6 tests went red
 *     while every page still rendered correctly with scripting off. Repaired by reading the
 *     heading from content/foundations/<id>.json with the renderer's own fallback (a8bda77c),
 *     which also catches a page rendering some OTHER foundation's heading - something a shared
 *     literal never could.
 *
 * So the question to ask before naming a heading in an assertion is not "will this change" but
 * "who owns this string". If a record owns it, read it from the record. If the interface owns it,
 * name it and accept the break. A count or a list is the same question: discover/route.test.ts
 * named four slugs until the contract changed under it, and now derives them (83d50a5c).
 *
 * Limits, stated rather than left to be discovered: the extractor is a regex over server-rendered
 * markup, so a `>` inside an attribute value of a heading's own tag would end the tag early, and
 * nested markup inside a heading is flattened to its text. Both are fine for `renderToStaticMarkup`
 * output and neither is fine for arbitrary HTML.
 */

/**
 * A typed refusal, not a bare Error. The one refusal in this file is load-bearing: an empty
 * needle is contained by every string, so `containsHeading(html, "")` would return true on a
 * page with no heading at all, and the assertion built on it would report a section present
 * that is not there. That is the exact failure this module exists to prevent, arriving through
 * the module itself, so it refuses with a code that a test can name rather than a message a
 * test can only match loosely.
 */
export class HeadingAssertionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "HeadingAssertionError";
    this.code = code;
  }
}

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
  if (needle.length === 0) {
    throw new HeadingAssertionError(
      "empty-heading-needle",
      "containsHeading was given a blank heading, which every heading contains and every page without a heading also satisfies.",
    );
  }
  return headingTexts(html).some((text) => text.toLowerCase().includes(needle));
}
