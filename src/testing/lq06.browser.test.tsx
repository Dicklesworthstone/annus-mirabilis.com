import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import CoefficientMatchPage from "../app/lab/lq-06/page.tsx";
import { CoefficientMatchLab } from "../components/lab/lq06/CoefficientMatchLab.tsx";
import { createLq06Session, type PreparedLq06Example } from "../experiments/lq06/session.ts";
import rawExample from "../generated/lq06-example.json";
import { containsHeading } from "./headingText.ts";

/**
 * Heading assertions below use the SHARED containsHeading imported above, which folds case and
 * scopes the match to an h1-h6 element (am-edit-voice-lint-trmf).
 *
 * This file carried a private copy of the weak version - `html.toLowerCase().includes(...)` -
 * which 67956679 replaced everywhere else after measuring that it let an aria-label two elements
 * away stand in for a heading that had been deleted outright. e79c5f3c added the import without
 * removing the local, leaving a duplicate binding that `bun test` ran happily and `tsc` refused
 * with TS2440. Both the local and its docblock are gone; the limits of the shared helper are
 * documented at its definition.
 */

const example = rawExample as unknown as PreparedLq06Example;

describe("LQ-06 Matching Entropy Coefficients Lab View & Route (am-lq-06-coefficient-match-n8pe)", () => {
  test("static page renders cleanly without JavaScript and includes key sections and mathematical explanations", () => {
    const html = renderToStaticMarkup(<CoefficientMatchPage />);
    expect(html).toContain("The radiation entropy law matches the gas entropy law");
    expect(html).toContain("The exponent identifies the light quantum");
    expect(containsHeading(html, "The Entropy Volume Laws Placed Side by Side")).toBe(true);
    expect(containsHeading(html, "The Move: Equating the Functional Forms")).toBe(true);
    expect(containsHeading(html, "Energy per Element and Historical Constants")).toBe(true);
    expect(containsHeading(html, "Mean Quantum Energy over a Wien Spectrum")).toBe(true);
    expect(containsHeading(html, "The Three Logical Roles")).toBe(true);
    expect(html).toContain('data-instrument-id="lq-06"');
    expect(html).toContain('data-testid="lq06-coefficient-match-lab"');
  });

  test("CoefficientMatchLab renders with static worked example and displays side-by-side plots and role cards", () => {
    const html = renderToStaticMarkup(<CoefficientMatchLab example={example} />);
    expect(html).toContain('data-instrument-id="lq-06"');
    // Two heading FRAGMENTS and two SVG labels, and the difference is the whole point
    // (am-edit-voice-lint-trmf). The first and fourth name h-elements that 29050744 moved to
    // sentence case, so they are scoped to a heading and case-folded. The two between them are
    // <text> nodes inside the plot, where the label IS the contract and its case is not this
    // pass's business, so they stay verbatim.
    //
    // Fragments are why this file was not in the eleven hardened ahead of that commit: the
    // pin-scan searched for COMPLETE heading strings, and "Side-by-Side Entropy Volume Laws" is
    // four words of "Side-by-Side Entropy Volume Laws (§6 The Move)".
    expect(containsHeading(html, "Side-by-Side Entropy Volume Laws")).toBe(true);
    expect(html).toContain("Wien Monochromatic Radiation");
    expect(html).toContain("Ideal Gas / Solute Molecules");
    expect(containsHeading(html, "Wien Spectrum Mean Quantum Energy")).toBe(true);
    expect(html).toContain("1. Derivation (Algebra)");
    expect(html).toContain("2. Heuristic Inference");
    expect(html).toContain("3. Further Hypothesis");
  });

  test("session initializes with accepted snapshot and updates correspondence verdict on selection", () => {
    const session = createLq06Session("test-lq06-session", example);
    const snap = session.getSnapshot().accepted;
    expect(snap).not.toBeNull();
    expect(snap?.experimentId).toBe("lq-06");

    const effectiveCountOut = snap?.outputs.find(
      (o) => o.quantityId === "effectiveIndependentCount",
    );
    expect(effectiveCountOut).toBeDefined();
    expect(effectiveCountOut?.status).toBe("value");

    const verdictInit = snap?.outputs.find((o) => o.quantityId === "correspondenceVerdict");
    expect(verdictInit).toBeDefined();
    expect(verdictInit?.status).toBe("not-applicable");

    // After selecting matching subexpression:
    session.apply({ selectedSubexpression: "N_E_over_R_beta_nu" });
    const snapUpdated = session.getSnapshot().accepted;
    const verdictMatch = snapUpdated?.outputs.find((o) => o.quantityId === "correspondenceVerdict");
    expect(verdictMatch?.status).toBe("value");
    if (verdictMatch?.status === "value") {
      expect(verdictMatch.value).toBe(1);
    }
  });
});
