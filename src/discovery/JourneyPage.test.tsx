import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { containsHeading } from "../testing/headingText.ts";
import { JourneyPage } from "./JourneyPage.tsx";
import { FIXTURE_JOURNEY_BROWNIAN, FIXTURE_PARTIAL_JOURNEY } from "./testing/fixtureJourney.ts";

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

describe("JourneyPage container component rendering", () => {
  test("renders complete Brownian motion journey with data-theme kramgasse-night and all sections", () => {
    const html = renderToStaticMarkup(<JourneyPage journey={FIXTURE_JOURNEY_BROWNIAN} />);

    expect(html).toContain('data-journey-id="brownian-motion"');
    expect(html).toContain('data-theme="kramgasse-night"');
    expect(html).toContain(
      "Suspended microscopic particles in a liquid at rest never settle into permanent stillness.",
    );
    expect(html).toContain(
      "How can the thermal agitation of invisible molecules produce observable microscopic motion?",
    );
    expect(html).toContain("#card-osmotic-pressure");
    expect(html).toContain("The move");
    expect(containsHeading(html, "World Checks · Testing the Consequences")).toBe(true);
    expect(html).toContain("Connecting to the 1905 Paper");
    // The doors, in the reader's words since dispatch 276 (Doors.test.tsx).
    expect(html).toContain("All doors arrive at the same result");
  });

  test("renders partial journey with declared pending elements banner", () => {
    const html = renderToStaticMarkup(<JourneyPage journey={FIXTURE_PARTIAL_JOURNEY} />);

    expect(html).toContain("Draft journey · Pending elements declared");
    expect(html).toContain("worldChecks:");
    expect(html).toContain("Photoelectric and photoluminescence data checks in preparation.");
    expect(html).toContain("am-disc-journey-i-chain-n1lh");
  });
});
