import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import ChargeCurrentPage from "../app/lab/sr-12/page.tsx";
import { ChargeCurrentLab } from "../components/lab/sr12/ChargeCurrentLab.tsx";
import type { PreparedSr12Example } from "../experiments/sr12/session.ts";
import rawExample from "../generated/sr12-example.json";
import { containsHeading } from "./headingText.ts";

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

const example = rawExample as unknown as PreparedSr12Example;

describe("SR-12 Lab View & Route (am-sr-12-charge-current-bgq0)", () => {
  test("static page renders cleanly without JavaScript and includes key sections and mathematical explanations", () => {
    const html = renderToStaticMarkup(<ChargeCurrentPage />);
    expect(html).toContain("Charge density is frame-dependent");
    expect(html).toContain("total charge is invariant");
    expect(html).toContain("Worked case (readable without JavaScript)");
    expect(html).toContain('data-instrument-id="sr-12"');
    expect(containsHeading(html, "Relativistic Four-Current Visualization")).toBe(true);
    expect(html).toContain("Unit System Modernization");
    expect(html).toContain("Gaussian 1905 (§9)");
  });

  test("ChargeCurrentLab renders with worked example and displays defaults", () => {
    const html = renderToStaticMarkup(<ChargeCurrentLab example={example} />);
    expect(html).toContain('data-instrument-id="sr-12"');
    expect(html).toContain("Neutral conductor (0.6c)");
    expect(html).toContain("Convection current (0.5c to 0.6c)");
    expect(html).toContain("Moving sphere (0.6c)");
    expect(html).toContain("Gaussian pulse continuity (0.5c)");
    expect(html).toContain("Current loop (0.6c)");
    expect(html).toContain("Four-Current Invariant");
    expect(html).toContain("Predict: is a neutral wire still neutral in a moving frame?");
  });
});
