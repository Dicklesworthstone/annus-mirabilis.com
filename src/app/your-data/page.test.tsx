import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getLogger } from "../../testing/log/logger.ts";
import YourDataPage, { metadata } from "./page.tsx";

const logger = getLogger("platform-storage");
const BEAD = "am-plat-local-storage-km8f";

describe("YourDataPage", () => {
  test("static HTML includes privacy guarantees and explanation without JavaScript", () => {
    const html = renderToStaticMarkup(<YourDataPage />);

    expect(html).toContain("Your data stays on your device.");
    expect(html).toContain("No Network Transmission");
    expect(html).toContain("Full Portability");
    expect(html).toContain("Unilateral Deletion");
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
