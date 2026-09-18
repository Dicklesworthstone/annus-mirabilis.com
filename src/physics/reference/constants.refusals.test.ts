/**
 * Refusal throw site test suite for constants.ts (am-muyh).
 *
 * Verifies all 10 previously untested refusal sites in src/physics/reference/constants.ts
 * with authentic accept/reject test pairs, asserting explicit refusal codes and
 * consistency issue records with exact line citations.
 *
 * All 10 sites are authentic physical consistency recomputations checking that registered
 * or candidate historical constant sets preserve primary-literature and manuscript consistency.
 * Zero mocks or synthetic stubs are used.
 */
import { describe, expect, test } from "bun:test";
import { type ConstantSet, checkPrintedConsistency, getConstantSet } from "./constants.ts";

function modifyEntry(
  set: ConstantSet,
  quantityId: string,
  modifier: (entry: ConstantSet["entries"][number]) => ConstantSet["entries"][number],
): ConstantSet {
  return {
    ...set,
    entries: set.entries.map((entry) =>
      entry.quantityId === quantityId ? modifier(entry) : entry,
    ),
  };
}

describe("constants.ts refusal throw sites (am-muyh)", () => {
  // --------------------------------------------------------------------------
  // Site 1: line 1196 - printed-inconsistency (Wien alpha misprint in light quanta)
  // --------------------------------------------------------------------------
  test("rejects uncorrected Wien alpha 10^-56 misprint in light quanta (constants.ts:1196)", () => {
    const realSet = getConstantSet("einstein-1905-light-quanta-printed");

    // Accept: real set corrected the misprint (printedStatus is printed-corrected)
    const cleanReport = checkPrintedConsistency(realSet);
    expect(cleanReport.ok).toBe(true);
    expect(cleanReport.issues.some((i) => i.code === "printed-inconsistency")).toBe(false);

    // Reject: uncorrected misprint with printedReading containing 10^-56 and status printed
    const badSet = modifyEntry(realSet, "wienConstantAlpha", (e) => ({
      ...e,
      printedStatus: "printed",
      printedReading: "4,20 . 10^-56",
    }));
    const badReport = checkPrintedConsistency(badSet);
    expect(badReport.ok).toBe(false);
    expect(
      badReport.issues.some(
        (i) =>
          i.quantityId === "wienConstantAlpha" &&
          i.code === "printed-inconsistency" &&
          i.message === "Alpha misprint 10^-56 was not corrected; gives N = 6.17e22.",
      ),
    ).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 2: line 1206 - recomputed-mismatch (Avogadro constant in light quanta)
  // --------------------------------------------------------------------------
  test("rejects recomputed Avogadro constant mismatch in light quanta (constants.ts:1206)", () => {
    const realSet = getConstantSet("einstein-1905-light-quanta-printed");

    // Accept: real set matches expected Avogadro N = 6.170486e23 within tolerance
    const cleanReport = checkPrintedConsistency(realSet);
    expect(
      cleanReport.issues.some(
        (i) => i.quantityId === "avogadroConstant" && i.code === "recomputed-mismatch",
      ),
    ).toBe(false);

    // Reject: altered beta value changes recomputed N outside relative tolerance 1e-6
    const badSet = modifyEntry(realSet, "wienConstantBeta", (e) => ({
      ...e,
      value: 5.0e-2,
    }));
    const badReport = checkPrintedConsistency(badSet);
    expect(badReport.ok).toBe(false);
    expect(
      badReport.issues.some(
        (i) =>
          i.quantityId === "avogadroConstant" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("Recomputed N") &&
          i.message.includes("does not match expected 6.170486e+23"),
      ),
    ).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 3: line 1220 - recomputed-mismatch (Stopping potential Pi in light quanta)
  // --------------------------------------------------------------------------
  test("rejects stopping potential Pi magnitude mismatch in light quanta (constants.ts:1220)", () => {
    const realSet = getConstantSet("einstein-1905-light-quanta-printed");

    // Accept: real set matches 4.3385 V within 1e-4 relative tolerance
    const cleanReport = checkPrintedConsistency(realSet);
    expect(
      cleanReport.issues.some(
        (i) =>
          i.quantityId === "stoppingPotentialMagnitude" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("Recomputed Pi"),
      ),
    ).toBe(false);

    // Reject: altered gramEquivalentCharge changes recomputed Pi
    const badSet = modifyEntry(realSet, "gramEquivalentCharge", (e) => ({
      ...e,
      value: 5.0e4,
    }));
    const badReport = checkPrintedConsistency(badSet);
    expect(badReport.ok).toBe(false);
    expect(
      badReport.issues.some(
        (i) =>
          i.quantityId === "stoppingPotentialMagnitude" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("Recomputed Pi") &&
          i.message.includes("does not match 4.3385 V"),
      ),
    ).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 4: line 1228 - recomputed-mismatch (Stopping potential slope in light quanta)
  // --------------------------------------------------------------------------
  test("rejects stopping potential slope mismatch in light quanta (constants.ts:1228)", () => {
    const realSet = getConstantSet("einstein-1905-light-quanta-printed");

    // Accept: real set matches 4.2121e-15 V s within 1e-4 relative tolerance
    const cleanReport = checkPrintedConsistency(realSet);
    expect(
      cleanReport.issues.some(
        (i) =>
          i.quantityId === "stoppingPotentialMagnitude" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("Recomputed slope"),
      ),
    ).toBe(false);

    // Reject: altered gramEquivalentCharge changes recomputed slope
    const badSet = modifyEntry(realSet, "gramEquivalentCharge", (e) => ({
      ...e,
      value: 5.0e4,
    }));
    const badReport = checkPrintedConsistency(badSet);
    expect(badReport.ok).toBe(false);
    expect(
      badReport.issues.some(
        (i) =>
          i.quantityId === "stoppingPotentialMagnitude" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("Recomputed slope") &&
          i.message.includes("does not match 4.2121e-15 V s"),
      ),
    ).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 5: line 1240 - recomputed-mismatch (Ionization work in light quanta)
  // --------------------------------------------------------------------------
  test("rejects ionization work per gram equivalent mismatch in light quanta (constants.ts:1240)", () => {
    const realSet = getConstantSet("einstein-1905-light-quanta-printed");

    // Accept: real set matches 6.3847e12 within 1e-4 relative tolerance
    const cleanReport = checkPrintedConsistency(realSet);
    expect(
      cleanReport.issues.some(
        (i) =>
          i.quantityId === "ionizationWorkPerGramEquivalent" && i.code === "recomputed-mismatch",
      ),
    ).toBe(false);

    // Reject: altered speed of light changes recomputed work
    const badSet = modifyEntry(realSet, "speedOfLight", (e) => ({
      ...e,
      value: 2.0e10,
    }));
    const badReport = checkPrintedConsistency(badSet);
    expect(badReport.ok).toBe(false);
    expect(
      badReport.issues.some(
        (i) =>
          i.quantityId === "ionizationWorkPerGramEquivalent" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("Recomputed ionization work") &&
          i.message.includes("does not match 6.3847e12"),
      ),
    ).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 6: line 1258 - recomputed-mismatch (Brownian 1s displacement)
  // --------------------------------------------------------------------------
  test("rejects Brownian 1s displacement mismatch (constants.ts:1258)", () => {
    const realSet = getConstantSet("einstein-1905-brownian-printed");

    // Accept: real set matches 0.7947833 um within 1e-5 relative tolerance
    const cleanReport = checkPrintedConsistency(realSet);
    expect(
      cleanReport.issues.some(
        (i) =>
          i.quantityId === "rmsDisplacement1d" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("1s displacement"),
      ),
    ).toBe(false);

    // Reject: altered viscosity changes 1s displacement
    const badSet = modifyEntry(realSet, "viscosity", (e) => ({
      ...e,
      value: 0.02,
    }));
    const badReport = checkPrintedConsistency(badSet);
    expect(badReport.ok).toBe(false);
    expect(
      badReport.issues.some(
        (i) =>
          i.quantityId === "rmsDisplacement1d" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("Recomputed 1s displacement") &&
          i.message.includes("does not match 0.7947833 um"),
      ),
    ).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 7: line 1266 - recomputed-mismatch (Brownian 60s displacement)
  // --------------------------------------------------------------------------
  test("rejects Brownian 60s displacement mismatch (constants.ts:1266)", () => {
    const realSet = getConstantSet("einstein-1905-brownian-printed");

    // Accept: real set matches 6.156365 um within 1e-5 relative tolerance
    const cleanReport = checkPrintedConsistency(realSet);
    expect(
      cleanReport.issues.some(
        (i) =>
          i.quantityId === "rmsDisplacement1d" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("60s displacement"),
      ),
    ).toBe(false);

    // Reject: altered particle radius changes 60s displacement
    const badSet = modifyEntry(realSet, "particleRadius", (e) => ({
      ...e,
      value: 0.002,
    }));
    const badReport = checkPrintedConsistency(badSet);
    expect(badReport.ok).toBe(false);
    expect(
      badReport.issues.some(
        (i) =>
          i.quantityId === "rmsDisplacement1d" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("Recomputed 60s displacement") &&
          i.message.includes("does not match 6.156365 um"),
      ),
    ).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 8: line 1279 - recomputed-mismatch (Mass-energy speedOfLightSquared)
  // --------------------------------------------------------------------------
  test("rejects mass-energy c^2 consistency mismatch (constants.ts:1279)", () => {
    const realSet = getConstantSet("einstein-1905-mass-energy-printed");

    // Accept: real set c^2 = 9e16 m^2/s^2 gives exactly 1 g for 9e20 erg
    const cleanReport = checkPrintedConsistency(realSet);
    expect(
      cleanReport.issues.some(
        (i) => i.quantityId === "speedOfLightSquared" && i.code === "recomputed-mismatch",
      ),
    ).toBe(false);

    // Reject: altered speedOfLightSquared value does not give 1 g
    const badSet = modifyEntry(realSet, "speedOfLightSquared", (e) => ({
      ...e,
      value: 8.0e16,
    }));
    const badReport = checkPrintedConsistency(badSet);
    expect(badReport.ok).toBe(false);
    expect(
      badReport.issues.some(
        (i) =>
          i.quantityId === "speedOfLightSquared" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("9e20 erg gives 1.125 g, expected 1 g"),
      ),
    ).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 9: line 1295 - recomputed-mismatch (Planck 1900/1901 h/k ratio)
  // --------------------------------------------------------------------------
  test("rejects Planck 1900/1901 h/k ratio mismatch (constants.ts:1295)", () => {
    const realSet = getConstantSet("planck-1900-1901-printed");

    // Accept: real set h/k matches 4.86627e-11 within 1e-3 relative tolerance
    const cleanReport = checkPrintedConsistency(realSet);
    expect(
      cleanReport.issues.some(
        (i) =>
          i.quantityId === "planckConstant" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("h/k ="),
      ),
    ).toBe(false);

    // Reject: altered boltzmannConstant changes h/k ratio
    const badSet = modifyEntry(realSet, "boltzmannConstant", (e) => ({
      ...e,
      value: 2.0e-23,
    }));
    const badReport = checkPrintedConsistency(badSet);
    expect(badReport.ok).toBe(false);
    expect(
      badReport.issues.some(
        (i) =>
          i.quantityId === "planckConstant" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("h/k =") &&
          i.message.includes("expected 4.866e-11"),
      ),
    ).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 10: line 1304 - recomputed-mismatch (Planck 1900/1901 8*pi*h/L^3)
  // --------------------------------------------------------------------------
  test("rejects Planck 1900/1901 Wien alpha 8*pi*h/L^3 mismatch (constants.ts:1304)", () => {
    const realSet = getConstantSet("planck-1900-1901-printed");

    // Accept: real set 8*pi*h/L^3 matches 6.097e-57 within 1e-2 relative tolerance
    const cleanReport = checkPrintedConsistency(realSet);
    expect(
      cleanReport.issues.some(
        (i) =>
          i.quantityId === "planckConstant" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("8*pi*h/L^3 ="),
      ),
    ).toBe(false);

    // Reject: altered speed of light changes 8*pi*h/L^3
    const badSet = modifyEntry(realSet, "speedOfLight", (e) => ({
      ...e,
      value: 2.5e8,
    }));
    const badReport = checkPrintedConsistency(badSet);
    expect(badReport.ok).toBe(false);
    expect(
      badReport.issues.some(
        (i) =>
          i.quantityId === "planckConstant" &&
          i.code === "recomputed-mismatch" &&
          i.message.includes("8*pi*h/L^3 =") &&
          i.message.includes("expected 6.097e-57"),
      ),
    ).toBe(true);
  });
});
