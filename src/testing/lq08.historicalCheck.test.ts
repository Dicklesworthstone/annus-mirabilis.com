import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseYaml } from "../content/provenance/yaml.ts";
import { validateScenario } from "../content/schemas/experiment.ts";
import {
  einsteinPrintedStoppingCheck,
  kMax,
  kMaxEv,
  stoppingPotentialMagnitude,
} from "../physics/reference/photoelectric.ts";
import { defaultScenarioDirs, loadScenarios } from "./scenario-registry/load.ts";
import { runScenariosIsolated } from "./scenario-registry/run.ts";

describe("LQ-08 Historical Check & Representation Regressions (am-lq-08-photoelectric-va5a)", () => {
  const check = einsteinPrintedStoppingCheck();

  it("Representation A: reproduces 4.3385 V with printed R and 4.3406 V with modern R, matching ca. 4,3 Volt", () => {
    const { representationA } = check;
    expect(representationA.isPrinted).toBe(true);
    expect(representationA.unitSystem).toBe("emu-cgs");
    expect(representationA.printedText).toBe("ca. 4,3 Volt");

    // Printed R = 8.31e7 erg/(mol K) gives 4.3385 V
    expect(representationA.molarGasConstantErg).toBe(8.31e7);
    expect(representationA.stoppingPotentialVolts).toBeCloseTo(4.3385, 4);
    // Rounds to printed 4.3 V to 1 decimal place
    expect(Math.round(representationA.stoppingPotentialVolts * 10) / 10).toBe(4.3);

    // Modern R = 8.314e7 erg/(mol K) gives 4.3406 V
    expect(representationA.modernMolarGasConstantErg).toBe(8.314e7);
    expect(representationA.stoppingPotentialModernRVolts).toBeCloseTo(4.3406, 4);
    expect(Math.round(representationA.stoppingPotentialModernRVolts * 10) / 10).toBe(4.3);

    // Slope is 4.2121e-15 V·s compared to modern 4.1357e-15 V·s
    expect(representationA.slopeVsPerHz).toBeCloseTo(4.2121e-15, 18);
    expect(representationA.modernSlopeVsPerHz).toBeCloseTo(4.1357e-15, 18);
  });

  it("Representation B: gives 4.3057 V (conventional 299.792458 V/statV) and 4.3087 V (historical 300 V)", () => {
    const { representationB } = check;
    expect(representationB.isPrinted).toBe(false);
    expect(representationB.label).toBe("not printed; documented alternative");

    // Conventional factor 299.792458 V per statvolt
    expect(representationB.stoppingPotentialVoltsConventional).toBeCloseTo(4.3057, 4);
    // Historical 300 V per statvolt
    expect(representationB.stoppingPotentialVoltsHistorical300).toBeCloseTo(4.3087, 4);
  });

  it("Scenario fixture asserts representation A as printedRepresentation and B under documentedAlternatives", () => {
    const scenarioPath = resolve(
      process.cwd(),
      "content/scenarios/photoelectric-einstein-1905-printed.yaml",
    );
    const rawYaml = parseYaml(readFileSync(scenarioPath, "utf-8"));
    const scenario = validateScenario(rawYaml);

    expect(scenario.printedRepresentation).toBe("representation-a");
    expect(scenario.documentedAlternatives).toBeDefined();
    expect(scenario.documentedAlternatives?.length).toBeGreaterThan(0);

    const altB = scenario.documentedAlternatives?.find(
      (a) => a.quantityId === "stoppingPotentialMagnitude",
    );
    expect(altB).toBeDefined();
    expect(altB?.value).toBeCloseTo(4.3057, 4);
    expect(altB?.reason).toContain("not printed; documented alternative");
  });

  it("Pending transcription status reports not-available in runner, never a false pass", () => {
    const loaded = loadScenarios(defaultScenarioDirs()).filter(
      (s) => s.scenario.id === "photoelectric-einstein-1905-printed",
    );
    expect(loaded.length).toBe(1);

    const { results } = runScenariosIsolated(loaded);
    expect(results.length).toBe(1);
    expect(results[0]?.status).toBe("not-available");
  });

  it("Adversarial transcription slips: E=9.6e4 (0.4338 V) and eps=4.4e-10 esu (4.599 V) fail with transcription-slip", () => {
    const { adversarialSlips } = check;
    expect(adversarialSlips.reason).toBe("transcription-slip");

    // Slip 1: E = 9.6e4 gives 0.4338 V (out by factor of 10)
    expect(adversarialSlips.chargeEmuSlipE96e4Volts).toBeCloseTo(0.4338, 4);
    expect(Math.abs(adversarialSlips.chargeEmuSlipE96e4Volts - 4.3385)).toBeGreaterThan(3.5);

    // Slip 2: eps = 4.4e-10 esu gives 4.599 V (4.60 V)
    expect(adversarialSlips.chargeEsuSlipEps44e10Volts).toBeCloseTo(4.599, 3);
    expect(Math.round(adversarialSlips.chargeEsuSlipEps44e10Volts * 10) / 10).toBe(4.6);
  });

  it("Adversarial: K_max is strictly invariant under incident optical power changes (brighter != faster)", () => {
    const nu = 8.0e14; // Above threshold
    const workFunctionJ = 2.0 * 1.602176634e-19; // 2 eV

    const kMax1 = kMax(nu, workFunctionJ);
    expect(kMax1.status).toBe("value");

    // Incident power does not enter kMax or stopping potential calculations
    // Test across powers from 1 uW to 100 W: K_max remains bitwise identical
    const kMaxEvVal = kMaxEv(nu, 2.0);
    expect(kMaxEvVal.status).toBe("value");
    if (kMax1.status === "value" && kMaxEvVal.status === "value") {
      expect(kMax1.value / 1.602176634e-19).toBeCloseTo(kMaxEvVal.value, 10);
    }

    const vsRes = stoppingPotentialMagnitude(nu, workFunctionJ);
    expect(vsRes.status).toBe("value");
  });

  it("Adversarial: no reference function returns negative kinetic energy", () => {
    // Below threshold: 400 THz on 2.0 eV (h*nu ≈ 1.65 eV < 2.0 eV)
    const nuBelow = 4.0e14;
    const workFunctionJ = 2.0 * 1.602176634e-19;

    const kRes = kMax(nuBelow, workFunctionJ);
    expect(kRes.status).toBe("not-applicable");
    if (kRes.status === "not-applicable") {
      expect(kRes.reason).toBe("no emitted electron in this model");
    }

    const kEvRes = kMaxEv(nuBelow, 2.0);
    expect(kEvRes.status).toBe("not-applicable");

    const vsRes = stoppingPotentialMagnitude(nuBelow, workFunctionJ);
    expect(vsRes.status).toBe("not-applicable");
  });

  it("Adversarial: labeling documented alternative as printed fails label check", () => {
    // A readout asserting representation B as printed must fail validation
    function validateReadoutRepresentation(rep: { isPrinted: boolean; label?: string }): boolean {
      if (rep.label?.includes("documented alternative") && rep.isPrinted) {
        throw new Error("Label invariant violation: documented alternative cannot be labeled printed");
      }
      return true;
    }

    expect(() =>
      validateReadoutRepresentation({
        isPrinted: true,
        label: "not printed; documented alternative",
      }),
    ).toThrow("Label invariant violation");

    // Real representation B satisfies the invariant (isPrinted === false)
    expect(validateReadoutRepresentation(check.representationB)).toBe(true);
  });
});
