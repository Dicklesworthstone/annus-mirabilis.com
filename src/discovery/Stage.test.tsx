import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Stage } from "./Stage.tsx";
import { FIXTURE_JOURNEY_BROWNIAN } from "./testing/fixtureJourney.ts";

describe("Stage component rendering", () => {
  const stage = FIXTURE_JOURNEY_BROWNIAN.stages[0]!;

  test("renders stage title, question, premise citations, and support ladder", () => {
    const html = renderToStaticMarkup(<Stage stage={stage} index={0} />);

    expect(html).toContain("Stage 01 · Inquiry");
    expect(html).toContain("Zero average is not no movement");
    expect(html).toContain("Why do symmetric random steps yield zero mean but non-zero spread?");
    expect(html).toContain("#card-osmotic-pressure");
    expect(html).toContain("#card-stokes-law");
    expect(html).toContain("/lab/bm-01/");
    expect(html).toContain("Support Ladder · Five Rungs of Understanding");
    expect(html).toContain("1. Worked Example");
    expect(html).toContain("2. Partial Comparison");
    expect(html).toContain("3. Prediction Opportunity");
    expect(html).toContain("4. Physical Explanation");
    expect(html).toContain("5. Transfer Case");
  });
});
