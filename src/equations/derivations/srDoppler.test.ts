import { describe, expect, test } from "bun:test";
import {
  aberration,
  dopplerFactor,
  phaseAtEvent,
  transformWaveVector,
} from "../../physics/reference/waves.ts";
import type { Expression } from "../ast.ts";
import { evaluateExpression } from "./spotCheck.ts";
import {
  srDopplerAberration,
  srDopplerAberrationChain,
  srDopplerChains,
  srDopplerCoefficientEquations,
  srDopplerCollectedPhase,
  srDopplerCoordinatePremises,
  srDopplerCoordinates,
  srDopplerDirectionSine,
  srDopplerFactor,
  srDopplerFrequencyChain,
  srDopplerPhase,
  srDopplerPhaseChain,
  srDopplerRatio,
} from "./srDoppler.ts";
import {
  checkSRDopplerCanonicalPremises,
  checkSRPhaseCoefficients,
  verifySRDoppler,
} from "./srDopplerProof.ts";
import { substituteNode } from "./treeUtils.ts";
import type { DerivationChain } from "./types.ts";
import { verifyChain } from "./verifyChain.ts";

const one: Expression = { kind: "number", value: "1" };
const two: Expression = { kind: "number", value: "2" };
const plus = (...args: Expression[]): Expression => ({ kind: "sum", args });
const times = (...args: Expression[]): Expression => ({ kind: "product", args });
const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const overC = (numerator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator: { kind: "symbol", termId: "c", quantityId: "speedOfLight" },
});
const coefficients = [
  srDopplerCoefficientEquations.frequency.right,
  negative(overC(srDopplerCoefficientEquations.longitudinal.right)),
  negative(overC(srDopplerCoefficientEquations.sideways.right)),
];

describe("SR §7 phase, Doppler and aberration proof", () => {
  test("every stage has executable exact checks and preserves its physical premises", () => {
    expect(srDopplerChains.length).toBeGreaterThan(0);
    for (const chain of srDopplerChains) {
      const report = verifySRDoppler(chain);
      expect(report.errors).toEqual([]);
      expect(report.passed).toBe(true);
      expect(report.isPublicationReady).toBe(true);
      expect(report.stepReports.length).toBe(chain.steps.length);
      expect(report.stepReports.every((step) => step.verificationStatus === "verified")).toBe(true);
      expect(
        chain.entryAssumptions.some((premise) => premise.ref.includes("positive-frequency")),
      ).toBe(true);
    }
    console.log(
      `[sr-doppler] ${srDopplerChains.length} routes; ${srDopplerChains.flatMap((chain) => chain.steps).length} checked transformations`,
    );
  });

  test("canonical definitions cannot silently reverse the frequency ratio or the inverse maps", () => {
    expect(checkSRDopplerCanonicalPremises()).toBe(true);
    const ratio = srDopplerRatio.right;
    expect(ratio.kind).toBe("quotient");
    if (ratio.kind !== "quotient") return;
    expect(
      checkSRDopplerCanonicalPremises({
        ...srDopplerRatio,
        right: { ...ratio, numerator: ratio.denominator, denominator: ratio.numerator },
      }),
    ).toBe(false);
    expect(checkSRDopplerCanonicalPremises({ ...srDopplerRatio, operator: "=" })).toBe(false);
    expect(
      checkSRDopplerCanonicalPremises(srDopplerRatio, {
        ...srDopplerCoordinatePremises,
        time: {
          ...srDopplerCoordinatePremises.time,
          left: srDopplerCoordinatePremises.position.left,
        },
      }),
    ).toBe(false);
    expect(
      checkSRDopplerCanonicalPremises(srDopplerRatio, {
        ...srDopplerCoordinatePremises,
        position: { ...srDopplerCoordinatePremises.position, operator: "approx" },
      }),
    ).toBe(false);
  });

  test("coefficient matching rejects changes that coordinate-basis samples cannot detect", () => {
    expect(checkSRPhaseCoefficients(srDopplerCollectedPhase, coefficients)).toBe(true);
    const [time, position] = srDopplerCoordinates;
    // Both added terms vanish at zero and at every unit basis vector. Full reconstruction
    // is what rejects them; checking only extracted coefficients would be a vacuous proof.
    const traps = [times(time, position), times(time, plus(time, negative(one)))];
    for (const trap of traps)
      expect(checkSRPhaseCoefficients(plus(srDopplerCollectedPhase, trap), coefficients)).toBe(
        false,
      );
    expect(checkSRPhaseCoefficients(plus(srDopplerCollectedPhase, one), coefficients)).toBe(false);
    expect(checkSRPhaseCoefficients(srDopplerCollectedPhase, [two, ...coefficients.slice(1)])).toBe(
      false,
    );
    expect(checkSRPhaseCoefficients(srDopplerCollectedPhase, coefficients.slice(0, 2))).toBe(false);
  });

  test("a locally valid substitution cannot forge its frequency producer", () => {
    const first = srDopplerAberrationChain.steps[0]!;
    const forged = times(two, first.rule.params.replacement as Expression);
    const forgedStep = {
      ...first,
      rule: { ...first.rule, params: { ...first.rule.params, replacement: forged } },
      to: substituteNode(first.from, "ν'", forged),
    };
    // The generic substitution checker verifies applying the supplied replacement. It does
    // not establish that the replacement follows from the earlier phase coefficient.
    const local = { ...srDopplerAberrationChain, steps: [forgedStep], targetStepId: forgedStep.id };
    expect(verifyChain(local).stepReports[0]?.ruleOutcome).toBe("pass");
    const changed = {
      ...srDopplerAberrationChain,
      steps: [forgedStep, srDopplerAberrationChain.steps[1]!],
    };
    expect(verifySRDoppler(changed).passed).toBe(false);
  });

  test("the phase producer and nonzero assumptions cannot disappear behind correct final algebra", () => {
    for (const chain of srDopplerChains) {
      const withoutDomain = {
        ...chain,
        entryAssumptions: chain.entryAssumptions.filter(
          (premise) => !premise.ref.includes("positive-frequency"),
        ),
      };
      expect(verifySRDoppler(withoutDomain).passed).toBe(false);
      const discontinuous: DerivationChain = {
        ...chain,
        steps: chain.steps.map((step, index) =>
          index === 1 ? { ...step, from: plus(step.from, one) } : step,
        ),
      };
      expect(verifySRDoppler(discontinuous).passed).toBe(false);
    }
    const brokenPhase: DerivationChain = {
      ...srDopplerPhaseChain,
      steps: srDopplerPhaseChain.steps.map((step, index) =>
        index === 3 ? { ...step, to: times(two, step.to) } : step,
      ),
    };
    const family = srDopplerChains.map((chain) =>
      chain.id === brokenPhase.id ? brokenPhase : chain,
    );
    expect(verifySRDoppler(srDopplerFrequencyChain, family).passed).toBe(false);
    expect(verifySRDoppler(srDopplerFrequencyChain, srDopplerChains.slice(1)).passed).toBe(false);
    expect(
      verifySRDoppler(srDopplerFrequencyChain, [
        srDopplerFrequencyChain,
        ...srDopplerChains.slice(1),
      ]).passed,
    ).toBe(false);
  });

  test("the conclusions agree with the wave owner for signed boosts and both transverse questions", () => {
    for (const beta of [-0.9, -0.6, 0, 0.6, 0.9]) {
      for (const angle of [0, Math.PI / 2, Math.PI, Math.acos(beta)]) {
        const bindings = { v: beta, c: 1, γ: 1 / Math.sqrt(1 - beta * beta), φ: angle };
        const q = evaluateExpression(srDopplerFactor.right, bindings);
        const cosine = evaluateExpression(srDopplerAberration.right, bindings);
        const sine = evaluateExpression(srDopplerDirectionSine.right, bindings);
        const direction = aberration(beta, angle);
        expect(q).toBeCloseTo(dopplerFactor(beta, angle), 12);
        expect(cosine).toBeCloseTo(direction.cosThetaPrime, 12);
        expect(sine).toBeCloseTo(direction.sinThetaPrime, 12);
        expect(cosine * cosine + sine * sine).toBeCloseTo(1, 12);
        // Reversing the frame change uses the transformed angle, never the old one.
        expect(q * dopplerFactor(-beta, direction.thetaPrimeRad)).toBeCloseTo(1, 12);
        expect(aberration(-beta, direction.thetaPrimeRad).cosThetaPrime).toBeCloseTo(
          Math.cos(angle),
          12,
        );
      }
    }
    expect(dopplerFactor(0.6, Math.PI / 2)).toBeCloseTo(1.25, 12);
    expect(dopplerFactor(0.6, Math.acos(0.6))).toBeCloseTo(0.8, 12);
    expect(aberration(0.6, Math.PI / 2).cosThetaPrime).toBeCloseTo(-0.6, 12);
    expect(aberration(0.6, Math.acos(0.6)).cosThetaPrime).toBeCloseTo(0, 12);
  });

  test("the collected phase agrees with independent event evaluation away from any selected ray", () => {
    const beta = -0.6;
    const frequency = 3;
    const phi = 0.83;
    const gamma = 1 / Math.sqrt(1 - beta * beta);
    const wave = {
      omega: 2 * Math.PI * frequency,
      kx: 2 * Math.PI * frequency * Math.cos(phi),
      ky: 2 * Math.PI * frequency * Math.sin(phi),
      kz: 0,
    };
    const boosted = transformWaveVector(wave.omega, { x: wave.kx, y: wave.ky, z: 0 }, beta, 1);
    for (const point of [
      { t: 0.4, x: 2, y: -0.7, z: 3 },
      { t: -2, x: -1, y: 4, z: 0 },
    ]) {
      const stationary = {
        t: gamma * (point.t + beta * point.x),
        x: gamma * (point.x + beta * point.t),
        y: point.y,
        z: point.z,
      };
      const bindings = {
        v: beta,
        c: 1,
        γ: gamma,
        φ: phi,
        ν: frequency,
        t: stationary.t,
        x: stationary.x,
        y: stationary.y,
        "t'": point.t,
        "x'": point.x,
        "y'": point.y,
      };
      const original = evaluateExpression(srDopplerPhase, bindings);
      const collected = evaluateExpression(srDopplerCollectedPhase, bindings);
      expect(collected).toBeCloseTo(original, 12);
      const worldPhase = phaseAtEvent(stationary, wave);
      const movingPhase = phaseAtEvent(point, {
        omega: boosted.omegaPrime,
        kx: boosted.kPrime.x,
        ky: boosted.kPrime.y,
        kz: boosted.kPrime.z,
      });
      expect(worldPhase.status).toBe("value");
      expect(movingPhase.status).toBe("value");
      if (worldPhase.status !== "value" || movingPhase.status !== "value") continue;
      // The owner uses k·x − ωt; the displayed phase in cycles uses the opposite sign.
      expect(collected).toBeCloseTo(-worldPhase.value / (2 * Math.PI), 11);
      expect(collected).toBeCloseTo(-movingPhase.value / (2 * Math.PI), 11);
    }
  });
});
