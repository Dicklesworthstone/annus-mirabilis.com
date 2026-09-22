import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { containsHeading } from "../testing/headingText.ts";
import { Stage } from "./Stage.tsx";
import { FIXTURE_JOURNEY_BROWNIAN } from "./testing/fixtureJourney.ts";

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

describe("Stage component rendering", () => {
  const stage = FIXTURE_JOURNEY_BROWNIAN.stages[0];
  if (!stage) throw new Error("Missing stages fixture");

  test("renders stage title, question, premise citations, and support ladder", () => {
    const html = renderToStaticMarkup(<Stage stage={stage} index={0} />);

    expect(html).toContain("Stage 01 · Inquiry");
    expect(html).toContain("Zero average is not no movement");
    expect(html).toContain("Why do symmetric random steps yield zero mean but non-zero spread?");
    expect(html).toContain("#card-osmotic-pressure");
    expect(html).toContain("#card-stokes-law");
    expect(html).toContain("/lab/bm-01/");
    expect(containsHeading(html, "Support Ladder · Five Rungs of Understanding")).toBe(true);
    expect(html).toContain("1. Worked Example");
    expect(html).toContain("2. Partial Comparison");
    expect(html).toContain("3. Prediction Opportunity");
    expect(html).toContain("4. Physical Explanation");
    expect(html).toContain("5. Transfer Case");
  });
});
