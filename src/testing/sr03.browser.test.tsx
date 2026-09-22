import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import RodSimultaneityPage from "../app/lab/sr-03/page.tsx";
import { RodSimultaneityLab } from "../components/lab/RodSimultaneityLab.tsx";
import { SR03_PROMPTS } from "../experiments/sr03/definition.ts";
import { createSr03Session } from "../experiments/sr03/session.ts";
import example from "../generated/sr03-example.json";
import { containsHeading } from "./headingText.ts";

/**
 * Heading assertions below compare case-insensitively (am-edit-voice-lint-trmf). They asserted
 * the exact capitalisation of a section heading in order to check that the SECTION IS PRESENT,
 * and so they broke when the de-slop pass normalised these pages from Title Case to the site's
 * sentence case, although every section they protect was still rendering.
 *
 * This is a partial hardening and it is worth being exact about the limit: lowercasing both
 * sides survives a case change and would NOT survive a rewording. The durable fix is a stable
 * per-section anchor, which these pages do not have - each carries one section id for the whole
 * page and none on the individual headings. Recorded rather than left implicit, so the next
 * person who hits this knows the ceiling of what is here.
 */

describe("SR-03 Rod Measurement and Simultaneity Lab View & Route (am-sr-03-rod-simultaneity-0l5i)", () => {
  test("static page renders cleanly without JavaScript and includes key sections and mathematical explanations", () => {
    const html = renderToStaticMarkup(<RodSimultaneityPage />);
    expect(html).toContain("Simultaneity is relative");
    expect(html).toContain("moving bodies contract");
    expect(containsHeading(html, "§2: The Relativity of Simultaneity")).toBe(true);
    expect(containsHeading(html, "§4: Physical Meaning of Moving Rods and Spheres")).toBe(true);
    expect(containsHeading(html, "Coordinate Measurement Versus Visual Appearance")).toBe(true);
    expect(containsHeading(html, "Invariant Spacetime Intervals and Causal Order")).toBe(true);
    expect(html).toContain('data-instrument-id="sr-03"');
    expect(html).toContain('data-testid="rod-simultaneity-lab"');
    expect(html).toContain('data-view-id="sr-03-lab"');
  });

  test("RodSimultaneityLab renders with static worked example and displays defaults", () => {
    const html = renderToStaticMarkup(
      <RodSimultaneityLab
        example={example as unknown as Parameters<typeof RodSimultaneityLab>[0]["example"]}
      />,
    );
    expect(html).toContain('data-instrument-id="sr-03"');
    expect(html).toContain("SR-03 · An executable laboratory");
    // The prompts sit in one closed disclosure. The two tab buttons that used to switch them were
    // labelled "Relativity of Simultaneity" and "Invariant Causal Order", which named each answer
    // before the question (b52335ab), so the check is for the disclosure and both questions.
    expect(html).toContain("<summary>Predict before calculating</summary>");
    const text = html.replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
    for (const key of ["endpoint-pair", "causal-order"] as const) {
      expect(text).toContain(SR03_PROMPTS[key].question);
    }
    expect(html).not.toContain("Relativity of Simultaneity");
    expect(html).not.toContain("Invariant Causal Order");
    expect(containsHeading(html, "Spacetime Event Diagram")).toBe(true);
    expect(containsHeading(html, "Spatial Rod Strip Projection")).toBe(true);
  });

  test("session initializes with accepted snapshot and preserves parameters", () => {
    const session = createSr03Session(
      "test-sr03-session",
      example as unknown as Parameters<typeof createSr03Session>[1],
    );
    const snap = session.getSnapshot().accepted;
    expect(snap).not.toBeNull();
    expect(snap?.experimentId).toBe("sr-03");

    const p = session.acceptedParameters();
    expect(p.v).toBe(0.6);
    expect(p.L0).toBe(10);
  });
});
