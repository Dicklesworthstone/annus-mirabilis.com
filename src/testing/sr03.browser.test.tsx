import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import RodSimultaneityPage from "../app/lab/sr-03/page.tsx";
import { RodSimultaneityLab } from "../components/lab/RodSimultaneityLab.tsx";
import { createSr03Session } from "../experiments/sr03/session.ts";
import example from "../generated/sr03-example.json";

describe("SR-03 Rod Measurement and Simultaneity Lab View & Route (am-sr-03-rod-simultaneity-0l5i)", () => {
  test("static page renders cleanly without JavaScript and includes key sections and mathematical explanations", () => {
    const html = renderToStaticMarkup(<RodSimultaneityPage />);
    expect(html).toContain("Simultaneity is relative");
    expect(html).toContain("moving bodies contract");
    expect(html).toContain("§2: The Relativity of Simultaneity");
    expect(html).toContain("§4: Physical Meaning of Moving Rods and Spheres");
    expect(html).toContain("Coordinate Measurement Versus Visual Appearance");
    expect(html).toContain("Invariant Spacetime Intervals and Causal Order");
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
    expect(html).toContain("Discovery Mode: Predict Before Calculating");
    expect(html).toContain("Relativity of Simultaneity");
    expect(html).toContain("Spacetime Event Diagram");
    expect(html).toContain("Spatial Rod Strip Projection");
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
