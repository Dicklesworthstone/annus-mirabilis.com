import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import IonizationPage from "../app/lab/lq-09/page.tsx";
import { IonizationLab } from "../components/lab/lq09/IonizationLab.tsx";
import { createLq09Session } from "../experiments/lq09/session.ts";
import type { AcceptedSnapshot } from "../experiments/store/instanceStore.ts";
import example from "../generated/lq09-example.json";

function getNumericValue(snap: AcceptedSnapshot | null, quantityId: string): number {
  if (!snap) throw new Error("Missing snapshot");
  const output = snap.outputs.find((o) => o.quantityId === quantityId);
  if (output?.status !== "value" || typeof output.value !== "number") {
    throw new Error(`Expected numeric value for ${quantityId}, got ${output?.status}`);
  }
  return output.value;
}

function getNotApplicableReason(snap: AcceptedSnapshot | null, quantityId: string): string {
  if (!snap) throw new Error("Missing snapshot");
  const output = snap.outputs.find((o) => o.quantityId === quantityId);
  if (output?.status !== "not-applicable") {
    throw new Error(`Expected not-applicable for ${quantityId}, got ${output?.status}`);
  }
  return output.reason;
}

describe("LQ-09 Gas Ionization Lab View & Route", () => {
  test("static page renders cleanly without javascript and includes key sections", () => {
    const html = renderToStaticMarkup(<IonizationPage />);
    expect(html).toContain("Threshold frequency sets the bound");
    expect(html).toContain("The Single-Quantum Ionization Conservation Law");
    expect(html).toContain('data-view-id="lq-09-energy-ladder"');
    expect(html).toContain('data-view-id="lq-09-rate-budget"');
    expect(html).toContain("Accepted Laboratory Telemetry Snapshot");
    expect(html).toContain("Limits of this Reference Model (Not Modeled)");
    expect(html).toContain("Secondary ionization and cascade ionization");
  });

  test("lab component renders with static worked example and displays defaults", () => {
    const html = renderToStaticMarkup(<IonizationLab example={example} />);
    expect(html).toContain("2901.59 THz");
    expect(html).toContain("10.00 eV");
    expect(html).toContain("1.00 μW");
    expect(html).toContain('data-quantity-id="ionizationEnergyPerMolecule"');
    expect(html).toContain('data-quantity-id="ionizationRate"');
    expect(html).toContain('data-quantity-id="ionizedGramMolecules"');
  });

  test("session evaluates ionization physics correctly for golden default", () => {
    const session = createLq09Session("test-session", example);
    const snap = session.getSnapshot().accepted;
    expect(snap).not.toBeNull();
    const p = session.acceptedParameters();
    expect(p.frequency).toBe(2.90159e15);
    expect(p.ionizationEnergyEv).toBe(10.0);

    const qe = getNumericValue(snap, "quantumEnergyEv");
    expect(qe).toBeCloseTo(12.0, 1);

    const ionRate = getNumericValue(snap, "ionizationRate");
    expect(ionRate).toBeCloseTo(2.60063e11, -7);
  });

  test("doubling radiant power doubles absorbed quanta and ionization rate", () => {
    const session = createLq09Session("test-power-doubling", example);
    const initialSnap = session.getSnapshot().accepted;
    const initialRate = getNumericValue(initialSnap, "ionizationRate");
    const initialExcess = getNumericValue(initialSnap, "excessEnergyEv");

    session.apply({ incidentPower: 2e-6 }); // Double to 2 uW
    const updatedSnap = session.getSnapshot().accepted;
    const updatedRate = getNumericValue(updatedSnap, "ionizationRate");
    const updatedExcess = getNumericValue(updatedSnap, "excessEnergyEv");

    // Ionization rate doubles
    expect(updatedRate).toBeCloseTo(initialRate * 2, -6);
    // Excess photon energy is invariant
    expect(updatedExcess).toBeCloseTo(initialExcess, 6);
  });

  test("sub-threshold frequency (h*nu < J_mol) returns not-applicable", () => {
    const session = createLq09Session("test-threshold", example);
    // 2176.19 THz -> 9.0 eV < 10.0 eV
    session.apply({ frequency: 2.17619e15, ionizationEnergyEv: 10.0 });
    const snap = session.getSnapshot().accepted;
    const reason = getNotApplicableReason(snap, "ionizationRate");
    expect(reason).toBe("no single-quantum ionization under this hypothesis");
  });

  test("historical Lenard check preset evaluates correctly", () => {
    const session = createLq09Session("test-lenard-check", example);
    // 190 nm UV ~ 1.57895 PHz with 6.459 eV threshold
    session.apply({
      frequency: 1.57895e15,
      ionizationEnergyEv: 6.459,
      absorptionEfficiency: 1.0,
    });
    const snap = session.getSnapshot().accepted;
    const qe = getNumericValue(snap, "quantumEnergyEv");
    expect(qe).toBeCloseTo(6.5255, 1);
  });
});
