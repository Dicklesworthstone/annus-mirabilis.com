import {
  type ExecutionOutcome,
  executionOutcomeRegistry,
  type WorkBudget,
} from "../../../experiments/results/outcomes.ts";
import { makeRefusal } from "../../../experiments/results/refusals.ts";
import type { ScientificResult, Uncertainty } from "../../../experiments/results/types.ts";
import {
  REFERENCE_ZERO_FLUX_BUDGET,
  type ZeroFluxComputation,
  type ZeroFluxEvolution,
  type ZeroFluxOptions,
  zeroFluxEvolution,
} from "./zeroFlux.ts";

export type FtcsTimeComparisonParameters = Readonly<{
  /** The actual initial density field, not a presumed unit point source. */
  initialField: Float64Array;
  field: Float64Array;
  dx: number;
  /** The accepted explicit step's D*dt/dx^2, in [0, 0.5]. */
  stabilityRatio: number;
  steps: number;
}>;
export type FtcsTimeComparison = Readonly<{
  reference: ZeroFluxEvolution;
  referenceCellMasses: Float64Array;
  initialMass: ScientificResult;
  observedMass: ScientificResult;
  referenceMass: ScientificResult;
  signedMassDrift: ScientificResult;
  maxCellMassTimeError: ScientificResult;
  l1CellMassTimeError: ScientificResult;
  requestedBudget: WorkBudget;
  errorScope: "time-discretization-only";
  spatialError: "not-assessed";
  boundary: "zero-flux";
  ownerId: "diffusion.ftcsTimeDiscretizationComparison";
}>;

function invalid(
  parameterIds: readonly string[],
  requirements: string,
): ZeroFluxComputation<never> {
  return {
    kind: "refused",
    refusal: makeRefusal("invalid-parameter", { parameterIds }, { details: { requirements } }),
  };
}
function numerical(reason: string): ZeroFluxComputation<never> {
  return {
    kind: "outcome",
    outcome: {
      outcome: "invariant-violation",
      ...executionOutcomeRegistry["invariant-violation"],
      details: { reason },
    },
  };
}
function budgetOutcome(requested: WorkBudget, allowed: WorkBudget): ZeroFluxComputation<never> {
  const outcome: ExecutionOutcome = {
    outcome: "budget-exhausted",
    ...executionOutcomeRegistry["budget-exhausted"],
    requested,
    allowed,
  };
  return { kind: "outcome", outcome };
}
function massSum() {
  let value = 0;
  let correction = 0;
  return {
    add(term: number) {
      const adjusted = term - correction;
      const next = value + adjusted;
      correction = next - value - adjusted;
      value = next;
    },
    value: () => value,
  };
}
const ownerId = "diffusion.ftcsTimeDiscretizationComparison" as const;
function result(
  quantityId: string,
  value: number,
  semanticKind: string,
  uncertainty?: Uncertainty,
): ScientificResult {
  return Object.freeze({
    status: "value",
    value,
    quantityId,
    unit: "1",
    semanticKind,
    ownerId,
    ...(uncertainty === undefined ? {} : { uncertainty }),
  });
}

/**
 * Boundary- and initial-condition-matched temporal error, including after wall contact.
 *
 * Unlike ftcsAnalyticComparison's unbounded point-source Gaussian, this reference uses
 * the same finite-volume spatial operator and the caller's complete initial field.
 * It must not be presented as a continuum solution, a spatial-convergence test, or a
 * statistical confidence interval. Non-unit-mass profiles are deliberately NOT normalized.
 */
export function ftcsTimeDiscretizationComparison(
  parameters: FtcsTimeComparisonParameters,
  options: ZeroFluxOptions = {},
): ZeroFluxComputation<FtcsTimeComparison> {
  if (!parameters || typeof parameters !== "object")
    return invalid(["parameters"], "Provide an FTCS comparison request.");
  const { initialField, field, dx, stabilityRatio, steps } = parameters;
  if (
    !(initialField instanceof Float64Array) ||
    !(field instanceof Float64Array) ||
    !(initialField.buffer instanceof ArrayBuffer) ||
    !(field.buffer instanceof ArrayBuffer) ||
    initialField.length < 3 ||
    field.length !== initialField.length
  )
    return invalid(
      ["initialField", "field"],
      "Use same-sized, privately owned Float64Array fields with at least three cells.",
    );
  if (
    !Number.isFinite(dx) ||
    dx <= 0 ||
    !Number.isFinite(stabilityRatio) ||
    stabilityRatio < 0 ||
    stabilityRatio > 0.5 ||
    !Number.isSafeInteger(steps) ||
    steps < 0
  )
    return invalid(
      ["dx", "stabilityRatio", "steps"],
      "Use positive finite dx, an accepted FTCS ratio in [0, 0.5], and a nonnegative safe integer step count.",
    );
  if (!options || typeof options !== "object")
    return invalid(["options"], "Provide an options object.");
  const budget = options.budget ?? REFERENCE_ZERO_FLUX_BUDGET;
  if (![budget.workUnits, budget.allocationBytes].every((v) => Number.isSafeInteger(v) && v >= 0))
    return invalid(["workBudget"], "Work and allocation limits must be nonnegative safe integers.");
  const allowed = Object.freeze({
    workUnits: Math.min(budget.workUnits, REFERENCE_ZERO_FLUX_BUDGET.workUnits),
    allocationBytes: Math.min(budget.allocationBytes, REFERENCE_ZERO_FLUX_BUDGET.allocationBytes),
  });
  const n = field.length;
  const reserved = Object.freeze({ workUnits: 8 * n, allocationBytes: 8 * n });
  if (reserved.workUnits > allowed.workUnits || reserved.allocationBytes > allowed.allocationBytes)
    return budgetOutcome(reserved, allowed);
  if (!field.every((v) => Number.isFinite(v) && v >= 0))
    return invalid(["field"], "Every observed density must be finite and nonnegative.");
  const evolution = zeroFluxEvolution(initialField, stabilityRatio * steps, {
    ...options,
    budget: {
      workUnits: allowed.workUnits - reserved.workUnits,
      allocationBytes: allowed.allocationBytes - reserved.allocationBytes,
    },
  });
  if (evolution.kind !== "accepted") {
    if (evolution.kind === "outcome" && evolution.outcome.outcome === "budget-exhausted")
      return budgetOutcome(
        {
          workUnits: evolution.outcome.requested.workUnits + reserved.workUnits,
          allocationBytes: evolution.outcome.requested.allocationBytes + reserved.allocationBytes,
        },
        allowed,
      );
    return evolution;
  }
  const reference = evolution.data;
  const referenceCellMasses = new Float64Array(n);
  const initial = massSum(),
    observed = massSum(),
    referenceTotal = massSum(),
    l1 = massSum();
  let maxError = 0;
  for (let i = 0; i < n; i++) {
    const a = initialField[i]! * dx;
    const b = field[i]! * dx;
    const c = reference.values[i]! * dx;
    if (
      ![a, b, c].every(Number.isFinite) ||
      (initialField[i]! > 0 && a === 0) ||
      (field[i]! > 0 && b === 0) ||
      (reference.values[i]! > 0 && c === 0)
    )
      return numerical("A cell mass is outside binary64 range; no partial comparison is returned.");
    referenceCellMasses[i] = c;
    initial.add(a);
    observed.add(b);
    referenceTotal.add(c);
    const difference = Math.abs(b - c);
    l1.add(difference);
    maxError = Math.max(maxError, difference);
  }
  const initialMass = initial.value(),
    observedMass = observed.value(),
    referenceMass = referenceTotal.value();
  const l1Error = l1.value();
  if (![initialMass, observedMass, referenceMass, l1Error].every(Number.isFinite))
    return numerical("A total mass or error is outside binary64 range.");
  const magnitude =
    initialMass *
      (reference.truncationL1Bound +
        reference.roundoffL1Estimate +
        reference.roundoffL1Correction) +
    Math.max(initialMass, observedMass, referenceMass) * (16 * Number.EPSILON * n);
  if (!Number.isFinite(magnitude))
    return numerical("The numerical error estimate is outside binary64 range.");
  const uncertainty: Uncertainty = Object.freeze({
    kind: "numerical-error-estimate",
    magnitude,
    method:
      "Finite-grid series truncation plus floating-point error estimate; excludes spatial/model error.",
    guarantee: "estimate",
  });
  return {
    kind: "accepted",
    data: Object.freeze({
      reference,
      referenceCellMasses,
      initialMass: result("initialMass", initialMass, "cell-mass"),
      observedMass: result("observedMass", observedMass, "cell-mass"),
      referenceMass: result("referenceMass", referenceMass, "cell-mass"),
      signedMassDrift: result(
        "signedMassDrift",
        observedMass - initialMass,
        "cell-mass-difference",
      ),
      maxCellMassTimeError: result(
        "maxCellMassTimeError",
        maxError,
        "cell-mass-difference",
        uncertainty,
      ),
      l1CellMassTimeError: result(
        "l1CellMassTimeError",
        l1Error,
        "cell-mass-difference",
        uncertainty,
      ),
      requestedBudget: Object.freeze({
        workUnits: reference.requestedBudget.workUnits + reserved.workUnits,
        allocationBytes: reference.requestedBudget.allocationBytes + reserved.allocationBytes,
      }),
      errorScope: "time-discretization-only",
      spatialError: "not-assessed",
      boundary: "zero-flux",
      ownerId,
    }),
  };
}
