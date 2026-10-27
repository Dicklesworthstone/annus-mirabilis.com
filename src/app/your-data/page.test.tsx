import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RESERVED_KEY_NOTES, RESERVED_KEYS } from "../../platform/storage/reservedKeys.ts";
import { containsHeading } from "../../testing/headingText.ts";
import { getLogger } from "../../testing/log/logger.ts";
import YourDataPage, { metadata } from "./page.tsx";

/**
 * Heading assertions here compare case-insensitively AND are scoped to heading elements
 * (am-edit-voice-lint-trmf). They asserted the exact Title Case of a heading in order to
 * check that the SECTION IS PRESENT, so they broke when the de-slop pass moved these pages
 * to the site's sentence case while every section they protect was still rendering.
 *
 * containsHeading is the shared helper, not a local lowercase: text outside an h1-h6 cannot
 * satisfy it. That matters because the first repair of this kind WAS a local lowercase, and
 * it let an aria-label two elements away stand in for a heading that had been deleted.
 */

const logger = getLogger("platform-storage");
const BEAD = "am-plat-local-storage-km8f";

describe("YourDataPage", () => {
  test("static HTML includes privacy guarantees and explanation without JavaScript", () => {
    const html = renderToStaticMarkup(<YourDataPage />);

    expect(html).toContain("Your data stays on your device.");
    expect(containsHeading(html, "Nothing you save is sent")).toBe(true);
    expect(containsHeading(html, "Take it with you")).toBe(true);
    expect(containsHeading(html, "Delete it yourself")).toBe(true);
    expect(html).toContain('data-testid="privacy-guarantees"');
    expect(html).toContain('data-testid="data-panel"');
    expect(html).toContain("JavaScript is currently disabled.");

    logger.log({
      testId: "your-data-page-static-explanation",
      beadId: BEAD,
      outcome: "passed",
      message:
        "YourDataPage serves complete privacy explanation and noscript notice in static HTML",
    });
  });

  test("every reserved key is named on the page, with the reason it is never written", () => {
    // The drift guard for am-oj0e. The page renders RESERVED_KEY_NOTES, so this cannot fail by
    // one of them being forgotten in the prose; what it CAN catch is the section being deleted or
    // the list being filtered, which would leave the gate permitting a key the page no longer
    // explains. The count is read from the list rather than typed, so paying the debt down is not
    // a test failure.
    const html = renderToStaticMarkup(<YourDataPage />);
    expect(containsHeading(html, "Some of these are never written")).toBe(true);
    expect(RESERVED_KEYS.length).toBeGreaterThan(0);
    for (const key of RESERVED_KEYS) expect(html).toContain(key);
    for (const note of RESERVED_KEY_NOTES) {
      expect(html).toContain(note.readerLabel);
      // The reader is never shown the engineering reason, which names beads and module paths.
      expect(html).not.toContain(note.engineeringReason);
    }
    // The site's voice forbids an em dash in anything a reader sees.
    for (const note of RESERVED_KEY_NOTES) expect(note.readerReason).not.toContain("\u2014");

    logger.log({
      testId: "your-data-reserved-keys-explained",
      beadId: "am-oj0e",
      outcome: "passed",
      message: `${RESERVED_KEYS.length} reserved key(s) named on /your-data/ with a reader-facing reason`,
    });
  });

  test("page metadata declares expected title and description", () => {
    // The property first, deliberately. A plant that puts the suffix back also breaks the
    // value assertion below, and whichever assertion runs first is the only one that ever
    // reaches a verdict - so the one carrying the reasoning goes first, or it is never proven.
    // The suffix is the ROOT LAYOUT's job. layout.tsx declares
    // title.template = "%s · Annus Mirabilis", which wraps every child segment's title, so a
    // page that spells the suffix itself ships it twice. Confirmed in the built HTML before this
    // was changed, not inferred:
    //   out/your-data/index.html
    //     <title>Your data on this device · Annus Mirabilis · Annus Mirabilis</title>
    //   out/papers/index.html
    //     <title>The four papers · Annus Mirabilis</title>
    // This assertion is the property rather than the value, so it survives a rewording of the
    // name and still refuses the doubling.
    expect(metadata.title).not.toContain("· Annus Mirabilis");

    expect(metadata.title).toBe("Your data on this device");
    expect(metadata.description).toContain("Review, export, or clear");

    logger.log({
      testId: "your-data-page-metadata",
      beadId: BEAD,
      outcome: "passed",
      message: "YourDataPage metadata is correctly declared",
    });
  });
});
