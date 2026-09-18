import { fileURLToPath } from "node:url";
import { createDeclaredConstantSet, getConstantSet } from "../../physics/reference/constants.ts";
import {
  kernelDiffusivity,
  kernelMoments,
  type WalkKernel,
} from "../../physics/reference/diffusion/walkLaws.ts";
import {
  apparentSpeed,
  intervalProbability,
  rmsDisplacement,
  stokesEinsteinD,
} from "../../physics/reference/diffusion.ts";
import {
  desynchronizationObserved,
  lightClock,
  movingRodLegs,
  movingRodLightLegs,
  properTime,
  synchronizationRound,
} from "../../physics/reference/events.ts";
import {
  chiSquareInterval,
  empiricalCoverageFraction,
  identifiabilityFamily,
  inverseBias,
  invertToMolecularNumber,
} from "../../physics/reference/inference.ts";
import { dilationLossPerSecond } from "../../physics/reference/kinematics.ts";
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
  halfScale,
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
const walkLawsPath = fileURLToPath(
  new URL("../../physics/reference/diffusion/walkLaws.ts", import.meta.url),
);
const eventsPath = fileURLToPath(new URL("../../physics/reference/events.ts", import.meta.url));

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

/**
 * am-bm-05-random-steps-ntzl: a symmetric, unbiased step kernel (coin, uniform, or Gaussian),
 * so kernelDiffusivity's mean is always 0 and diffusion is always a "value" (never
 * outside-domain). `kernel` is encoded numerically (0 coin, 1 uniform, 3 gaussian), reusing
 * WALK_KERNELS' own export-kernel-id numbering (src/physics/reference/diffusion/walkLaws.ts),
 * the same convention content/experiments/tapes/coin-to-bell.yaml uses, because OwnerContext's
 * inputs are Record<string, number> and Bm05Parameters' kernel field is not.
 */
function walkKernelDiffusivity(ctx: OwnerContext): Record<string, number> {
  const kernelCode = num(ctx.inputs, "kernel");
  const kind: WalkKernel = kernelCode === 0 ? "coin" : kernelCode === 1 ? "uniform" : "gaussian";
  const stepRms = num(ctx.inputs, "stepRms");
  const tau = num(ctx.inputs, "tau");
  const moments = kernelMoments({ kind, stepRms });
  const diffusivity = kernelDiffusivity({ kind, stepRms }, tau);
  if (moments.secondMoment.status !== "value" || typeof moments.secondMoment.value !== "number") {
    throw new Error("kernelMoments did not return a second moment value.");
  }
  if (moments.fourthMoment.status !== "value" || typeof moments.fourthMoment.value !== "number") {
    throw new Error("kernelMoments did not return a fourth moment value.");
  }
  if (diffusivity.diffusion.status !== "value" || typeof diffusivity.diffusion.value !== "number") {
    throw new Error("kernelDiffusivity did not return a diffusion value for a symmetric kernel.");
  }
  return {
    stepSecondMoment: moments.secondMoment.value,
    stepFourthMoment: moments.fourthMoment.value,
    diffusionCoefficient: diffusivity.diffusion.value,
  };
}
/**
 * am-bm-06-gaussian-spread-982y: the Gaussian interval probability at t > 0, D > 0 (always
 * "value" status; the t = 0 / D = 0 analytic-limit point-mass case is proven directly against
 * gaussianPropagator/intervalProbability by src/testing/diffusion.*.test.ts files, not through
 * this OwnerFn, which returns Record<string, number> and cannot represent a non-numeric status).
 */
function gaussianIntervalProbability(ctx: OwnerContext): Record<string, number> {
  const D = num(ctx.inputs, "diffusionCoefficient");
  const t = num(ctx.inputs, "elapsedTime");
  const x1 = num(ctx.inputs, "lower");
  const x2 = num(ctx.inputs, "upper");
  const p = intervalProbability(x1, x2, t, D);
  if (p.result.status !== "value" || typeof p.result.value !== "number") {
    throw new Error("intervalProbability did not return a value.");
  }
  return { intervalProbability: p.result.value };
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
    id: "selfTest.halfScale",
    sourcePath: evaluatorPath,
    fn: (ctx) => ({ rmsDisplacement1d: halfScale(num(ctx.inputs, "baselineRms")) }),
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
    id: "diffusion.walkKernelDiffusivity",
    sourcePath: walkLawsPath,
    fn: walkKernelDiffusivity,
  },
  {
    id: "diffusion.gaussianIntervalProbability",
    sourcePath: diffusionPath,
    fn: gaussianIntervalProbability,
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
      if (res.status !== "value")
        throw new Error("bandLimitedMeanQuantumEnergyWien refused inputs.");
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
  {
    id: "inference.molecularNumber",
    sourcePath: fileURLToPath(new URL("../../physics/reference/inference.ts", import.meta.url)),
    fn: (ctx) => {
      const out: Record<string, number> = {};
      if (typeof ctx.inputs.degreesOfFreedom === "number") {
        const bias = inverseBias(ctx.inputs.degreesOfFreedom);
        if (bias.kind === "accepted") out.inverseBiasFactor = bias.data.meanFactor;
      }
      if (typeof ctx.inputs.coverageTrials === "number") {
        const res = empiricalCoverageFraction({
          trials: ctx.inputs.coverageTrials,
          nominalCoverage: ctx.inputs.nominalCoverage,
          degreesOfFreedom: ctx.inputs.degreesOfFreedom,
        });
        if (res.kind === "accepted") {
          out.empiricalCoverageFraction = res.data;
        }
      }
      if (typeof ctx.inputs.diffusionCoefficient !== "number") return out;
      const set = getConstantSet(ctx.constantSetId);
      const dHat = ctx.inputs.diffusionCoefficient;
      const T = ctx.inputs.temperature ?? 293.15;
      const eta = ctx.inputs.viscosity ?? 0.001;
      const a = ctx.inputs.particleRadius ?? 0.5e-6;
      const q = ctx.inputs.degreesOfFreedom ?? 100;
      const family = identifiabilityFamily(
        {
          D: dHat,
          T,
          eta,
          radiusRange: [0.25e-6, 1e-6],
          synthetic: ctx.constantSetId !== "modern-si-2019",
        },
        set,
      );
      if (family.kind === "accepted") {
        out.radiusNumberProduct = family.data.product;
        out.radiusNumberProductMicrometrePerMol = family.data.product * 1e6;
      }
      const band = chiSquareInterval({ dHat, q, alpha: 0.05 });
      if (band.kind !== "accepted") return out;
      const inverse = invertToMolecularNumber(
        {
          T,
          eta,
          a,
          radiusProvenance: "independently-declared",
          dHat,
          interval: band.data,
          synthetic: ctx.constantSetId !== "modern-si-2019",
        },
        set,
      );
      if (inverse.kind === "accepted") {
        out.avogadroNumberEstimate = inverse.data.estimate;
        out.intervalLower = inverse.data.interval.lower;
        out.intervalUpper = inverse.data.interval.upper;
      }
      return out;
    },
  },
  {
    id: "events",
    sourcePath: eventsPath,
    fn: (ctx) => {
      const out: Record<string, number> = {};

      if (
        typeof ctx.inputs.emissionTimeA === "number" &&
        typeof ctx.inputs.receptionTimeA === "number"
      ) {
        const round = synchronizationRound({
          emissionTimeA: ctx.inputs.emissionTimeA,
          receptionTimeA: ctx.inputs.receptionTimeA,
          separationLs: ctx.inputs.separationLs ?? 5,
        });
        if (round.status === "value") {
          out.assignedRemoteTime = round.value.assignedRemoteTime;
          out.roundTripSpeedLsPerS = round.value.roundTripSpeedLsPerS;
          out.criterionOffset = round.value.criterionOffset;
        }
      }

      if (typeof ctx.inputs.separationLs === "number" && typeof ctx.inputs.beta === "number") {
        const legs = movingRodLegs({
          separationLs: ctx.inputs.separationLs,
          beta: ctx.inputs.beta,
        });
        if (legs.status === "value") {
          out.outboundLegS = legs.value.outboundLegS;
          out.returnLegS = legs.value.returnLegS;
          out.tRoundTrip = legs.value.outboundLegS + legs.value.returnLegS;
        }
        const lightLegs = movingRodLightLegs(ctx.inputs.separationLs, ctx.inputs.beta, 1.0);
        if (lightLegs.status === "value") {
          out.desynchronization = lightLegs.value.desynchronization;
        }
      }

      if (
        typeof ctx.inputs.properSeparationLs === "number" &&
        typeof ctx.inputs.beta === "number"
      ) {
        const desync = desynchronizationObserved({
          properSeparationLs: ctx.inputs.properSeparationLs,
          beta: ctx.inputs.beta,
        });
        if (desync.status === "value") {
          out.desyncMagnitudeS = desync.value.desyncMagnitudeS;
        }
      }

      if (typeof ctx.inputs.coordinateTime === "number" && typeof ctx.inputs.beta === "number") {
        const dt = ctx.inputs.coordinateTime;
        const beta = ctx.inputs.beta;
        const prop = properTime(
          {
            kind: "piecewise-inertial",
            segments: [{ t0: 0, t1: dt, vx: beta }],
          },
          0,
          dt,
        );
        if (prop.status === "value") {
          out.properTimeS = prop.value.properTimeS;
          out.timeLossS = prop.value.timeLossS;
          out.ratio = prop.value.ratio;
        }
      }

      if (
        typeof ctx.inputs.beta === "number" &&
        ctx.inputs.coordinateTime === undefined &&
        ctx.inputs.separationLs === undefined &&
        ctx.inputs.properSeparationLs === undefined &&
        ctx.inputs.L0 === undefined
      ) {
        const beta = ctx.inputs.beta;
        const loss = dilationLossPerSecond(beta);
        if (loss.status === "value") {
          out.lossRate = loss.value.exact;
        }
      }

      if (typeof ctx.inputs.L0 === "number" && typeof ctx.inputs.beta === "number") {
        const lc = lightClock(ctx.inputs.L0, ctx.inputs.beta);
        if (lc.status === "value") {
          out.properTickPeriodS = lc.value.properTickPeriodS;
          out.coordinateTickPeriodS = lc.value.coordinateTickPeriodS;
          out.roundTripPathLengthLs = lc.value.roundTripPathLengthLs;
          out.longitudinalDistanceMovedLs = lc.value.longitudinalDistanceMovedLs;
          out.oneWayLightPathLs = lc.value.oneWayLightPathLs;
        }
      }

      return out;
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
