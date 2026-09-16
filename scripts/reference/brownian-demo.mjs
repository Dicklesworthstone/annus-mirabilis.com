import { pathToFileURL } from "node:url";
import { decodeOutcome, decodeRefusal, decodeResult } from "../../src/experiments/results/codec.ts";
import { getConstantSet } from "../../src/physics/reference/constants.ts";
import {
  ftcs1d,
  ftcsAnalyticComparison,
  gaussianPropagator,
  intervalProbability,
  rmsDisplacement,
  stokesEinsteinD,
} from "../../src/physics/reference/diffusion.ts";

const defaults = Object.freeze({
  T: 293.15,
  eta: 0.001,
  a: 0.5e-6,
  t: 1,
  n: 101,
  dx: 1e-7,
  steps: 250,
});
/** Executable consumer of the reference owner, not a second implementation of its physics. */
export function runBrownianDemo(overrides = {}) {
  if (overrides === null || Object.getPrototypeOf(overrides) !== Object.prototype)
    throw new TypeError("Pass a JSON object of numeric inputs.");
  for (const key of Reflect.ownKeys(overrides)) {
    const property = Object.getOwnPropertyDescriptor(overrides, key);
    if (
      typeof key !== "string" ||
      !Object.hasOwn(defaults, key) ||
      !property?.enumerable ||
      !Object.hasOwn(property, "value") ||
      typeof property.value !== "number" ||
      !Number.isFinite(property.value)
    )
      throw new TypeError(`Invalid input: ${String(key)}.`);
  }
  const inputs = { ...defaults, ...overrides };
  const { T, eta, a, t, n, dx, steps } = inputs;
  if (t < 0 || !Number.isSafeInteger(steps) || steps < 1)
    throw new RangeError("Use nonnegative elapsed time and a positive whole-number step count.");
  const set = getConstantSet("modern-si-2019");
  const diffusivity = stokesEinsteinD({ T, eta, a }, set);
  const report = {
    schemaVersion: 1,
    execution: "host-reference",
    constantSetId: set.id,
    note: "Declared modern scenario, not a historical transcription or an admitted FrankenSim run.",
    units: { T: "K", eta: "Pa s", a: "m", t: "s", dx: "m" },
    inputs,
    model: diffusivity.model,
    diffusionCoefficient: decodeResult(diffusivity.result),
  };
  if (diffusivity.result.status !== "value") return report;
  const D = diffusivity.result.value;
  const requestedGrid = {
    n,
    frames: t === 0 ? 1 : 2,
    stepsPerFrame: steps,
    D,
    dx,
    dt: (t === 0 ? 1 : t) / steps,
    profile: 0,
  };
  const grid = ftcs1d(requestedGrid);
  const analytic = {
    rmsDisplacement: decodeResult(rmsDisplacement(D, t).result),
    probabilityWithinOneMicrometre: decodeResult(intervalProbability(-1e-6, 1e-6, t, D).result),
    densityAtOrigin: decodeResult(gaussianPropagator(0, t, D).result),
  };
  if (grid.kind === "refused")
    return {
      ...report,
      analytic,
      requestedGrid,
      grid: { kind: grid.kind, refusal: decodeRefusal(grid.refusal) },
    };
  if (grid.kind === "outcome")
    return {
      ...report,
      analytic,
      requestedGrid,
      grid: { kind: grid.kind, outcome: decodeOutcome(grid.outcome) },
    };
  const field = grid.data.values.slice(-n);
  const comparison = ftcsAnalyticComparison({
    field,
    dx,
    t: grid.data.elapsedTime,
    D,
    startCell: Math.floor(n / 2),
  });
  return {
    ...report,
    analytic,
    requestedGrid,
    grid: {
      kind: "accepted",
      elapsedTime: grid.data.elapsedTime,
      stepCount: grid.data.stepCount,
      stabilityRatio: grid.data.stabilityRatio,
      boundary: grid.data.boundary,
      lastFrame: Array.from(field),
    },
    comparison:
      comparison.kind === "accepted"
        ? {
            kind: "accepted",
            maxCellMassDifference: comparison.data.maxCellMassDifference,
            analyticMassInsideBox: comparison.data.analyticMassInsideBox,
            wallContact: comparison.data.wallContact,
            gridModel: comparison.data.gridModel,
            analyticModel: comparison.data.analyticModel,
          }
        : comparison,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length > 3) throw new TypeError("Pass at most one JSON object argument.");
    const text = process.argv[2] ?? "{}";
    if (text.length > 4096)
      throw new RangeError("Input exceeds the example's 4096-character limit.");
    console.log(JSON.stringify(runBrownianDemo(JSON.parse(text)), null, 2));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "The example could not read its inputs.",
    );
    process.exitCode = 1;
  }
}
