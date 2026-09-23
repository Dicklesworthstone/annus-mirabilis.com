import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import PhotoelectricPage from "../app/lab/lq-08/page.tsx";
import { PhotoelectricLab } from "../components/lab/lq08/PhotoelectricLab.tsx";
import { createLq08Session } from "../experiments/lq08/session.ts";
import type { AcceptedSnapshot } from "../experiments/store/instanceStore.ts";
import example from "../generated/lq08-example.json";
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

describe("LQ-08 Photoelectric Apparatus Lab View & Route", () => {
  test("static page renders cleanly without javascript and includes key sections", () => {
    const html = renderToStaticMarkup(<PhotoelectricPage />);
    expect(html).toContain("Brighter light, more electrons.");
    expect(containsHeading(html, "The Single-Quantum Energy Conservation Law")).toBe(true);
    expect(html).toContain('data-view-id="lq-08-energy-diagram"');
    expect(html).toContain('data-view-id="lq-08-stopping-plot"');
    expect(html).toContain('data-view-id="lq-08-iv-curve"');
    expect(containsHeading(html, "Values at these settings")).toBe(true);
    expect(containsHeading(html, "What this model leaves out")).toBe(true);
    expect(html).toContain("Multi-photon or thermionic emission");
  });

  test("lab component renders with static worked example and displays defaults", () => {
    const html = renderToStaticMarkup(<PhotoelectricLab example={example} />);
    expect(html).toContain("600.0 THz");
    expect(html).toContain("2.20 eV");
    expect(html).toContain("1.00 mW");
    expect(html).toContain('data-quantity-id="maxKineticEnergy"');
    expect(html).toContain('data-quantity-id="stoppingPotentialMagnitude"');
  });

  test("session evaluates photoelectric physics correctly for sodium default", () => {
    const session = createLq08Session("test-session", example);
    const snap = session.getSnapshot().accepted;
    expect(snap).not.toBeNull();
    const p = session.acceptedParameters();
    expect(p.frequency).toBe(6.0e14);
    expect(p.workFunction).toBe(2.2);

    // At 600 THz on 2.2 eV sodium:
    // h*nu = 4.135667696e-15 * 6e14 = 2.4814 eV
    // K_max = 2.4814 - 2.2 = 0.2814 eV
    // V_s = 0.2814 V
    const vs = getNumericValue(snap, "stoppingPotentialMagnitude");
    expect(vs).toBeCloseTo(0.2814, 2);
  });

  test("doubling optical power changes photon and emission rates but preserves kinetic energy and stopping potential", () => {
    const session = createLq08Session("test-power-invariance", example);
    const initialSnap = session.getSnapshot().accepted;
    const initialVs = getNumericValue(initialSnap, "stoppingPotentialMagnitude");
    const initialQRate = getNumericValue(initialSnap, "quantumRate");

    session.apply({ incidentPower: 0.002 }); // Double to 2 mW
    const updatedSnap = session.getSnapshot().accepted;
    const updatedVs = getNumericValue(updatedSnap, "stoppingPotentialMagnitude");
    const updatedQRate = getNumericValue(updatedSnap, "quantumRate");

    // Rates double
    expect(updatedQRate).toBeCloseTo(initialQRate * 2, 5);
    // Stopping potential is completely invariant
    expect(updatedVs).toBeCloseTo(initialVs, 8);
  });

  test("sub-threshold frequency (h*nu < Phi) returns not-applicable for kinetic energy", () => {
    const session = createLq08Session("test-threshold", example);
    // 450 THz on 2.2 eV sodium: h*nu = 1.86 eV < 2.2 eV
    session.apply({ frequency: 4.5e14 });
    const snap = session.getSnapshot().accepted;
    const kMaxReason = getNotApplicableReason(snap, "maxKineticEnergy");
    expect(kMaxReason).toContain("no emitted electron in this model");

    const vsReason = getNotApplicableReason(snap, "stoppingPotentialMagnitude");
    expect(vsReason).toContain("no emitted electron in this model");
  });

  test("historical check preset produces about 4.3 V stopping potential", () => {
    const session = createLq08Session("test-historical-check", example);
    // UV spark ~ 1.03 PHz with Phi = 0
    session.apply({ frequency: 1.03e15, workFunction: 0.0 });
    const snap = session.getSnapshot().accepted;
    const vs = getNumericValue(snap, "stoppingPotentialMagnitude");
    expect(vs).toBeCloseTo(4.26, 1); // ~4.3 Volts
  });

  test("notModeled items are non-empty and properly disclosed", () => {
    const html = renderToStaticMarkup(<PhotoelectricLab example={example} />);
    expect(containsHeading(html, "What this model leaves out")).toBe(true);
    expect(html).toContain("Multi-photon or thermionic emission");
    expect(html).toContain("Contact potentials and surface states");
    expect(html).toContain("Space charge");
    expect(containsHeading(html, "Einstein’s 1905 §8 check, by order of magnitude")).toBe(true);
    expect(html).toContain("What was neglected:");
    expect(html).toContain("What it is not:");
  });
});
