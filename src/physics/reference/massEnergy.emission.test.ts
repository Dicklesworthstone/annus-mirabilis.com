import { describe, expect, test } from "bun:test";
import { encodeResult } from "../../experiments/results/codec.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { C_SI, evaluateFourMomentum, evaluateMe03, evaluateModernEmission } from "./massEnergy.ts";

const cSquared = C_SI * C_SI;
const directed = {
  boundary: "body-alone",
  pulseSystem: "single-pulse",
  initialEmitterMass: 1,
  emittedEnergy: (3 * cSquared) / 8,
} as const;

function value(result: ScientificResult): number {
  expect(result.status).toBe("value");
  if (result.status !== "value" || typeof result.value !== "number")
    throw new Error("Expected a scalar owner result.");
  return result.value;
}

function close(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    3e-14 * Math.max(Math.abs(expected), Number.MIN_VALUE),
  );
}

describe("modern isolated emission conserves energy and momentum with recoil", () => {
  test("a 3/8 rest-energy pulse leaves mass 1/2 and velocity −3c/5", () => {
    const result = evaluateModernEmission(directed);
    expect(result.status).toBe("value");
    const o = result.outputs;
    close(value(o.remainingEmitterMass), 0.5);
    close(value(o.emitterMassChange), -0.5);
    close(value(o.emitterRecoilVelocity), (-3 * C_SI) / 5);
    close(value(o.emitterKineticEnergy), cSquared / 8);
    close(value(o.remainingEmitterEnergy), (5 * cSquared) / 8);
    close(value(o.remainingEmitterEnergy) + directed.emittedEnergy, value(o.initialEmitterEnergy));
    expect(value(o.emitterMomentum) + value(o.radiationMomentum)).toBe(0);
    close(
      -value(o.emitterMassChange) * cSquared,
      directed.emittedEnergy + value(o.emitterKineticEnergy),
    );
    expect(value(result.ledger.massChange)).toBe(value(o.emitterMassChange));
    expect(value(result.ledger.systemMassChange)).toBe(0);
  });

  test("equal opposite pulses recover the recoil-free result for the same emission energy", () => {
    const result = evaluateModernEmission({ ...directed, pulseSystem: "two-opposite" });
    close(value(result.outputs.remainingEmitterMass), 5 / 8);
    close(value(result.outputs.emitterMassChange), -3 / 8);
    expect(value(result.outputs.emitterRecoilVelocity)).toBe(0);
    expect(value(result.outputs.emitterKineticEnergy)).toBe(0);
    expect(value(result.outputs.radiationMomentum)).toBe(0);
    close(value(result.ledger.radiationMassChange), 3 / 8);
  });

  test("two same-direction pulses have the same total four-momentum as one", () => {
    expect(evaluateModernEmission({ ...directed, pulseSystem: "two-collinear" })).toEqual(
      evaluateModernEmission(directed),
    );
  });

  test("moving the boundary uses actual subsystem invariant masses", () => {
    const body = evaluateModernEmission(directed);
    const radiation = evaluateModernEmission({ ...directed, boundary: "radiation" });
    const whole = evaluateModernEmission({ ...directed, boundary: "combined-isolated-system" });
    expect(value(body.ledger.energyChange)).toBe(-directed.emittedEnergy);
    expect(value(radiation.ledger.energyChange)).toBe(directed.emittedEnergy);
    expect(value(radiation.ledger.massChange)).toBe(0);
    expect(value(whole.ledger.energyChange)).toBe(0);
    expect(value(whole.ledger.massChange)).toBe(0);
    expect(whole.outputs).toEqual(body.outputs);
    const opposite = evaluateModernEmission({
      ...directed,
      boundary: "radiation",
      pulseSystem: "two-opposite",
    });
    close(value(opposite.ledger.massChange), 3 / 8);
  });

  test("a one-joule pulse retains tiny nonzero mass loss and recoil energy", () => {
    const result = evaluateModernEmission({ ...directed, emittedEnergy: 1 });
    expect(value(result.outputs.remainingEmitterMass)).toBe(1);
    close(value(result.outputs.emitterMassChange), -1 / cSquared);
    close(value(result.outputs.emitterKineticEnergy), 1 / (2 * cSquared));
    close(value(result.outputs.emitterRecoilVelocity), -1 / C_SI);
    expect(value(result.outputs.emitterMassChange)).toBeLessThan(0);
    expect(value(result.outputs.emitterKineticEnergy)).toBeGreaterThan(0);
  });

  test("zero emission preserves the body without a 0/0 result", () => {
    const result = evaluateModernEmission({ ...directed, emittedEnergy: 0 });
    expect(result.status).toBe("value");
    expect(value(result.outputs.remainingEmitterMass)).toBe(1);
    expect(value(result.outputs.emitterMassChange)).toBe(0);
    expect(value(result.outputs.emitterRecoilVelocity)).toBe(0);
    expect(value(result.outputs.emitterKineticEnergy)).toBe(0);
  });

  test("the directed endpoint is a lightlike remnant, not a massive observer", () => {
    const result = evaluateModernEmission({ ...directed, emittedEnergy: cSquared / 2 });
    expect(result.status).toBe("value");
    expect(value(result.outputs.remainingEmitterMass)).toBe(0);
    expect(value(result.outputs.emitterRecoilVelocity)).toBe(-C_SI);
    expect(value(result.outputs.emitterKineticEnergy)).toBe(cSquared / 2);
    expect(result.reason).toContain("lightlike");
  });

  test("complete symmetric conversion has no remaining emitter velocity", () => {
    const result = evaluateModernEmission({
      ...directed,
      emittedEnergy: cSquared,
      pulseSystem: "two-opposite",
    });
    expect(result.status).toBe("value");
    expect(value(result.outputs.remainingEmitterMass)).toBe(0);
    expect(value(result.outputs.remainingEmitterEnergy)).toBe(0);
    expect(result.outputs.emitterRecoilVelocity.status).toBe("not-applicable");
    expect(result.reason).toContain("no emitter remains");
  });

  test("an impossible emitter budget refuses the body without inventing a radiation mass", () => {
    const result = evaluateModernEmission({ ...directed, emittedEnergy: cSquared * 0.6 });
    expect(result.status).toBe("outside-domain");
    expect(result.ledger.massChange.status).toBe("outside-domain");
    expect(result.ledger.systemMassChange.status).toBe("outside-domain");
    expect(result.outputs.emitterRecoilVelocity.status).toBe("outside-domain");
    expect(value(result.ledger.radiationMassChange)).toBe(0);
    expect(result.reason).toContain("spacelike");
    expect(
      evaluateModernEmission({
        ...directed,
        emittedEnergy: 2 * cSquared,
        pulseSystem: "two-opposite",
      }).status,
    ).toBe("outside-domain");
  });

  test("invalid physical inputs and unrepresentable scales cannot become numeric zeroes", () => {
    for (const initialEmitterMass of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(evaluateModernEmission({ ...directed, initialEmitterMass }).status).toBe(
        "outside-domain",
      );
    }
    for (const emittedEnergy of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const refused = evaluateModernEmission({ ...directed, emittedEnergy });
      expect(refused.status).toBe("outside-domain");
      const radiation = evaluateFourMomentum("two-opposite", emittedEnergy);
      expect(radiation.status).toBe("outside-domain");
      for (const output of [
        radiation,
        ...Object.values(refused.ledger),
        ...Object.values(refused.outputs),
      ]) {
        expect(() => encodeResult(output)).not.toThrow();
      }
    }
    for (const input of [
      { ...directed, initialEmitterMass: 1e300 },
      { ...directed, emittedEnergy: 1e-300 },
    ]) {
      const result = evaluateModernEmission(input);
      expect(result.status).toBe("outside-domain");
      const loss = result.outputs.emitterMassChange;
      expect(loss.status === "outside-domain" && loss.domainKind).toBe("numerical");
    }
  });

  test("historical ledgers do not acquire a modern absolute-energy premise", () => {
    const a = evaluateMe03({ mode: "1905", initialEmitterMass: 1, emittedEnergy: 1 });
    const b = evaluateMe03({
      mode: "1905",
      initialEmitterMass: 1e15,
      emittedEnergy: 1,
      pulseSystem: "single-pulse",
    });
    expect(a.modernEmission).toBeNull();
    expect(b.modernEmission).toBeNull();
    expect(a.massChange).toEqual(b.massChange);
    expect(a.energyChange).toEqual(b.energyChange);
  });
});
