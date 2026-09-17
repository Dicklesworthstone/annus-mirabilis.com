import { describe, expect, test } from "bun:test";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkKernelBindings,
  type ExtractedFunction,
  extractFromRepoFile,
  type IdentifierBinding,
  type KernelFunctionRef,
  sourceHasIdentifier,
} from "../../scripts/extract-kernel-source.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function extractedMap(entries: ExtractedFunction[]): Map<string, ExtractedFunction> {
  return new Map(entries.map((entry) => [entry.exportName, entry]));
}

describe("sourceHasIdentifier: word-boundary matched, never a bare substring test", () => {
  test("matches a standalone identifier", () => {
    expect(sourceHasIdentifier("const D = eta * a;", "D")).toBe(true);
  });

  test("does not match a substring inside a longer identifier", () => {
    expect(sourceHasIdentifier("const radius = 1;", "a")).toBe(false);
    expect(sourceHasIdentifier("const DValue = 1;", "D")).toBe(false);
  });

  test("does not match across a dot or bracket boundary incorrectly for a different name", () => {
    expect(sourceHasIdentifier("obj.eta", "eta")).toBe(true);
    expect(sourceHasIdentifier("obj.etaValue", "eta")).toBe(false);
  });
});

describe("checkKernelBindings: the load-bearing rule, real BM-01 source", () => {
  const stokesEinsteinD = extractFromRepoFile(
    REPO_ROOT,
    "src/physics/reference/diffusion/distributions.ts",
    "stokesEinsteinD",
  );
  const rmsDisplacement = extractFromRepoFile(
    REPO_ROOT,
    "src/physics/reference/diffusion/distributions.ts",
    "rmsDisplacement",
  );
  const apparentSpeed = extractFromRepoFile(
    REPO_ROOT,
    "src/physics/reference/diffusion/distributions.ts",
    "apparentSpeed",
  );
  const ensembleMoments = extractFromRepoFile(
    REPO_ROOT,
    "src/physics/reference/diffusion/tracers.ts",
    "ensembleMoments",
  );

  const kernelFunctions: KernelFunctionRef[] = [
    { language: "ts", module: stokesEinsteinD.module, exportName: "stokesEinsteinD" },
    { language: "ts", module: rmsDisplacement.module, exportName: "rmsDisplacement" },
    { language: "ts", module: apparentSpeed.module, exportName: "apparentSpeed" },
    { language: "ts", module: ensembleMoments.module, exportName: "ensembleMoments" },
  ];

  // Real identifiers verified present in the real extracted source above,
  // not the bead's illustrative shorthand (its prose example, "dt", does
  // not literally occur in this repository's current rmsDisplacement/
  // apparentSpeed signatures, which use `t` and `tau`).
  const bm01Bindings: IdentifierBinding[] = [
    { kernelFunction: "stokesEinsteinD", identifier: "eta", quantityId: "viscosity" },
    { kernelFunction: "stokesEinsteinD", identifier: "a", quantityId: "particleRadius" },
    { kernelFunction: "stokesEinsteinD", identifier: "T", quantityId: "temperature" },
    { kernelFunction: "rmsDisplacement", identifier: "D", quantityId: "diffusionCoefficient" },
    { kernelFunction: "apparentSpeed", identifier: "tau", quantityId: "observationInterval" },
    { kernelFunction: "ensembleMoments", identifier: "rms", quantityId: "rmsDisplacement1d" },
  ];

  const bm01Map = extractedMap([stokesEinsteinD, rmsDisplacement, apparentSpeed, ensembleMoments]);

  test("BM-01's real bindings against real extracted source pass with zero violations", () => {
    const violations = checkKernelBindings({
      instrumentId: "bm-01",
      liveTermQuantityIds: [
        "diffusionCoefficient",
        "viscosity",
        "particleRadius",
        "temperature",
        "observationInterval",
        "rmsDisplacement1d",
      ],
      kernelFunctions,
      identifierBindings: bm01Bindings,
      extractedByExportName: bm01Map,
    });
    expect(violations).toEqual([]);
  });

  test("a planted missing identifier fails, naming the instrument and quantity id", () => {
    const planted: IdentifierBinding[] = [
      ...bm01Bindings,
      {
        kernelFunction: "stokesEinsteinD",
        identifier: "nonexistentVariableName",
        quantityId: "impossibleQuantity",
      },
    ];
    const violations = checkKernelBindings({
      instrumentId: "bm-01",
      liveTermQuantityIds: ["impossibleQuantity"],
      kernelFunctions,
      identifierBindings: planted,
      extractedByExportName: bm01Map,
    });
    expect(violations).toContainEqual({
      instrumentId: "bm-01",
      quantityId: "impossibleQuantity",
      message:
        'identifier "nonexistentVariableName" for "impossibleQuantity" was not found in the extracted source of "stokesEinsteinD"',
    });
  });

  test("a binding naming no declared kernel function fails", () => {
    const planted: IdentifierBinding[] = [
      { kernelFunction: "notDeclaredAnywhere", identifier: "x", quantityId: "someQuantity" },
    ];
    const violations = checkKernelBindings({
      instrumentId: "bm-01",
      liveTermQuantityIds: [],
      kernelFunctions,
      identifierBindings: planted,
      extractedByExportName: bm01Map,
    });
    expect(violations).toContainEqual({
      instrumentId: "bm-01",
      quantityId: "someQuantity",
      message: 'binding for "someQuantity" names undeclared kernel function "notDeclaredAnywhere"',
    });
  });

  test("a live term with no binding at all fails, naming the instrument and quantity id", () => {
    const violations = checkKernelBindings({
      instrumentId: "bm-01",
      liveTermQuantityIds: ["diffusionCoefficient", "unboundLiveTerm"],
      kernelFunctions,
      identifierBindings: bm01Bindings,
      extractedByExportName: bm01Map,
    });
    expect(violations).toContainEqual({
      instrumentId: "bm-01",
      quantityId: "unboundLiveTerm",
      message: 'live term "unboundLiveTerm" has no identifier binding in any kernel function',
    });
    expect(violations.some((v) => v.quantityId === "diffusionCoefficient")).toBe(false);
  });
});

describe("checkKernelBindings: BM-05's real kernel functions", () => {
  const kernelDiffusivity = extractFromRepoFile(
    REPO_ROOT,
    "src/physics/reference/diffusion/walkLaws.ts",
    "kernelDiffusivity",
  );
  const randomWalkMoments = extractFromRepoFile(
    REPO_ROOT,
    "src/physics/reference/diffusion/walkLaws.ts",
    "randomWalkMoments",
  );
  const coinWalkDistribution = extractFromRepoFile(
    REPO_ROOT,
    "src/physics/reference/diffusion/walkLaws.ts",
    "coinWalkDistribution",
  );

  const kernelFunctions: KernelFunctionRef[] = [
    { language: "ts", module: kernelDiffusivity.module, exportName: "kernelDiffusivity" },
    { language: "ts", module: randomWalkMoments.module, exportName: "randomWalkMoments" },
    { language: "ts", module: coinWalkDistribution.module, exportName: "coinWalkDistribution" },
  ];

  const bindings: IdentifierBinding[] = [
    { kernelFunction: "kernelDiffusivity", identifier: "tau", quantityId: "observationInterval" },
    {
      kernelFunction: "randomWalkMoments",
      identifier: "stepRms",
      quantityId: "stepDisplacementRms",
    },
    { kernelFunction: "randomWalkMoments", identifier: "n", quantityId: "stepCount" },
    { kernelFunction: "coinWalkDistribution", identifier: "ell", quantityId: "stepLength" },
  ];

  const map = extractedMap([kernelDiffusivity, randomWalkMoments, coinWalkDistribution]);

  test("BM-05's real bindings against real extracted source pass with zero violations", () => {
    const violations = checkKernelBindings({
      instrumentId: "bm-05",
      liveTermQuantityIds: [
        "observationInterval",
        "stepDisplacementRms",
        "stepCount",
        "stepLength",
      ],
      kernelFunctions,
      identifierBindings: bindings,
      extractedByExportName: map,
    });
    expect(violations).toEqual([]);
  });
});

describe("checkKernelBindings: BM-06's real kernel functions", () => {
  const gaussianPropagator = extractFromRepoFile(
    REPO_ROOT,
    "src/physics/reference/diffusion/distributions.ts",
    "gaussianPropagator",
  );
  const intervalProbability = extractFromRepoFile(
    REPO_ROOT,
    "src/physics/reference/diffusion/distributions.ts",
    "intervalProbability",
  );
  const radialPropagator2d = extractFromRepoFile(
    REPO_ROOT,
    "src/physics/reference/diffusion/distributions.ts",
    "radialPropagator2d",
  );
  const radialPropagator3d = extractFromRepoFile(
    REPO_ROOT,
    "src/physics/reference/diffusion/distributions.ts",
    "radialPropagator3d",
  );
  const ftcs1d = extractFromRepoFile(
    REPO_ROOT,
    "src/physics/reference/diffusion/ftcs.ts",
    "ftcs1d",
  );

  const kernelFunctions: KernelFunctionRef[] = [
    { language: "ts", module: gaussianPropagator.module, exportName: "gaussianPropagator" },
    { language: "ts", module: intervalProbability.module, exportName: "intervalProbability" },
    { language: "ts", module: radialPropagator2d.module, exportName: "radialPropagator2d" },
    { language: "ts", module: radialPropagator3d.module, exportName: "radialPropagator3d" },
    { language: "ts", module: ftcs1d.module, exportName: "ftcs1d" },
  ];

  const bindings: IdentifierBinding[] = [
    { kernelFunction: "gaussianPropagator", identifier: "x", quantityId: "position" },
    { kernelFunction: "gaussianPropagator", identifier: "D", quantityId: "diffusionCoefficient" },
    { kernelFunction: "radialPropagator2d", identifier: "r", quantityId: "radialDistance" },
    // ftcs1d destructures `p` into `D`, `dx`, `dt` at its very first line, so
    // these identifiers are real even though they are not parameters.
    { kernelFunction: "ftcs1d", identifier: "dx", quantityId: "gridSpacing" },
    { kernelFunction: "ftcs1d", identifier: "dt", quantityId: "timeStep" },
  ];

  const map = extractedMap([
    gaussianPropagator,
    intervalProbability,
    radialPropagator2d,
    radialPropagator3d,
    ftcs1d,
  ]);

  test("BM-06's real bindings against real extracted source pass with zero violations", () => {
    const violations = checkKernelBindings({
      instrumentId: "bm-06",
      liveTermQuantityIds: [
        "position",
        "diffusionCoefficient",
        "radialDistance",
        "gridSpacing",
        "timeStep",
      ],
      kernelFunctions,
      identifierBindings: bindings,
      extractedByExportName: map,
    });
    expect(violations).toEqual([]);
  });

  test("ftcs1d's destructured parameters (D, dx, dt) are real identifiers, not property-access noise", () => {
    expect(ftcs1d.source).toContain("const { n, frames, stepsPerFrame, D, dx, dt, profile } = p;");
  });
});
