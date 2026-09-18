import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FIXTURE_JOURNEY_BROWNIAN } from "./testing/fixtureJourney.ts";
import { WorldCheck } from "./WorldCheck.tsx";

describe("WorldCheck component rendering", () => {
  const worldCheck = FIXTURE_JOURNEY_BROWNIAN.worldChecks[0];
  if (!worldCheck) throw new Error("Missing worldChecks fixture");

  test("renders world check claim, static worked example, and instrument link", () => {
    const html = renderToStaticMarkup(<WorldCheck check={worldCheck} />);

    expect(html).toContain(
      "The diffusion equation yields Avogadro&#x27;s number within experimental precision.",
    );
    expect(html).toContain("Printed Prediction");
    expect(html).toContain("Perrin (1908) gamboge emulsion");
    expect(html).toContain("6.8e23");
    expect(html).toContain("mol⁻¹");
    expect(html).toContain("bm-07");
    expect(html).toContain("avogadroNumber");
  });

  test("renders later evidence post-1904 resolution badge", () => {
    const html = renderToStaticMarkup(<WorldCheck check={worldCheck} />);

    expect(html).toContain("Post-1904 Experimental Resolution (1908)");
    expect(html).toContain("#perrin-1908-data");
    expect(html).toContain(
      "Jean Perrin&#x27;s sedimentation equilibrium and displacement measurements.",
    );
  });
});
