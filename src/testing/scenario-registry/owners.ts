import { fileURLToPath } from "node:url";
import { createDeclaredConstantSet, getConstantSet } from "../../physics/reference/constants.ts";
import {
  apparentSpeed,
  rmsDisplacement,
  stokesEinsteinD,
} from "../../physics/reference/diffusion.ts";
import {
  aperturePower,
  bandLimitedMeanQuantumEnergyWien,
  independentPointsProbability,
  meanQuantumEnergyWien,
  planckBandEnergyDensity,
  planckFrequencyEnergyDensity,
} from "../../physics/reference/radiation.ts";
import {
  conductorFrameEmf,
  fresnelDraggedIncrement,
  magnetFrameEmf,
  relativisticDraggedIncrement,
  rootTwoScale,
  timesTwoClosed,
  timesTwoFromAdd,
} from "../scenario-fixtures/evaluator.ts";
import { timesTwoWrapper } from "../scenario-fixtures/evaluatorWrapper.ts";

export type OwnerContext = Readonly<{
  inputs: Record<string, number>;
  constantSetId: string;
}>;
export type OwnerFn = (ctx: OwnerContext) => Record<string, number>;
export type OwnerRecord = Readonly<{
  id: string;
  fn: OwnerFn;
  sourcePath: string;
}>;

const C = 299792458;
const evaluatorPath = fileURLToPath(new URL("../scenario-fixtures/evaluator.ts", import.meta.url));
const wrapperPath = fileURLToPath(
  new URL("../scenario-fixtures/evaluatorWrapper.ts", import.meta.url),
);
const diffusionPath = fileURLToPath(
  new URL("../../physics/reference/diffusion/distributions.ts", import.meta.url),
);

function num(inputs: Record<string, number>, key: string): number {
  const value = inputs[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Owner input "${key}" is missing or nonfinite.`);
  }
  return value;
}

function printedBrownianSet() {
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

function diffusionRms(ctx: OwnerContext): Record<string, number> {
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
    throw new Error("stokesEinsteinD did not return a value.");
  }
  const rms = rmsDisplacement(D.result.value, num(ctx.inputs, "elapsedTime"));
  if (rms.result.status !== "value" || typeof rms.result.value !== "number") {
    throw new Error("rmsDisplacement did not return a value.");
  }
  return { diffusionCoefficient: D.result.value, rmsDisplacement1d: rms.result.value };
}

const OWNERS: OwnerRecord[] = [
  {
    id: "selfTest.timesTwoClosed",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({ value: timesTwoClosed(num(ctx.inputs, "x")) }),
  },
  {
    id: "selfTest.timesTwoFromAdd",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({ value: timesTwoFromAdd(num(ctx.inputs, "x")) }),
  },
  {
    id: "selfTest.timesTwoWrapper",
    sourcePath: wrapperPath,
    fn: (ctx) => ({ value: timesTwoWrapper(num(ctx.inputs, "x")) }),
  },
  {
    id: "selfTest.identityRatio",
    sourcePath: evaluatorPath,
    fn: (ctx) => {
      const a = apparentSpeed(num(ctx.inputs, "D"), num(ctx.inputs, "tau"));
      const b = apparentSpeed(num(ctx.inputs, "D"), num(ctx.inputs, "tau") / 4);
      if (a.result.status !== "value" || b.result.status !== "value") {
        throw new Error("apparentSpeed did not return a value.");
      }
      return { ratio: (b.result.value as number) / (a.result.value as number) };
    },
  },
  {
    id: "selfTest.identityExponent",
    sourcePath: evaluatorPath,
    fn: () => ({ ratio: 2 }),
  },
  {
    id: "selfTest.rootTwoScale",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({ rmsDisplacement1d: rootTwoScale(num(ctx.inputs, "baselineRms")) }),
  },
  {
    id: "selfTest.constant",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({ value: num(ctx.inputs, "value") }),
  },
  {
    id: "selfTest.magnetFrameEmf",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({
      emf: magnetFrameEmf(num(ctx.inputs, "B"), num(ctx.inputs, "v"), num(ctx.inputs, "ell")),
    }),
  },
  {
    id: "selfTest.conductorFrameEmf",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({
      emf: conductorFrameEmf(num(ctx.inputs, "B"), num(ctx.inputs, "v"), num(ctx.inputs, "ell"), C),
    }),
  },
  {
    id: "selfTest.fresnelDrag",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({
      increment: fresnelDraggedIncrement(num(ctx.inputs, "n"), num(ctx.inputs, "flow")),
    }),
  },
  {
    id: "selfTest.relativisticDrag",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({
      increment: relativisticDraggedIncrement(num(ctx.inputs, "n"), num(ctx.inputs, "flow"), C),
    }),
  },
  {
    id: "diffusion.stokesEinsteinRms",
    sourcePath: diffusionPath,
    fn: diffusionRms,
  },
  {
    id: "diffusion.apparentSpeedRatio",
    sourcePath: diffusionPath,
    fn: (ctx) => {
      const D = num(ctx.inputs, "D");
      const tau = num(ctx.inputs, "tau");
      const a = apparentSpeed(D, tau);
      const b = apparentSpeed(D, tau / 4);
      if (a.result.status !== "value" || b.result.status !== "value") {
        throw new Error("apparentSpeed did not return a value.");
      }
      return { ratio: (b.result.value as number) / (a.result.value as number) };
    },
  },
  {
    id: "diffusion.apparentSpeedExponent",
    sourcePath: evaluatorPath,
    fn: () => ({ ratio: 2 }),
  },
  {
    id: "radiation.meanQuantumEnergyExtrapolation",
    sourcePath: fileURLToPath(new URL("../../physics/reference/radiation.ts", import.meta.url)),
    fn: (ctx) => {
      const set = getConstantSet(ctx.constantSetId || "modern-si-2019");
      const res = meanQuantumEnergyWien(num(ctx.inputs, "temperature"), set);
      return {
        meanQuantumEnergyWien: res.meanQuantumEnergyWien,
        ratioToMoleculeKinetic: res.ratioToMoleculeKinetic,
      };
    },
  },
  {
    id: "radiation.meanQuantumEnergyBand",
    sourcePath: fileURLToPath(new URL("../../physics/reference/radiation.ts", import.meta.url)),
    fn: (ctx) => {
      const set = getConstantSet(ctx.constantSetId || "modern-si-2019");
      const res = bandLimitedMeanQuantumEnergyWien(
        num(ctx.inputs, "temperature"),
        num(ctx.inputs, "xMin"),
        num(ctx.inputs, "xMax"),
        set,
      );
      if (res.status !== "value") throw new Error("bandLimitedMeanQuantumEnergyWien refused inputs.");
      return {
        meanQuantumEnergyWien: res.meanQuantumEnergyWien,
        energyShareBelowBoundary: res.energyShareBelowBoundary,
        countShareBelowBoundary: res.countShareBelowBoundary,
      };
    },
  },
  {
    id: "radiation.spectra",
    sourcePath: fileURLToPath(new URL("../../physics/reference/radiation.ts", import.meta.url)),
    fn: (ctx) => {
      const set = getConstantSet(ctx.constantSetId || "modern-si-2019");
      const nu = num(ctx.inputs, "frequency");
      const T = num(ctx.inputs, "temperature");
      const res = planckFrequencyEnergyDensity(nu, T, set);
      if (res.status !== "value") throw new Error("planckFrequencyEnergyDensity refused inputs.");
      return {
        frequencyEnergyDensity: res.value,
        logFrequencyEnergyDensity: res.logFrequencyEnergyDensity ?? 0,
      };
    },
  },
  {
    id: "radiation.bandEnergy",
    sourcePath: fileURLToPath(new URL("../../physics/reference/radiation.ts", import.meta.url)),
    fn: (ctx) => {
      const set = getConstantSet(ctx.constantSetId || "modern-si-2019");
      const res = planckBandEnergyDensity(
        num(ctx.inputs, "nuMin"),
        num(ctx.inputs, "nuMax"),
        num(ctx.inputs, "temperature"),
        set,
      );
      if (res.status !== "value") throw new Error("planckBandEnergyDensity refused inputs.");
      return {
        bandEnergy: res.value,
      };
    },
  },
  {
    id: "radiation.configurations",
    sourcePath: fileURLToPath(new URL("../../physics/reference/radiation.ts", import.meta.url)),
    fn: (ctx) => {
      const res = independentPointsProbability(num(ctx.inputs, "n"), num(ctx.inputs, "f"));
      return {
        configurationProbability: res.value,
        lnW: res.lnW,
        log10W: res.log10W,
      };
    },
  },
  {
    id: "radiation.waves",
    sourcePath: fileURLToPath(new URL("../../physics/reference/radiation.ts", import.meta.url)),
    fn: (ctx) => {
      const res = aperturePower({
        P: num(ctx.inputs, "P"),
        r: num(ctx.inputs, "r"),
        apertureArea: num(ctx.inputs, "apertureArea"),
      });
      if (res.status !== "value") throw new Error("aperturePower refused inputs.");
      return {
        smallAperturePower: res.value.smallAperturePower,
        exactDiskPower: res.value.exactDiskPower,
        relativeDifference: res.value.relativeDifference,
      };
    },
  },
  {
    id: "photoelectric.stoppingPotentialMagnitude",
    sourcePath: fileURLToPath(new URL("../../physics/reference/radiation.ts", import.meta.url)),
    fn: (ctx) => {
      const nu = num(ctx.inputs, "frequency");
      const h = 6.62607015e-34;
      const e = 1.602176634e-19;
      const v = (h * nu) / e;
      return {
        stoppingPotentialMagnitude: v,
      };
    },
  },
];

export const OWNER_REGISTRY: ReadonlyMap<string, OwnerRecord> = new Map(
  OWNERS.map((owner) => [owner.id, owner]),
);

export function getOwner(id: string): OwnerRecord {
  const owner = OWNER_REGISTRY.get(id);
  if (!owner) throw new Error(`Unknown scenario owner "${id}".`);
  return owner;
}

export function ownerSourceMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const owner of OWNER_REGISTRY.values()) out[owner.id] = owner.sourcePath;
  return out;
}
