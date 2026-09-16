import { LQ01_BUDGET, LQ01_OUTPUTS } from "../../experiments/lq01/definition.ts";
import { validateLq01Parameters } from "../../experiments/lq01/parameters.ts";
import { decodeResult } from "../../experiments/results/codec.ts";
import {
  type ExecutionOutcomeId,
  executionOutcomeRegistry,
} from "../../experiments/results/outcomes.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import {
  aperturePower,
  fringeSpacingSmallAngle,
  fringeVisibility,
  inverseSquareIntensity,
  shellPowerIdentity,
  twoSourceIntensity,
} from "../../physics/reference/radiation/waves.ts";

export type Lq01Evaluation = Readonly<{
  outputs: readonly ScientificResult[];
  stepIndex: number;
  simulationTime: number;
}>;

export type EvaluationControl = Readonly<{
  cancelled?: () => boolean;
  yieldControl?: () => Promise<void>;
  chunkSteps?: number;
}>;

export { validateLq01Parameters } from "../../experiments/lq01/parameters.ts";

function outcome(id: Exclude<ExecutionOutcomeId, "budget-exhausted">): Computation<never> {
  return { kind: "outcome", outcome: { outcome: id, ...executionOutcomeRegistry[id] } };
}

function value(quantityId: string, val: number | Float64Array): ScientificResult {
  const c = LQ01_OUTPUTS[quantityId];
  if (!c) throw new TypeError(`Undeclared output ${quantityId}`);
  return decodeResult({
    quantityId,
    unit: c.unit,
    semanticKind: c.semanticKind,
    ownerId: c.ownerId,
    status: "value",
    value: val,
  });
}

function outsideDomain(quantityId: string, reason: string): ScientificResult {
  const c = LQ01_OUTPUTS[quantityId];
  if (!c) throw new TypeError(`Undeclared output ${quantityId}`);
  return decodeResult({
    quantityId,
    unit: c.unit,
    semanticKind: c.semanticKind,
    ownerId: c.ownerId,
    status: "outside-domain",
    condition: "outside-physical-domain",
    domainKind: "physical",
    reason,
  });
}

function getReason(res: { status: string; reason?: string } | { status: string }): string {
  return "reason" in res && typeof res.reason === "string"
    ? res.reason
    : "Evaluation outside valid physical domain.";
}

/** Evaluates LQ-01 wave description, interference, and energy spreading. */
export async function evaluateLq01(
  input: unknown,
  control: EvaluationControl = {},
): Promise<Computation<Lq01Evaluation>> {
  const validated = validateLq01Parameters(input);
  if (validated.kind !== "accepted") return validated;
  const p = validated.data;

  const cancelled = control.cancelled ?? (() => false);
  if (cancelled()) return outcome("cancelled");

  const workUnits = 200;
  const allocationBytes = 101 * 8 + 4096;
  if (workUnits > LQ01_BUDGET.workUnits || allocationBytes > LQ01_BUDGET.allocationBytes) {
    return {
      kind: "outcome",
      outcome: {
        outcome: "budget-exhausted",
        ...executionOutcomeRegistry["budget-exhausted"],
        requested: { workUnits, allocationBytes },
        allowed: LQ01_BUDGET,
      },
    };
  }

  const results: ScientificResult[] = [];

  // 1. Two-source interference and center intensity
  const centerRes = twoSourceIntensity({
    A1: p.A1,
    A2: p.A2,
    r1: 1,
    r2: 1,
    wavelength: p.wavelength,
    delta: p.delta,
    readout: p.readout,
    t: p.t,
  });

  if (centerRes.status === "value") {
    results.push(value("centerIntensity", centerRes.value));
  } else {
    results.push(outsideDomain("centerIntensity", getReason(centerRes)));
  }

  // 2. Instantaneous center intensity
  const instCenterRes = twoSourceIntensity({
    A1: p.A1,
    A2: p.A2,
    r1: 1,
    r2: 1,
    wavelength: p.wavelength,
    delta: p.delta,
    readout: "instantaneous",
    t: p.t,
  });

  if (instCenterRes.status === "value") {
    results.push(value("instantaneousCenterIntensity", instCenterRes.value));
  } else {
    results.push(outsideDomain("instantaneousCenterIntensity", getReason(instCenterRes)));
  }

  // 3. Fringe visibility
  const vis = fringeVisibility(p.A1, p.A2);
  results.push(value("fringeVisibility", vis));

  // 4. Fringe spacing (in units of lambda)
  // Delta y = lambda * D / d. In units of lambda, Delta y / lambda = (D/lambda) / (d/lambda) = screenDistance / separation
  let spacing = 0;
  if (p.separation > 0) {
    spacing = fringeSpacingSmallAngle(p.wavelength, p.separation, p.screenDistance);
    results.push(value("fringeSpacing", spacing));
  } else {
    results.push(
      outsideDomain("fringeSpacing", "Zero source separation produces infinite fringe spacing."),
    );
  }

  // 5. Selected screen position analysis
  const dPhys = p.separation * p.wavelength;
  const DPhys = p.screenDistance * p.wavelength;
  let yPos = 0;
  if (p.screenPosition === "first-min") {
    yPos = (spacing > 0 ? spacing : 1) * 0.5 * p.wavelength;
  } else if (p.screenPosition === "first-max") {
    yPos = (spacing > 0 ? spacing : 1) * 1.0 * p.wavelength;
  }

  const r1 = Math.sqrt(DPhys * DPhys + (yPos + dPhys / 2) * (yPos + dPhys / 2));
  const r2 = Math.sqrt(DPhys * DPhys + (yPos - dPhys / 2) * (yPos - dPhys / 2));
  const pathDiff = (r1 - r2) / p.wavelength;
  results.push(value("pathDifference", pathDiff));

  const k = (2 * Math.PI) / p.wavelength;
  const deltaLocal = p.delta + k * (r1 - r2);
  const selectedPosRes = twoSourceIntensity({
    A1: p.A1,
    A2: p.A2,
    r1: 1,
    r2: 1,
    wavelength: p.wavelength,
    delta: deltaLocal,
    readout: p.readout,
    t: p.t,
  });
  if (selectedPosRes.status === "value") {
    results.push(value("selectedPositionIntensity", selectedPosRes.value));
  } else {
    results.push(outsideDomain("selectedPositionIntensity", getReason(selectedPosRes)));
  }

  // 6. Screen intensity profile across 101 points: y in [-5*spacing, +5*spacing]
  const nPoints = 101;
  const screenProfile = new Float64Array(nPoints);
  const span = spacing > 0 ? spacing * 5 : 5;
  for (let i = 0; i < nPoints; i++) {
    const yNorm = -span + (2 * span * i) / (nPoints - 1);
    const yMeters = yNorm * p.wavelength;
    const r1_i = Math.sqrt(DPhys * DPhys + (yMeters + dPhys / 2) * (yMeters + dPhys / 2));
    const r2_i = Math.sqrt(DPhys * DPhys + (yMeters - dPhys / 2) * (yMeters - dPhys / 2));
    const delta_i = p.delta + k * (r1_i - r2_i);
    const res_i = twoSourceIntensity({
      A1: p.A1,
      A2: p.A2,
      r1: 1,
      r2: 1,
      wavelength: p.wavelength,
      delta: delta_i,
      readout: p.readout,
      t: p.t,
    });
    screenProfile[i] = res_i.status === "value" ? res_i.value : 0;
  }
  results.push(value("screenIntensity", screenProfile));

  // 7. Inverse-square spreading mode
  const iRes = inverseSquareIntensity(p.P, p.r);
  if (iRes.status === "value") {
    results.push(value("pointSourceIntensity", iRes.value));
  } else {
    results.push(outsideDomain("pointSourceIntensity", getReason(iRes)));
  }

  const shellRes = shellPowerIdentity({ P: p.P, r: p.r });
  if (shellRes.status === "value") {
    results.push(value("shellPower", shellRes.value));
  } else {
    results.push(outsideDomain("shellPower", getReason(shellRes)));
  }

  // 8. Aperture power comparison (1 cm^2 aperture = 1e-4 m^2)
  const apRes = aperturePower({ P: p.P, r: p.r, apertureArea: 0.0001 });
  if (apRes.status === "value") {
    results.push(value("smallAperturePower", apRes.value.smallAperturePower));
    results.push(value("exactDiskPower", apRes.value.exactDiskPower));
    results.push(value("relativeDifference", apRes.value.relativeDifference));
  } else {
    results.push(outsideDomain("smallAperturePower", getReason(apRes)));
    results.push(outsideDomain("exactDiskPower", getReason(apRes)));
    results.push(outsideDomain("relativeDifference", getReason(apRes)));
  }

  return {
    kind: "accepted",
    data: {
      outputs: Object.freeze(results),
      stepIndex: 0,
      simulationTime: p.t,
    },
  };
}
