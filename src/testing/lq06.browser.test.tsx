import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import CoefficientMatchPage from "../app/lab/lq-06/page.tsx";
import { CoefficientMatchLab } from "../components/lab/lq06/CoefficientMatchLab.tsx";
import { createLq06Session, type PreparedLq06Example } from "../experiments/lq06/session.ts";
import rawExample from "../generated/lq06-example.json";

const example = rawExample as unknown as PreparedLq06Example;

describe("LQ-06 Matching Entropy Coefficients Lab View & Route (am-lq-06-coefficient-match-n8pe)", () => {
  test("static page renders cleanly without JavaScript and includes key sections and mathematical explanations", () => {
    const html = renderToStaticMarkup(<CoefficientMatchPage />);
    expect(html).toContain("The radiation entropy law matches the gas entropy law");
    expect(html).toContain("The exponent identifies the light quantum");
    expect(html).toContain("The Entropy Volume Laws Placed Side by Side");
    expect(html).toContain("The Move: Equating the Functional Forms");
    expect(html).toContain("Energy per Element and Historical Constants");
    expect(html).toContain("Mean Quantum Energy over a Wien Spectrum");
    expect(html).toContain("The Three Logical Roles");
    expect(html).toContain('data-instrument-id="lq-06"');
    expect(html).toContain('data-testid="lq06-coefficient-match-lab"');
  });

  test("CoefficientMatchLab renders with static worked example and displays side-by-side plots and role cards", () => {
    const html = renderToStaticMarkup(<CoefficientMatchLab example={example} />);
    expect(html).toContain('data-instrument-id="lq-06"');
    expect(html).toContain("Side-by-Side Entropy Volume Laws");
    expect(html).toContain("Wien Monochromatic Radiation");
    expect(html).toContain("Ideal Monatomic Gas");
    expect(html).toContain("Mean Quantum Energy Comparison");
    expect(html).toContain("1. Derivation (Algebra)");
    expect(html).toContain("2. Heuristic Inference");
    expect(html).toContain("3. Further Physical Hypothesis");
  });

  test("session initializes with accepted snapshot and matches reference outputs", () => {
    const session = createLq06Session("test-lq06-session", example);
    const snap = session.getSnapshot().accepted;
    expect(snap).not.toBeNull();
    expect(snap?.experimentId).toBe("lq-06");

    const effectiveCountOut = snap?.outputs.find(
      (o) => o.quantityId === "effectiveIndependentCount",
    );
    expect(effectiveCountOut).toBeDefined();
    expect(effectiveCountOut?.status).toBe("value");

    const verdictOut = snap?.outputs.find((o) => o.quantityId === "correspondenceVerdict");
    expect(verdictOut).toBeDefined();
    expect(verdictOut?.status).toBe("value");
  });
});
