/**
 * Shelf optics reference physics owner for Annus Mirabilis.
 * Covers Michelson-Morley arm times and fringe shifts with/without contraction,
 * Fizeau moving-water drag hypotheses and relativistic composition,
 * and Maxwell's wave equation invariance under Galilean and Lorentz substitutions.
 * Bead: am-ref-shelf-optics-okmt
 */

import type { DomainKind, ScientificResult } from "../../experiments/results/types.ts";
import { type ConstantSet, ConstantSetError, constantValue, getConstantSet } from "./constants.ts";
import { isMode1904, refuseModernSurface } from "./kinematics.ts";

export const OWNER_ID = "shelf-optics";

export type ShelfModelIdentity =
  | "mm-ether"
  | "mm-ether-contraction"
  | "fizeau-no-drag"
  | "fizeau-full-drag"
  | "fresnel-drag"
  | "relativistic-drag-later"
  | "galilean-wave-operator"
  | "lorentz-1904-wave-operator";

export type DragHypothesis = "no-drag" | "full-drag" | "fresnel-drag";

// ---------------------------------------------------------------------------
// ScientificResult builders
// ---------------------------------------------------------------------------

function identity(
  quantityId: string,
  unit: string,
  semanticKind: string,
  ownerId: string = OWNER_ID,
) {
  return { quantityId, unit, semanticKind, ownerId };
}

function asValue(
  quantityId: string,
  unit: string,
  semanticKind: string,
  value: number,
  ownerId: string = OWNER_ID,
): ScientificResult {
  return Object.freeze({
    ...identity(quantityId, unit, semanticKind, ownerId),
    status: "value" as const,
    value,
  });
}

function asOutside(
  quantityId: string,
  unit: string,
  semanticKind: string,
  condition: string,
  reason: string,
  domainKind: DomainKind = "physical",
  ownerId: string = OWNER_ID,
): ScientificResult {
  return Object.freeze({
    ...identity(quantityId, unit, semanticKind, ownerId),
    status: "outside-domain" as const,
    condition,
    domainKind,
    reason,
    boundary: Object.freeze({ parameterId: condition, value: 0 }),
  });
}

function resolveSpeedOfLight(constantSetInput?: ConstantSet | string): number {
  if (isMode1904() && !constantSetInput) {
    throw new ConstantSetError(
      "no-pre-1905-light-speed-set",
      "No constant set holding a light speed available by 1904 is registered.",
    );
  }
  if (typeof constantSetInput === "object" && constantSetInput !== null) {
    return constantValue(constantSetInput, "speedOfLight").value;
  }
  const setId = typeof constantSetInput === "string" ? constantSetInput : "modern-si-2019";
  const set = getConstantSet(setId);
  return constantValue(set, "speedOfLight").value;
}

// ---------------------------------------------------------------------------
// Michelson-Morley
// ---------------------------------------------------------------------------

export interface MichelsonMorleyTimesInput {
  lengthParallel?: number | undefined;
  lengthPerpendicular?: number | undefined;
  length?: number | undefined;
  pathInWavelengths?: number | undefined;
  windSpeed?: number | undefined;
  beta?: number | undefined;
  contraction: boolean;
  constantSet?: ConstantSet | string | undefined;
}

export interface MichelsonMorleyTimesResult {
  status: "value" | "outside-domain";
  modelIdentity: ShelfModelIdentity;
  timeParallel: ScientificResult;
  timePerpendicular: ScientificResult;
  timeDifference: ScientificResult;
  gamma: number;
  beta: number;
  condition?: string;
  reason?: string;
}

export function michelsonMorleyTimes(input: MichelsonMorleyTimesInput): MichelsonMorleyTimesResult {
  const modelId: ShelfModelIdentity = input.contraction ? "mm-ether-contraction" : "mm-ether";

  let beta: number;
  let c: number;

  if (input.beta !== undefined) {
    beta = input.beta;
    if (isMode1904()) {
      if (input.constantSet !== undefined) {
        resolveSpeedOfLight(input.constantSet);
      }
      c = 1.0;
    } else {
      c = resolveSpeedOfLight(input.constantSet);
    }
  } else if (input.windSpeed !== undefined) {
    c = resolveSpeedOfLight(input.constantSet);
    beta = input.windSpeed / c;
  } else {
    const errRes = asOutside(
      "timeDifference",
      "s",
      "time",
      "missing-speed",
      "Provide beta or windSpeed.",
    );
    return {
      status: "outside-domain",
      modelIdentity: modelId,
      timeParallel: errRes,
      timePerpendicular: errRes,
      timeDifference: errRes,
      gamma: Number.NaN,
      beta: Number.NaN,
      condition: "missing-speed",
      reason: "Provide beta or windSpeed.",
    };
  }

  if (!Number.isFinite(beta)) {
    const errRes = asOutside(
      "timeDifference",
      "s",
      "time",
      "nonfinite-input",
      "Beta must be a finite number.",
    );
    return {
      status: "outside-domain",
      modelIdentity: modelId,
      timeParallel: errRes,
      timePerpendicular: errRes,
      timeDifference: errRes,
      gamma: Number.NaN,
      beta,
      condition: "nonfinite-input",
      reason: "Beta must be a finite number.",
    };
  }

  if (Math.abs(beta) >= 1) {
    const errRes = asOutside(
      "timeDifference",
      "s",
      "time",
      "superluminal-speed",
      "Ether wind speed must be strictly subluminal (|beta| < 1).",
    );
    return {
      status: "outside-domain",
      modelIdentity: modelId,
      timeParallel: errRes,
      timePerpendicular: errRes,
      timeDifference: errRes,
      gamma: Number.NaN,
      beta,
      condition: "superluminal-speed",
      reason: "Ether wind speed must be strictly subluminal (|beta| < 1).",
    };
  }

  const lPar = input.lengthParallel ?? input.length ?? input.pathInWavelengths;
  const lPerp = input.lengthPerpendicular ?? input.length ?? input.pathInWavelengths;

  if (
    lPar === undefined ||
    lPerp === undefined ||
    !Number.isFinite(lPar) ||
    !Number.isFinite(lPerp) ||
    lPar <= 0 ||
    lPerp <= 0
  ) {
    const errRes = asOutside(
      "timeDifference",
      "s",
      "time",
      "nonpositive-dimension",
      "Arm lengths must be positive finite numbers.",
    );
    return {
      status: "outside-domain",
      modelIdentity: modelId,
      timeParallel: errRes,
      timePerpendicular: errRes,
      timeDifference: errRes,
      gamma: Number.NaN,
      beta,
      condition: "nonpositive-dimension",
      reason: "Arm lengths must be positive finite numbers.",
    };
  }

  const gamma = 1 / Math.sqrt(1 - beta * beta);
  const gm1 = (gamma * gamma * beta * beta) / (gamma + 1);

  let tPar: number;
  let tPerp: number;
  let dt: number;

  if (input.contraction) {
    tPar = (2 * lPar * gamma) / c;
    tPerp = (2 * lPerp * gamma) / c;
    dt = (2 * (lPar - lPerp) * gamma) / c;
  } else {
    tPar = (2 * lPar * gamma * gamma) / c;
    tPerp = (2 * lPerp * gamma) / c;
    if (lPar === lPerp) {
      // Cancellation-free form: 2L/c * gamma * (gamma - 1)
      dt = (2 * lPar * gamma * gm1) / c;
    } else {
      dt = ((2 * gamma) / c) * ((lPar - lPerp) * gamma + lPerp * gm1);
    }
  }

  return {
    status: "value",
    modelIdentity: modelId,
    timeParallel: asValue("timeParallel", "s", "time", tPar),
    timePerpendicular: asValue("timePerpendicular", "s", "time", tPerp),
    timeDifference: asValue("timeDifference", "s", "time", dt),
    gamma,
    beta,
  };
}

export interface MichelsonMorleyFringeShiftInput extends MichelsonMorleyTimesInput {
  wavelength?: number | undefined;
  pathInWavelengths?: number | undefined;
}

export interface MichelsonMorleyFringeShiftResult extends MichelsonMorleyTimesResult {
  fringeShift: ScientificResult;
  expectedFringeShiftFirstOrder: number;
}

export function michelsonMorleyFringeShift(
  input: MichelsonMorleyFringeShiftInput,
): MichelsonMorleyFringeShiftResult {
  const times = michelsonMorleyTimes(input);

  if (times.status !== "value") {
    const errRes = asOutside(
      "fringeShift",
      "dimensionless",
      "fringe-shift",
      times.condition ?? "error",
      times.reason ?? "Cannot compute fringe shift due to domain error.",
    );
    return {
      ...times,
      fringeShift: errRes,
      expectedFringeShiftFirstOrder: Number.NaN,
    };
  }

  const beta = times.beta;
  const gamma = times.gamma;
  const gm1 = (gamma * gamma * beta * beta) / (gamma + 1);

  let pathInWl: number;
  if (input.pathInWavelengths !== undefined) {
    if (!Number.isFinite(input.pathInWavelengths) || input.pathInWavelengths <= 0) {
      const errRes = asOutside(
        "fringeShift",
        "dimensionless",
        "fringe-shift",
        "nonpositive-dimension",
        "Path in wavelengths must be positive.",
      );
      return {
        ...times,
        status: "outside-domain",
        condition: "nonpositive-dimension",
        reason: "Path in wavelengths must be positive.",
        fringeShift: errRes,
        expectedFringeShiftFirstOrder: Number.NaN,
      };
    }
    pathInWl = input.pathInWavelengths;
  } else if (input.wavelength !== undefined) {
    if (!Number.isFinite(input.wavelength) || input.wavelength <= 0) {
      const errRes = asOutside(
        "fringeShift",
        "dimensionless",
        "fringe-shift",
        "nonpositive-dimension",
        "Wavelength must be positive.",
      );
      return {
        ...times,
        status: "outside-domain",
        condition: "nonpositive-dimension",
        reason: "Wavelength must be positive.",
        fringeShift: errRes,
        expectedFringeShiftFirstOrder: Number.NaN,
      };
    }
    const l = input.lengthParallel ?? input.length;
    if (l === undefined || l <= 0) {
      const errRes = asOutside(
        "fringeShift",
        "dimensionless",
        "fringe-shift",
        "nonpositive-dimension",
        "Arm length must be positive.",
      );
      return {
        ...times,
        status: "outside-domain",
        condition: "nonpositive-dimension",
        reason: "Arm length must be positive.",
        fringeShift: errRes,
        expectedFringeShiftFirstOrder: Number.NaN,
      };
    }
    pathInWl = l / input.wavelength;
  } else {
    const errRes = asOutside(
      "fringeShift",
      "dimensionless",
      "fringe-shift",
      "missing-wavelength",
      "Provide wavelength or pathInWavelengths.",
    );
    return {
      ...times,
      status: "outside-domain",
      condition: "missing-wavelength",
      reason: "Provide wavelength or pathInWavelengths.",
      fringeShift: errRes,
      expectedFringeShiftFirstOrder: Number.NaN,
    };
  }

  let deltaN: number;
  let firstOrder: number;

  if (input.contraction) {
    const lPar = input.lengthParallel ?? input.length ?? 1;
    const lPerp = input.lengthPerpendicular ?? input.length ?? 1;
    if (lPar === lPerp) {
      deltaN = 0.0;
      firstOrder = 0.0;
    } else {
      const wl = input.wavelength ?? lPar / pathInWl;
      deltaN = (2 * (lPar - lPerp) * gamma) / wl;
      firstOrder = (2 * (lPar - lPerp)) / wl;
    }
  } else {
    // Exact fringe shift upon 90 degree rotation:
    // Delta N = 4 * (L / lambda) * gamma * (gamma - 1)
    deltaN = 4 * pathInWl * gamma * gm1;
    // Low speed / first order in beta^2: 2 * (L / lambda) * beta^2
    firstOrder = 2 * pathInWl * beta * beta;
  }

  return {
    ...times,
    fringeShift: asValue("fringeShift", "dimensionless", "fringe-shift", deltaN),
    expectedFringeShiftFirstOrder: firstOrder,
  };
}

// ---------------------------------------------------------------------------
// Fizeau's Moving Water
// ---------------------------------------------------------------------------

export interface FizeauFringeShiftInput {
  waterPathPerBeam: number;
  waterSpeed?: number | undefined;
  waterSpeedFractionOfC?: number | undefined;
  refractiveIndex: number;
  wavelength: number;
  dragHypothesis: DragHypothesis;
  reversal?: boolean | undefined;
  constantSet?: ConstantSet | string | undefined;
}

export interface FizeauFringeShiftResult {
  status: "value" | "outside-domain";
  modelIdentity: ShelfModelIdentity;
  dragHypothesis: DragHypothesis;
  dragCoefficient: ScientificResult;
  fringeShift: ScientificResult;
  fringeShiftFirstOrder: ScientificResult;
  timeDifference: ScientificResult;
  speedAlongFlow: ScientificResult;
  speedAgainstFlow: ScientificResult;
  condition?: string;
  reason?: string;
}

export function fizeauFringeShift(input: FizeauFringeShiftInput): FizeauFringeShiftResult {
  const modelId: ShelfModelIdentity =
    input.dragHypothesis === "no-drag"
      ? "fizeau-no-drag"
      : input.dragHypothesis === "full-drag"
        ? "fizeau-full-drag"
        : "fresnel-drag";

  if (!Number.isFinite(input.refractiveIndex) || input.refractiveIndex < 1) {
    const errRes = asOutside(
      "fringeShift",
      "dimensionless",
      "fringe-shift",
      "sub-vacuum-index",
      "Refractive index must be >= 1.",
    );
    return {
      status: "outside-domain",
      modelIdentity: modelId,
      dragHypothesis: input.dragHypothesis,
      dragCoefficient: errRes,
      fringeShift: errRes,
      fringeShiftFirstOrder: errRes,
      timeDifference: errRes,
      speedAlongFlow: errRes,
      speedAgainstFlow: errRes,
      condition: "sub-vacuum-index",
      reason: "Refractive index must be >= 1.",
    };
  }

  if (
    !Number.isFinite(input.waterPathPerBeam) ||
    input.waterPathPerBeam <= 0 ||
    !Number.isFinite(input.wavelength) ||
    input.wavelength <= 0
  ) {
    const errRes = asOutside(
      "fringeShift",
      "dimensionless",
      "fringe-shift",
      "nonpositive-dimension",
      "Water path and wavelength must be positive numbers.",
    );
    return {
      status: "outside-domain",
      modelIdentity: modelId,
      dragHypothesis: input.dragHypothesis,
      dragCoefficient: errRes,
      fringeShift: errRes,
      fringeShiftFirstOrder: errRes,
      timeDifference: errRes,
      speedAlongFlow: errRes,
      speedAgainstFlow: errRes,
      condition: "nonpositive-dimension",
      reason: "Water path and wavelength must be positive numbers.",
    };
  }

  let beta: number;
  let c: number;

  if (input.waterSpeedFractionOfC !== undefined) {
    beta = input.waterSpeedFractionOfC;
    if (isMode1904()) {
      if (input.constantSet !== undefined) {
        resolveSpeedOfLight(input.constantSet);
      }
      c = 1.0;
    } else {
      c = resolveSpeedOfLight(input.constantSet);
    }
  } else if (input.waterSpeed !== undefined) {
    c = resolveSpeedOfLight(input.constantSet);
    beta = input.waterSpeed / c;
  } else {
    const errRes = asOutside(
      "fringeShift",
      "dimensionless",
      "fringe-shift",
      "missing-speed",
      "Provide waterSpeed or waterSpeedFractionOfC.",
    );
    return {
      status: "outside-domain",
      modelIdentity: modelId,
      dragHypothesis: input.dragHypothesis,
      dragCoefficient: errRes,
      fringeShift: errRes,
      fringeShiftFirstOrder: errRes,
      timeDifference: errRes,
      speedAlongFlow: errRes,
      speedAgainstFlow: errRes,
      condition: "missing-speed",
      reason: "Provide waterSpeed or waterSpeedFractionOfC.",
    };
  }

  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    const errRes = asOutside(
      "fringeShift",
      "dimensionless",
      "fringe-shift",
      "superluminal-speed",
      "Water speed must be strictly subluminal (|beta| < 1).",
    );
    return {
      status: "outside-domain",
      modelIdentity: modelId,
      dragHypothesis: input.dragHypothesis,
      dragCoefficient: errRes,
      fringeShift: errRes,
      fringeShiftFirstOrder: errRes,
      timeDifference: errRes,
      speedAlongFlow: errRes,
      speedAgainstFlow: errRes,
      condition: "superluminal-speed",
      reason: "Water speed must be strictly subluminal (|beta| < 1).",
    };
  }

  const n = input.refractiveIndex;
  const n2 = n * n;
  let f: number;

  switch (input.dragHypothesis) {
    case "no-drag":
      f = 0.0;
      break;
    case "full-drag":
      f = 1.0;
      break;
    case "fresnel-drag":
      f = 1.0 - 1.0 / n2;
      break;
  }

  const v = beta * c;
  const uPlus = c / n + f * v;
  const uMinus = c / n - f * v;

  const Lw = input.waterPathPerBeam;
  const lambda = input.wavelength;
  const reversalFactor = input.reversal ? 2.0 : 1.0;

  // Exact time difference: Lw / (c/n - fv) - Lw / (c/n + fv)
  const dt1dir = (2 * Lw * f * v) / ((c / n) * (c / n) - f * v * (f * v));
  const dt = reversalFactor * dt1dir;

  // Fringe shift Delta N = c * Delta t / lambda
  // Notice c * dt1dir = (2 * Lw * n^2 * f * beta) / (lambda * (1 - (n * f * beta)^2))
  const nfBeta = n * f * beta;
  const denominator = 1 - nfBeta * nfBeta;
  const deltaN1dir = (2 * Lw * n2 * f * beta) / (lambda * denominator);
  const deltaN = reversalFactor * deltaN1dir;

  const deltaNFirstOrder = (reversalFactor * (2 * Lw * n2 * f * beta)) / lambda;

  return {
    status: "value",
    modelIdentity: modelId,
    dragHypothesis: input.dragHypothesis,
    dragCoefficient: asValue("dragCoefficient", "dimensionless", "coefficient", f),
    fringeShift: asValue("fringeShift", "dimensionless", "fringe-shift", deltaN),
    fringeShiftFirstOrder: asValue(
      "fringeShift",
      "dimensionless",
      "fringe-shift",
      deltaNFirstOrder,
    ),
    timeDifference: asValue("timeDifference", "s", "time", dt),
    speedAlongFlow: asValue("apparentSpeed", "m/s", "speed", uPlus),
    speedAgainstFlow: asValue("apparentSpeed", "m/s", "speed", uMinus),
  };
}

export interface FresnelDraggedSpeedInput {
  refractiveIndex: number;
  waterSpeed?: number | undefined;
  waterSpeedFractionOfC?: number | undefined;
  constantSet?: ConstantSet | string | undefined;
}

export interface FresnelDraggedSpeedResult {
  status: "value" | "outside-domain";
  modelIdentity: "fresnel-drag";
  dragCoefficient: ScientificResult;
  draggedSpeed: ScientificResult;
  velocityIncrement: ScientificResult;
  condition?: string;
  reason?: string;
}

export function fresnelDraggedSpeed(input: FresnelDraggedSpeedInput): FresnelDraggedSpeedResult {
  if (!Number.isFinite(input.refractiveIndex) || input.refractiveIndex < 1) {
    const errRes = asOutside(
      "draggedSpeed",
      "m/s",
      "speed",
      "sub-vacuum-index",
      "Refractive index must be >= 1.",
    );
    return {
      status: "outside-domain",
      modelIdentity: "fresnel-drag",
      dragCoefficient: errRes,
      draggedSpeed: errRes,
      velocityIncrement: errRes,
      condition: "sub-vacuum-index",
      reason: "Refractive index must be >= 1.",
    };
  }

  let beta: number;
  let c: number;

  if (input.waterSpeedFractionOfC !== undefined) {
    beta = input.waterSpeedFractionOfC;
    if (isMode1904()) {
      if (input.constantSet !== undefined) {
        resolveSpeedOfLight(input.constantSet);
      }
      c = 1.0;
    } else {
      c = resolveSpeedOfLight(input.constantSet);
    }
  } else if (input.waterSpeed !== undefined) {
    c = resolveSpeedOfLight(input.constantSet);
    beta = input.waterSpeed / c;
  } else {
    const errRes = asOutside(
      "draggedSpeed",
      "m/s",
      "speed",
      "missing-speed",
      "Provide waterSpeed or waterSpeedFractionOfC.",
    );
    return {
      status: "outside-domain",
      modelIdentity: "fresnel-drag",
      dragCoefficient: errRes,
      draggedSpeed: errRes,
      velocityIncrement: errRes,
      condition: "missing-speed",
      reason: "Provide waterSpeed or waterSpeedFractionOfC.",
    };
  }

  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    const errRes = asOutside(
      "draggedSpeed",
      "m/s",
      "speed",
      "superluminal-speed",
      "Water speed must be strictly subluminal (|beta| < 1).",
    );
    return {
      status: "outside-domain",
      modelIdentity: "fresnel-drag",
      dragCoefficient: errRes,
      draggedSpeed: errRes,
      velocityIncrement: errRes,
      condition: "superluminal-speed",
      reason: "Water speed must be strictly subluminal (|beta| < 1).",
    };
  }

  const n = input.refractiveIndex;
  const f = 1.0 - 1.0 / (n * n);
  const v = beta * c;
  const fv = f * v;
  const u = c / n + fv;

  return {
    status: "value",
    modelIdentity: "fresnel-drag",
    dragCoefficient: asValue("dragCoefficient", "dimensionless", "coefficient", f),
    draggedSpeed: asValue("apparentSpeed", "m/s", "speed", u),
    velocityIncrement: asValue("apparentSpeed", "m/s", "speed", fv),
  };
}

export interface RelativisticDraggedSpeedInput {
  refractiveIndex: number;
  waterSpeed?: number | undefined;
  waterSpeedFractionOfC?: number | undefined;
  constantSet?: ConstantSet | string | undefined;
}

export interface RelativisticDraggedSpeedResult {
  status: "value" | "outside-domain";
  modelIdentity: "relativistic-drag-later";
  historicalStatus: "later-development";
  draggedSpeed: ScientificResult;
  velocityIncrement: ScientificResult;
  fresnelFirstOrderIncrement: ScientificResult;
  relativeDifferenceToFresnel: ScientificResult;
  secondOrderTerm: ScientificResult;
  condition?: string;
  reason?: string;
}

export function relativisticDraggedSpeed(
  input: RelativisticDraggedSpeedInput,
): RelativisticDraggedSpeedResult {
  if (isMode1904()) {
    refuseModernSurface(
      "relativisticDraggedSpeed is a later (1907) comparison not available in 1904 mode.",
    );
  }

  if (!Number.isFinite(input.refractiveIndex) || input.refractiveIndex < 1) {
    const errRes = asOutside(
      "draggedSpeed",
      "m/s",
      "speed",
      "sub-vacuum-index",
      "Refractive index must be >= 1.",
    );
    return {
      status: "outside-domain",
      modelIdentity: "relativistic-drag-later",
      historicalStatus: "later-development",
      draggedSpeed: errRes,
      velocityIncrement: errRes,
      fresnelFirstOrderIncrement: errRes,
      relativeDifferenceToFresnel: errRes,
      secondOrderTerm: errRes,
      condition: "sub-vacuum-index",
      reason: "Refractive index must be >= 1.",
    };
  }

  const c = resolveSpeedOfLight(input.constantSet);
  let beta: number;

  if (input.waterSpeedFractionOfC !== undefined) {
    beta = input.waterSpeedFractionOfC;
  } else if (input.waterSpeed !== undefined) {
    beta = input.waterSpeed / c;
  } else {
    const errRes = asOutside(
      "draggedSpeed",
      "m/s",
      "speed",
      "missing-speed",
      "Provide waterSpeed or waterSpeedFractionOfC.",
    );
    return {
      status: "outside-domain",
      modelIdentity: "relativistic-drag-later",
      historicalStatus: "later-development",
      draggedSpeed: errRes,
      velocityIncrement: errRes,
      fresnelFirstOrderIncrement: errRes,
      relativeDifferenceToFresnel: errRes,
      secondOrderTerm: errRes,
      condition: "missing-speed",
      reason: "Provide waterSpeed or waterSpeedFractionOfC.",
    };
  }

  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    const errRes = asOutside(
      "draggedSpeed",
      "m/s",
      "speed",
      "superluminal-speed",
      "Water speed must be strictly subluminal (|beta| < 1).",
    );
    return {
      status: "outside-domain",
      modelIdentity: "relativistic-drag-later",
      historicalStatus: "later-development",
      draggedSpeed: errRes,
      velocityIncrement: errRes,
      fresnelFirstOrderIncrement: errRes,
      relativeDifferenceToFresnel: errRes,
      secondOrderTerm: errRes,
      condition: "superluminal-speed",
      reason: "Water speed must be strictly subluminal (|beta| < 1).",
    };
  }

  const n = input.refractiveIndex;
  const v = beta * c;
  const f = 1.0 - 1.0 / (n * n);
  const fv = f * v;

  // Cancellation-free relativistic increment:
  // u_rel = (c/n + v) / (1 + v/(nc))
  // u_rel - c/n = fv / (1 + v/(nc))
  const denom = 1.0 + v / (n * c);
  const deltaURel = fv / denom;
  const uRel = c / n + deltaURel;

  // Relative difference to Fresnel: (deltaURel - fv) / fv = - (v/(nc)) / (1 + v/(nc))
  const relDiff = -(v / (n * c)) / denom;

  // Second order term: deltaURel - fv = - (v^2 / (nc)) * (1 - 1/n^2) / denom
  const secondOrder = deltaURel - fv;

  return {
    status: "value",
    modelIdentity: "relativistic-drag-later",
    historicalStatus: "later-development",
    draggedSpeed: asValue("apparentSpeed", "m/s", "speed", uRel),
    velocityIncrement: asValue("apparentSpeed", "m/s", "speed", deltaURel),
    fresnelFirstOrderIncrement: asValue("apparentSpeed", "m/s", "speed", fv),
    relativeDifferenceToFresnel: asValue(
      "fringeShift",
      "dimensionless",
      "relative-difference",
      relDiff,
    ),
    secondOrderTerm: asValue("apparentSpeed", "m/s", "speed", secondOrder),
  };
}

// ---------------------------------------------------------------------------
// Maxwell under Galilean and Lorentz Substitutions
// ---------------------------------------------------------------------------

export interface WaveEquationResidualInput {
  map: "galilean" | "lorentz";
  frameSpeed?: number | undefined;
  beta?: number | undefined;
  wavenumber: number;
  samples?: number | undefined;
  constantSet?: ConstantSet | string | undefined;
}

export interface WaveEquationResidualResult {
  status: "value" | "outside-domain";
  modelIdentity: "galilean-wave-operator" | "lorentz-1904-wave-operator";
  historicalStatus: "available-before-cutoff";
  map: "galilean" | "lorentz";
  beta: number;
  wavenumber: number;
  maxResidual: ScientificResult;
  relativeResidual: ScientificResult;
  crossTermCoefficient: number;
  scaleResidual: number;
  condition?: string;
  reason?: string;
}

export function waveEquationResidual(input: WaveEquationResidualInput): WaveEquationResidualResult {
  const modelId: "galilean-wave-operator" | "lorentz-1904-wave-operator" =
    input.map === "galilean" ? "galilean-wave-operator" : "lorentz-1904-wave-operator";

  let beta: number;
  let c: number;

  if (input.beta !== undefined) {
    beta = input.beta;
    if (isMode1904()) {
      if (input.constantSet !== undefined) {
        resolveSpeedOfLight(input.constantSet);
      }
      c = 1.0;
    } else {
      c = resolveSpeedOfLight(input.constantSet);
    }
  } else if (input.frameSpeed !== undefined) {
    c = resolveSpeedOfLight(input.constantSet);
    beta = input.frameSpeed / c;
  } else {
    const errRes = asOutside(
      "relativeResidual",
      "dimensionless",
      "residual",
      "missing-speed",
      "Provide frameSpeed or beta.",
    );
    return {
      status: "outside-domain",
      modelIdentity: modelId,
      historicalStatus: "available-before-cutoff",
      map: input.map,
      beta: Number.NaN,
      wavenumber: input.wavenumber,
      maxResidual: errRes,
      relativeResidual: errRes,
      crossTermCoefficient: Number.NaN,
      scaleResidual: Number.NaN,
      condition: "missing-speed",
      reason: "Provide frameSpeed or beta.",
    };
  }

  if (!Number.isFinite(beta) || Math.abs(beta) >= 1) {
    const errRes = asOutside(
      "relativeResidual",
      "dimensionless",
      "residual",
      "superluminal-speed",
      "Frame speed must be strictly subluminal (|beta| < 1).",
    );
    return {
      status: "outside-domain",
      modelIdentity: modelId,
      historicalStatus: "available-before-cutoff",
      map: input.map,
      beta,
      wavenumber: input.wavenumber,
      maxResidual: errRes,
      relativeResidual: errRes,
      crossTermCoefficient: Number.NaN,
      scaleResidual: Number.NaN,
      condition: "superluminal-speed",
      reason: "Frame speed must be strictly subluminal (|beta| < 1).",
    };
  }

  if (!Number.isFinite(input.wavenumber) || input.wavenumber <= 0) {
    const errRes = asOutside(
      "relativeResidual",
      "dimensionless",
      "residual",
      "nonpositive-wavenumber",
      "Wavenumber must be a positive finite number.",
    );
    return {
      status: "outside-domain",
      modelIdentity: modelId,
      historicalStatus: "available-before-cutoff",
      map: input.map,
      beta,
      wavenumber: input.wavenumber,
      maxResidual: errRes,
      relativeResidual: errRes,
      crossTermCoefficient: Number.NaN,
      scaleResidual: Number.NaN,
      condition: "nonpositive-wavenumber",
      reason: "Wavenumber must be a positive finite number.",
    };
  }

  const k = input.wavenumber;
  const scale = k * k;

  if (input.map === "galilean") {
    // 1D wave operator under Galilean substitution x' = x - vt, t' = t:
    // (1 - beta^2) d^2/dx'^2 + (2v/c^2) d^2/(dx' dt') - (1/c^2) d^2/dt'^2
    // Acting on plane wave phi = cos(k(x - ct)) = cos(kx' - k(c - v)t'):
    // Wave equation residual: Box' phi = - k^2 cos(theta) * (2*beta - beta^2)
    const relRes = Math.abs(beta * (2 - beta));
    const maxRes = scale * relRes;
    const crossTerm = (2 * beta) / c;

    return {
      status: "value",
      modelIdentity: "galilean-wave-operator",
      historicalStatus: "available-before-cutoff",
      map: "galilean",
      beta,
      wavenumber: k,
      maxResidual: asValue("relativeResidual", "1/m2", "operator-residual", maxRes),
      relativeResidual: asValue("relativeResidual", "dimensionless", "residual", relRes),
      crossTermCoefficient: crossTerm,
      scaleResidual: scale,
    };
  }

  // Lorentz substitution: Wave operator is strictly invariant: Box' phi = 0
  return {
    status: "value",
    modelIdentity: "lorentz-1904-wave-operator",
    historicalStatus: "available-before-cutoff",
    map: "lorentz",
    beta,
    wavenumber: k,
    maxResidual: asValue("relativeResidual", "1/m2", "operator-residual", 0.0),
    relativeResidual: asValue("relativeResidual", "dimensionless", "residual", 0.0),
    crossTermCoefficient: 0.0,
    scaleResidual: scale,
  };
}

// ---------------------------------------------------------------------------
// Historical fixtures declarations (AC10)
// ---------------------------------------------------------------------------

export interface ShelfHistoricalFixtureMetadata {
  readonly id: string;
  readonly kind: "historical-fixture";
  readonly paper: string;
  readonly sectionId: string;
  readonly printedPage: number;
  readonly transcription: Readonly<{
    status: "pending";
    reason: string;
  }>;
}

export const SHELF_HISTORICAL_FIXTURES: readonly ShelfHistoricalFixtureMetadata[] =
  Object.freeze([
    Object.freeze({
      id: "shelf-mm-1887-historical",
      kind: "historical-fixture" as const,
      paper: "special-relativity",
      sectionId: "shelf",
      printedPage: 333,
      transcription: Object.freeze({
        status: "pending" as const,
        reason:
          "1887 Michelson-Morley observational bound awaiting facsimile review from Am. J. Sci. (3) 34 (1887) 333.",
      }),
    }),
    Object.freeze({
      id: "shelf-fizeau-1851-historical",
      kind: "historical-fixture" as const,
      paper: "special-relativity",
      sectionId: "shelf",
      printedPage: 349,
      transcription: Object.freeze({
        status: "pending" as const,
        reason:
          "1851 Fizeau moving-water data awaiting transcription from Comptes rendus 33 (1851) 349.",
      }),
    }),
  ]);
