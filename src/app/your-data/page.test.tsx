import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
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
    expect(containsHeading(html, "No network transmission")).toBe(true);
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
