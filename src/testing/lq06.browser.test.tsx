import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import CoefficientMatchPage from "../app/lab/lq-06/page.tsx";
import { CoefficientMatchLab } from "../components/lab/lq06/CoefficientMatchLab.tsx";
import { createLq06Session, type PreparedLq06Example } from "../experiments/lq06/session.ts";
import type { AcceptedSnapshot } from "../experiments/store/instanceStore.ts";
import example from "../generated/lq06-example.json";

function getNumericValue(snap: AcceptedSnapshot | null, quantityId: string): number {
  if (!snap) throw new Error("Missing snapshot");
  const output = snap.outputs.find((o) => o.quantityId === quantityId);
  if (output?.status !== "value" || typeof output.value !== "number") {
    throw new Error(`Expected numeric value for ${quantityId}, got ${output?.status}`);
  }
  return output.value;
}

describe("LQ-06 Coefficient Match Lab View & Route", () => {
  test("static page renders cleanly without JavaScript and includes key theory sections", () => {
    const html = renderToStaticMarkup(<CoefficientMatchPage />);
    expect(html).toContain("The radiation entropy law matches the gas entropy law");
    expect(html).toContain("The Entropy Volume Laws Placed Side by Side");
    expect(html).toContain("The Move: Equating the Functional Forms");
    expect(html).toContain("Energy per Element and Historical Constants");
    expect(html).toContain("Mean Quantum Energy over a Wien Spectrum");
    expect(html).toContain("The Three Logical Roles");
    expect(html).toContain('data-view-id="lq-06-side-by-side"');
    expect(html).toContain('data-view-id="lq-06-mean-energy-strip"');
    expect(html).toContain("Limits of this Reference Model (Not Modeled)");
  });

  test("lab component renders with static worked example and displays defaults", () => {
    const html = renderToStaticMarkup(
      <CoefficientMatchLab example={example as unknown as PreparedLq06Example} />,
    );
    expect(html).toContain("9.0556 nJ");
    expect(html).toContain("600.00 THz");
    expect(html).toContain("2.481401 eV");
    expect(html).toContain('data-quantity-id="effectiveIndependentCount"');
    expect(html).toContain('data-quantity-id="quantumEnergyEv"');
    expect(html).toContain('data-quantity-id="radiationEntropy"');
    expect(html).toContain('data-quantity-id="entropyVolumeCoefficient"');
    expect(html).toContain('data-quantity-id="meanQuantumEnergyWienEv"');
  });

  test("session evaluates correctly with golden parameters", () => {
    const session = createLq06Session("test-session", example as unknown as PreparedLq06Example);
    const snap = session.getSnapshot().accepted;
    expect(snap).not.toBeNull();

    const nEff = getNumericValue(snap, "effectiveIndependentCount");
    expect(nEff).toBeCloseTo(2.277774e10, -5);

    const qe = getNumericValue(snap, "quantumEnergyEv");
    expect(qe).toBeCloseTo(2.4814, 3);

    const meanEv = getNumericValue(snap, "meanQuantumEnergyWienEv");
    expect(meanEv).toBeCloseTo(0.7756, 3);

    const ratio = getNumericValue(snap, "meanEnergyRatio");
    expect(ratio).toBeCloseTo(2.0, 5);
  });

  test("subexpression selection correctly reveals matching and calculates values", () => {
    const session = createLq06Session(
      "test-subexpression",
      example as unknown as PreparedLq06Example,
    );

    session.apply({
      selectedSubexpression: "N_E_over_R_beta_nu",
      proposedEnergyElement: "h_nu",
      forkAChoice: "independent-quanta",
    });

    const snap = session.getSnapshot().accepted;
    const verdict = getNumericValue(snap, "correspondenceVerdict");
    expect(verdict).toBe(1);

    const qe = getNumericValue(snap, "quantumEnergyEv");
    expect(qe).toBeCloseTo(2.4814, 3);
  });
});
