/**
 * Scenario adapters that can run during content preparation, before generated laboratory data
 * exists. The full scenario registry imports these same owner objects; no second physics owner
 * or hand-written formula is introduced for essay quotations.
 */
import { fileURLToPath, URL as NodeURL } from "node:url";
import { LQ04_DEFAULTS } from "../../experiments/lq04/definition.ts";
import { evaluateLq04 } from "../../experiments/lq04/session.ts";
import { createDeclaredConstantSet, getConstantSet } from "../../physics/reference/constants.ts";
import {
  rmsDisplacement,
  stokesEinsteinD,
} from "../../physics/reference/diffusion/distributions.ts";
import type { OwnerContext, OwnerRecord, OwnerResult } from "./owners.ts";

export class ScenarioOwnerInputError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ScenarioOwnerInputError";
    this.code = code;
  }
}

export function num(inputs: Record<string, number>, key: string): number {
  const value = inputs[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ScenarioOwnerInputError(
      "scenario-owner-input",
      `Owner input "${key}" is missing or nonfinite.`,
    );
  }
  return value;
}

export function printedBrownianSet() {
  return createDeclaredConstantSet({
    id: "scenario-einstein-1905-brownian-printed",
    era: 1905,
    provenance:
      "Declared editorial inputs matching Einstein 1905 printed R and N. Reserved historical set einstein-1905-brownian-printed is not registered (am-ref-constants-xik).",
    precisionNote: "Printed-era declared inputs, not 2019 SI definitions.",
    gasConstantProvenance: "measured-without-counting-molecules",
    entries: [
      {
        quantityId: "molarGasConstant",
        value: 8.31,
        exactDecimal: "8.31",
        unit: "J/(mol K)",
        kind: "declared-scenario",
        evidentialRole: "measured-observation",
        provenance: "Paper 2 does not print R; editorial input 8.31 J mol^-1 K^-1.",
        dependsOn: [],
        uncertainty: 0.005,
      },
      {
        quantityId: "avogadroConstant",
        value: 6e23,
        exactDecimal: "6e23",
        unit: "1/mol",
        kind: "declared-scenario",
        evidentialRole: "measured-observation",
        provenance: "Paper 2 printed N = 6e23 mol^-1.",
        dependsOn: [],
        uncertainty: 1e22,
      },
    ],
  });
}

function diffusionRms(ctx: OwnerContext): OwnerResult {
  const set =
    ctx.constantSetId === "modern-si-2019"
      ? getConstantSet("modern-si-2019")
      : printedBrownianSet();
  const D = stokesEinsteinD(
    {
      T: num(ctx.inputs, "temperature"),
      eta: num(ctx.inputs, "viscosity"),
      a: num(ctx.inputs, "particleRadius"),
    },
    set,
  );
  if (D.result.status !== "value" || typeof D.result.value !== "number") {
    // The model refused, and the code it refused with is the thing an acceptance case is for.
    return {
      refused: {
        outputId: "diffusionCoefficient",
        status: D.result.status,
        reasonCode: "condition" in D.result ? String(D.result.condition) : D.result.status,
      },
    };
  }
  const rms = rmsDisplacement(D.result.value, num(ctx.inputs, "elapsedTime"));
  if (rms.result.status !== "value" || typeof rms.result.value !== "number") {
    throw new ScenarioOwnerInputError(
      "scenario-owner-output",
      "rmsDisplacement did not return a value.",
    );
  }
  return { diffusionCoefficient: D.result.value, rmsDisplacement1d: rms.result.value };
}

export const DIFFUSION_RMS_OWNER: OwnerRecord = {
  id: "diffusion.stokesEinsteinRms",
  // These are filesystem provenance paths, not assets for Webpack's browser URL rewrite.
  sourcePath: fileURLToPath(new NodeURL("../../physics/reference/diffusion.ts", import.meta.url)),
  fn: diffusionRms,
};

export const LQ04_WORKBENCH_OWNER: OwnerRecord = {
  id: "lq04.workbench",
  sourcePath: fileURLToPath(new NodeURL("../../experiments/lq04/session.ts", import.meta.url)),
  fn: (ctx) => {
    const evaluated = evaluateLq04({ ...LQ04_DEFAULTS, ...ctx.inputs });
    if (evaluated.status !== "value")
      return {
        refused: {
          outputId: "radiationEntropy",
          status: evaluated.status,
          reasonCode: evaluated.condition,
        },
      };
    return {
      energy: evaluated.energy,
      initialTemperature: evaluated.initialTemperature,
      finalTemperature: evaluated.finalTemperature,
      initialX: evaluated.initialX,
      finalX: evaluated.finalX,
      radiationEntropy: evaluated.radiationEntropy,
      entropyVolumeCoefficient: evaluated.entropyVolumeCoefficient,
      effectiveIndependentCount: evaluated.effectiveIndependentCount,
    };
  },
};

export const CORE_NUMERIC_OWNERS: readonly OwnerRecord[] = [
  DIFFUSION_RMS_OWNER,
  LQ04_WORKBENCH_OWNER,
];
