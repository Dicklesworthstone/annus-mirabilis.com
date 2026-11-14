import { expect, test } from "bun:test";
import { loadQuantityRegistry } from "../../content/quantities/registry.ts";
import { unitDimension } from "../../units/outputUnitDimension.ts";
import { identifyMolecularDimensions } from "./molecularDimensions.ts";

test("the identification owner's new displayed quantities bind exact registered identities and matching units", () => {
  const registry = loadQuantityRegistry();
  const result = identifyMolecularDimensions(
    {
      temperature: 293.15,
      viscosity: 0.001,
      diffusion: 5e-10,
      molarConcentration: 20,
      specificViscosity: 0.01,
      gasConstant: 8.31,
      viscosityCoefficient: 2.5,
    },
    true,
  );
  const product = result.viscosityProduct;
  const residual = result.candidates.find(
    (candidate) => candidate.satisfiesBoth,
  )?.viscosityResidual;
  expect(residual).toBeDefined();
  for (const [output, expectedDimension] of [
    [product, [3, 0, 0, 0, 0, -1]],
    [residual!, [0, 0, 0, 0, 0, 0]],
  ] as const) {
    expect(output.status).toBe("value");
    const quantity = registry.quantities.get(output.quantityId);
    expect(quantity).toBeDefined();
    expect(quantity?.mathematicalKind).toBe("scalar");
    expect(quantity?.dimension?.map((power) => Number(power.num) / Number(power.den))).toEqual(
      expectedDimension,
    );
    expect(quantity?.permittedUnits?.some((unit) => unit.unit === output.unit)).toBe(true);
    const parsed = unitDimension(output.unit);
    expect(parsed.kind).toBe("dimension");
    if (parsed.kind === "dimension") expect(parsed.exponents).toEqual(expectedDimension);
  }
  expect(registry.quantities.get(residual!.quantityId)?.dimensionlessKind).toBe("ratio");
});
