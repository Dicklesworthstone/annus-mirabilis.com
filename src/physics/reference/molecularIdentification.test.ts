import { describe, expect, test } from "bun:test";
import { decodeResult } from "../../experiments/results/codec.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import {
  identifyMolecularDimensions,
  MOLECULAR_IDENTIFICATION_TOLERANCE,
  type MolecularDimensionsInputs,
} from "./molecularDimensions.ts";

const input: MolecularDimensionsInputs = Object.freeze({
  temperature: 293.15,
  viscosity: 0.001,
  diffusion: 5e-10,
  molarConcentration: 20,
  specificViscosity: 0.01,
  gasConstant: 8.31,
  viscosityCoefficient: 2.5,
});
function value(result: ScientificResult): number {
  if (result.status !== "value" || typeof result.value !== "number")
    throw new Error(`Expected a scalar, received ${result.status}.`);
  return result.value;
}
function close(actual: number, expected: number, tolerance = 3e-13) {
  expect(Math.abs(actual / expected - 1)).toBeLessThan(tolerance);
}

describe("molecular identification by independently admitted observations", () => {
  test("diffusion alone fixes a product and a family without reading any withheld observation", () => {
    const withheld = { ...input };
    for (const name of ["molarConcentration", "specificViscosity", "viscosityCoefficient"])
      Object.defineProperty(withheld, name, {
        get() {
          throw new Error(`Read withheld ${name}`);
        },
      });
    const result = identifyMolecularDimensions(withheld, false);
    expect(result.radius.status).toBe("underdetermined");
    expect(result.molecularNumber.status).toBe("underdetermined");
    expect(result.viscosityProduct.status).toBe("not-applicable");
    const product =
      (input.gasConstant * input.temperature) / (6 * Math.PI * input.viscosity * input.diffusion);
    close(value(result.diffusionProduct), product);
    expect(result.candidates.length).toBeGreaterThan(2);
    for (const candidate of result.candidates) {
      close(candidate.radius * value(candidate.diffusionNumber), product);
      expect(candidate.viscosityNumber.status).toBe("not-applicable");
      expect(candidate.viscosityResidual.status).toBe("not-applicable");
      expect(candidate.satisfiesBoth).toBe(false);
      expect(candidate.intersection).toBe(false);
    }
  });

  test("the two families have independently checked slopes and meet only at the real inverse", () => {
    const before = identifyMolecularDimensions(input, false);
    const after = identifyMolecularDimensions(input, true);
    const a = value(after.radius);
    const N = value(after.molecularNumber);
    close(
      (input.gasConstant * input.temperature) / (6 * Math.PI * input.viscosity * a * N),
      input.diffusion,
    );
    close(
      input.viscosityCoefficient * ((4 * Math.PI) / 3) * input.molarConcentration * N * a ** 3,
      input.specificViscosity,
    );
    const matches = after.candidates.filter((row) => row.satisfiesBoth);
    expect(matches).toHaveLength(1);
    close(matches[0]!.radius, a);
    expect(matches[0]!.intersection).toBe(true);
    for (const row of before.candidates) {
      const admitted = after.candidates.find((candidate) => candidate.radius === row.radius);
      if (admitted) close(value(admitted.diffusionNumber), value(row.diffusionNumber));
    }
    const smaller = after.candidates.find((row) => row.radius === 2.5e-10)!;
    const larger = after.candidates.find((row) => row.radius === 5e-10)!;
    close(value(smaller.diffusionNumber) / value(larger.diffusionNumber), 2);
    close(value(smaller.viscosityNumber) / value(larger.viscosityNumber), 8);
    for (const row of after.candidates) {
      const predicted =
        input.viscosityCoefficient *
        ((4 * Math.PI) / 3) *
        input.molarConcentration *
        value(row.diffusionNumber) *
        row.radius ** 3;
      if (predicted / input.viscosityCoefficient > 0.05) {
        expect(row.viscosityResidual.status).toBe("outside-domain");
        expect(row.satisfiesBoth).toBe(false);
        continue;
      }
      const expectedResidual = (predicted - input.specificViscosity) / input.specificViscosity;
      expect(Math.abs(value(row.viscosityResidual) - expectedResidual)).toBeLessThan(
        2e-12 * Math.max(1, Math.abs(expectedResidual)),
      );
      expect(row.satisfiesBoth).toBe(
        Math.abs(expectedResidual) <= MOLECULAR_IDENTIFICATION_TOLERANCE,
      );
    }
  });

  test("a candidate's own dilute domain is checked even when the observed solution is admitted", () => {
    const result = identifyMolecularDimensions(input, true);
    expect(result.molecularNumber.status).toBe("value");
    const large = result.candidates.find((row) => row.radius === 2e-9)!;
    const phi =
      ((4 * Math.PI) / 3) *
      input.molarConcentration *
      value(large.diffusionNumber) *
      large.radius ** 3;
    expect(phi).toBeGreaterThan(0.05);
    expect(large.diffusionNumber.status).toBe("value");
    expect(large.viscosityNumber.status).toBe("value");
    expect(large.viscosityResidual.status).toBe("outside-domain");
    if (large.viscosityResidual.status === "outside-domain")
      expect(large.viscosityResidual.condition).toBe("candidate-not-dilute");
    const boundary = identifyMolecularDimensions({ ...input, specificViscosity: 0.125 }, true);
    expect(boundary.candidates.find((row) => row.intersection)?.satisfiesBoth).toBe(true);
  });

  test("withholding again restores exactly the original family without changing recorded inputs", () => {
    const p = structuredClone(input);
    const before = identifyMolecularDimensions(p, false);
    identifyMolecularDimensions(p, true);
    expect(p).toEqual(input);
    expect(identifyMolecularDimensions(p, false)).toEqual(before);
  });

  test("independently generated pairs recover without supplying a target molecular number", () => {
    for (const radius of [1e-10, 5e-10, 1e-9]) {
      for (const number of [2e23, 6e23, 1e24]) {
        const p = {
          ...input,
          molarConcentration: 0.1,
          diffusion:
            (input.gasConstant * input.temperature) /
            (6 * Math.PI * input.viscosity * radius * number),
          specificViscosity: 2.5 * ((4 * Math.PI) / 3) * 0.1 * number * radius ** 3,
        };
        const result = identifyMolecularDimensions(p, true);
        close(value(result.radius), radius);
        close(value(result.molecularNumber), number);
        expect(result.candidates.filter((row) => row.satisfiesBoth)).toHaveLength(1);
      }
    }
  });

  test("coefficient changes preserve the diffusion family and change the joint inference by the square root", () => {
    const original = identifyMolecularDimensions({ ...input, viscosityCoefficient: 1 }, true);
    const corrected = identifyMolecularDimensions(input, true);
    close(value(corrected.radius) / value(original.radius), 1 / Math.sqrt(2.5));
    close(value(corrected.molecularNumber) / value(original.molecularNumber), Math.sqrt(2.5));
    expect(identifyMolecularDimensions({ ...input, viscosityCoefficient: 1 }, false)).toEqual(
      identifyMolecularDimensions(input, false),
    );
  });

  test("withheld observations cannot secretly recenter candidates around an inferred answer", () => {
    for (const patch of [
      { specificViscosity: 1e-8 },
      { specificViscosity: 0 },
      { molarConcentration: 1000 },
      { viscosityCoefficient: 1 as const },
    ]) {
      const result = identifyMolecularDimensions({ ...input, ...patch }, false);
      expect(result).toEqual(identifyMolecularDimensions(input, false));
    }
  });

  test("an admitted zero pair remains underdetermined, while inconsistent or concentrated data draw no intersection", () => {
    const unknown = identifyMolecularDimensions(
      { ...input, specificViscosity: 0, molarConcentration: 0 },
      true,
    );
    expect(unknown.molecularNumber.status).toBe("underdetermined");
    expect(unknown.candidates.every((row) => !row.satisfiesBoth && !row.intersection)).toBe(true);
    for (const patch of [
      { specificViscosity: 0 },
      { specificViscosity: -0.001 },
      { molarConcentration: 0 },
      { specificViscosity: 0.2 },
    ]) {
      const result = identifyMolecularDimensions({ ...input, ...patch }, true);
      expect(result.molecularNumber.status).toBe("outside-domain");
      expect(result.viscosityProduct.status).toBe("outside-domain");
      expect(result.candidates.every((row) => !row.satisfiesBoth && !row.intersection)).toBe(true);
      expect(result.candidates.every((row) => row.diffusionNumber.status === "value")).toBe(true);
    }
  });

  test("invalid diffusion and unrepresentable products stay typed and never publish fake zeros", () => {
    for (const diffusion of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MIN_VALUE]) {
      const result = identifyMolecularDimensions({ ...input, diffusion }, false);
      expect(result.diffusionProduct.status).toBe("outside-domain");
      expect(result.radius.status).toBe("outside-domain");
      expect(result.molecularNumber.status).toBe("outside-domain");
      expect(result.candidates).toHaveLength(0);
    }
  });

  test("each visible scalar has the correct identity, a valid typed payload, and no invented uncertainty", () => {
    for (const admitted of [false, true]) {
      const result = identifyMolecularDimensions(input, admitted);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.candidates)).toBe(true);
      expect(result.diffusionProduct.quantityId).toBe("radiusTimesMolecularNumber");
      expect(result.viscosityProduct.quantityId).toBe("radiusCubedTimesMolecularNumber");
      const results = [
        result.radius,
        result.molecularNumber,
        result.diffusionProduct,
        result.viscosityProduct,
      ];
      for (const row of result.candidates) {
        expect(row.viscosityResidual.quantityId).toBe("relativeSpecificViscosityResidual");
        expect(row.viscosityResidual.unit).toBe("1");
        results.push(row.diffusionNumber, row.viscosityNumber, row.viscosityResidual);
      }
      for (const output of results) {
        expect(() => decodeResult(output)).not.toThrow();
        expect(output.ownerId).toBe("molecular-dimensions");
        expect(output).not.toHaveProperty("uncertainty");
        expect(Object.isFrozen(output)).toBe(true);
      }
    }
  });
});
