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
    expect(metadata.title).toBe("Your data on this device · Annus Mirabilis");
    expect(metadata.description).toContain("Review, export, or clear");

    logger.log({
      testId: "your-data-page-metadata",
      beadId: BEAD,
      outcome: "passed",
      message: "YourDataPage metadata is correctly declared",
    });
  });
});
