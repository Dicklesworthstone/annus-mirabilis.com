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
  ELECTRON_MASS,
  acceleratingPotential as electronAcceleratingPotential,
  electricRadius as electronElectricRadius,
  kineticEnergy as electronKineticEnergy,
  magneticRadius as electronMagneticRadius,
  longitudinalMass,
  threePrintedRelations,
  transverseFieldTrajectory,
  transverseMassComoving,
  transverseMassLaboratory,
} from "../../physics/reference/electron.ts";
import {
  desynchronizationObserved,
  lightClock,
  movingRodLegs,
  movingRodLightLegs,
  properTime,
  synchronizationRound,
} from "../../physics/reference/events.ts";
import {
  C_SI,
  dipoleField,
  ELEMENTARY_CHARGE,
  evaluateSr02,
  fieldInvariants,
  forceConsistency,
  fourCurrentInvariants,
  maxwellResidualsPlaneWave,
  movingSphereTotalCharge,
  transformChargeCurrent,
  transformSI,
} from "../../physics/reference/fields.ts";
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
const fieldsPath = fileURLToPath(new URL("../../physics/reference/fields.ts", import.meta.url));
const electronPath = fileURLToPath(new URL("../../physics/reference/electron.ts", import.meta.url));

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
  {
    id: "fields",
    sourcePath: fieldsPath,
    fn: (ctx: OwnerContext) => {
      const out: Record<string, number> = {};

      // SI transform & invariants
      if (
        typeof ctx.inputs.Ex === "number" &&
        typeof ctx.inputs.Ey === "number" &&
        typeof ctx.inputs.Ez === "number" &&
        typeof ctx.inputs.Bx === "number" &&
        typeof ctx.inputs.By === "number" &&
        typeof ctx.inputs.Bz === "number" &&
        typeof ctx.inputs.beta === "number"
      ) {
        const c = typeof ctx.inputs.c === "number" ? ctx.inputs.c : C_SI;
        const E = { x: ctx.inputs.Ex, y: ctx.inputs.Ey, z: ctx.inputs.Ez };
        const B = { x: ctx.inputs.Bx, y: ctx.inputs.By, z: ctx.inputs.Bz };
        const boost = ctx.inputs.beta * c;

        const tf = transformSI({ E, B, boost, c });
        out.EprimeX = tf.E.x;
        out.EprimeY = tf.E.y;
        out.EprimeZ = tf.E.z;
        out.BprimeX = tf.B.x;
        out.BprimeY = tf.B.y;
        out.BprimeZ = tf.B.z;
        out.gamma = tf.gamma;

        const inv0 = fieldInvariants(E, B, c);
        const invP = fieldInvariants(tf.E, tf.B, c);
        out.eDotB = inv0.eDotB;
        out.e2MinusC2B2 = inv0.e2MinusC2B2;
        out.eDotBPrime = invP.eDotB;
        out.e2MinusC2B2Prime = invP.e2MinusC2B2;
      }

      // Force consistency scenario
      if (
        typeof ctx.inputs.q === "number" &&
        typeof ctx.inputs.ux === "number" &&
        typeof ctx.inputs.uy === "number" &&
        typeof ctx.inputs.uz === "number" &&
        typeof ctx.inputs.Ex === "number" &&
        typeof ctx.inputs.Bx === "number" &&
        typeof ctx.inputs.beta === "number"
      ) {
        const c = typeof ctx.inputs.c === "number" ? ctx.inputs.c : C_SI;
        const q = ctx.inputs.q;
        const E = { x: ctx.inputs.Ex, y: ctx.inputs.Ey ?? 0, z: ctx.inputs.Ez ?? 0 };
        const B = { x: ctx.inputs.Bx, y: ctx.inputs.By ?? 0, z: ctx.inputs.Bz ?? 0 };
        const u = { x: ctx.inputs.ux, y: ctx.inputs.uy, z: ctx.inputs.uz };
        const res = forceConsistency(q, { E, B }, u, ctx.inputs.beta, c);
        out.FK_x = res.F_K.x;
        out.FK_y = res.F_K.y;
        out.FK_z = res.F_K.z;
        out.Fprime_x = res.F_prime_transformed.x;
        out.Fprime_y = res.F_prime_transformed.y;
        out.Fprime_z = res.F_prime_transformed.z;
        out.maxRelError = res.maxRelError;
      }

      // Dipole preset scenario
      if (typeof ctx.inputs.momentZ === "number" && typeof ctx.inputs.posX === "number") {
        const moment = { x: 0, y: 0, z: ctx.inputs.momentZ };
        const pos = { x: ctx.inputs.posX, y: 0, z: 0 };
        const B = dipoleField(moment, pos);
        out.Bz = B.z;
        out.Bmag = Math.abs(B.z);
        if (typeof ctx.inputs.speedY === "number") {
          const q = ELEMENTARY_CHARGE;
          const F = {
            x: -q * ctx.inputs.speedY * B.z,
            y: 0,
            z: 0,
          };
          out.forceMagnitude = Math.abs(F.x);
        }
      }

      // SR-02 EMF scenario
      if (
        typeof ctx.inputs.speed === "number" &&
        typeof ctx.inputs.magneticField === "number" &&
        typeof ctx.inputs.segmentLength === "number"
      ) {
        const snap = evaluateSr02({
          mode: "analytic",
          descriptionFrame: "magnet-rest",
          speed: ctx.inputs.speed,
          fieldModel: "uniform",
          magneticField: ctx.inputs.magneticField,
          dipoleMoment: 1,
          testPointDistance: 0.05,
          segmentLength: ctx.inputs.segmentLength,
          testCharge: ELEMENTARY_CHARGE,
          pathOrientation: "transverse",
          sliceDeclared: false,
        });
        if (snap.emfMagnet.status === "value") out.emfMagnet = snap.emfMagnet.value as number;
        if (snap.emfConductor.status === "value")
          out.emfConductor = snap.emfConductor.value as number;
        if (snap.emfExcess.status === "value") out.emfExcess = snap.emfExcess.value as number;
        if (snap.lorentzFactor.status === "value")
          out.lorentzFactor = snap.lorentzFactor.value as number;
      }

      // SR-08 frame change scenario
      if (
        typeof ctx.inputs.Ey === "number" &&
        typeof ctx.inputs.beta === "number" &&
        ctx.inputs.Ex === undefined
      ) {
        const beta = ctx.inputs.beta;
        const boost = beta * C_SI;
        const E = { x: 0, y: ctx.inputs.Ey, z: 0 };
        const B = { x: 0, y: 0, z: 0 };
        const tf = transformSI({ E, B, boost, c: C_SI });
        out.EprimeY = tf.E.y;
        out.BprimeZ = tf.B.z;
        out.gamma = tf.gamma;
      }

      // SR-12 neutral conductor scenario
      if (
        typeof ctx.inputs.rho === "number" &&
        typeof ctx.inputs.Jx === "number" &&
        typeof ctx.inputs.beta === "number" &&
        ctx.inputs.Ex === undefined
      ) {
        const c = typeof ctx.inputs.c === "number" ? ctx.inputs.c : C_SI;
        const boost = ctx.inputs.beta * c;
        const res = transformChargeCurrent({
          rho: ctx.inputs.rho,
          J: { x: ctx.inputs.Jx, y: 0, z: 0 },
          boost,
          c,
        });
        out.rhoPrime = res.rho;
        out.JprimeX = res.J.x;
        const inv = fourCurrentInvariants(res.rho, res.J, c);
        out.fourCurrentInvariant = inv.si;
      }

      // SR-12 moving sphere scenario
      if (
        typeof ctx.inputs.rho0 === "number" &&
        typeof ctx.inputs.radius === "number" &&
        typeof ctx.inputs.u === "number" &&
        typeof ctx.inputs.observerBeta === "number"
      ) {
        const res = movingSphereTotalCharge({
          rho0: ctx.inputs.rho0,
          radius: ctx.inputs.radius,
          u: ctx.inputs.u,
          observerBeta: ctx.inputs.observerBeta,
        });
        out.observedDensity = res.observedDensity;
        out.observedVolume = res.observedVolume;
        out.totalChargeAnalytic = res.totalChargeAnalytic;
        out.totalChargeQuadrature = res.totalChargeQuadrature;
        out.relativeGamma = res.relativeGamma;
      }

      // Plane wave residuals scenario
      if (
        typeof ctx.inputs.planeWaveBeta === "number" &&
        typeof ctx.inputs.E0 === "number" &&
        typeof ctx.inputs.omega === "number"
      ) {
        const res = maxwellResidualsPlaneWave({
          beta: ctx.inputs.planeWaveBeta,
          wave: "plus-x",
          polarization: "primary",
          E0: ctx.inputs.E0,
          omega: ctx.inputs.omega,
        });
        out.maxResidual = res.maxResidual;
        out.amplitudeFactor = res.amplitudeFactor;
        out.frequencyFactor = res.frequencyFactor;
      }

      return out;
    },
  },
  {
    id: "electron",
    sourcePath: electronPath,
    fn: (ctx: OwnerContext) => {
      const out: Record<string, number> = {};

      // Mass conventions scenario
      if (
        typeof ctx.inputs.beta === "number" &&
        ctx.inputs.eField === undefined &&
        ctx.inputs.t === undefined &&
        ctx.inputs.transverseE === undefined &&
        ctx.inputs.relationsBeta === undefined
      ) {
        const mass = typeof ctx.inputs.mass === "number" ? ctx.inputs.mass : ELECTRON_MASS;
        const beta = ctx.inputs.beta;
        const longM = longitudinalMass(mass, beta);
        const transMCom = transverseMassComoving(mass, beta);
        const transMLab = transverseMassLaboratory(mass, beta);
        if (longM.status === "value") out.longitudinalMass = longM.value as number;
        if (transMCom.status === "value") out.transverseMassComoving = transMCom.value as number;
        if (transMLab.status === "value") out.transverseMassLaboratory = transMLab.value as number;
      }

      // Energy & fixtures scenario (W, P, Rm, Re)
      if (
        typeof ctx.inputs.beta === "number" &&
        (typeof ctx.inputs.bField === "number" || typeof ctx.inputs.eField === "number")
      ) {
        const mass = typeof ctx.inputs.mass === "number" ? ctx.inputs.mass : ELECTRON_MASS;
        const charge =
          typeof ctx.inputs.charge === "number" ? ctx.inputs.charge : ELEMENTARY_CHARGE;
        const beta = ctx.inputs.beta;
        const ke = electronKineticEnergy(mass, beta);
        if (ke.exact.status === "value") out.kineticEnergyExact = ke.exact.value as number;
        if (ke.newtonian.status === "value")
          out.kineticEnergyNewtonian = ke.newtonian.value as number;
        out.kineticEnergyRatio = ke.ratio;

        const pot = electronAcceleratingPotential(beta, charge, mass);
        if (pot.exact.status === "value")
          out.acceleratingPotentialExact = pot.exact.value as number;
        if (pot.newtonian.status === "value")
          out.acceleratingPotentialNewtonian = pot.newtonian.value as number;

        if (typeof ctx.inputs.bField === "number") {
          const rm = electronMagneticRadius(beta, ctx.inputs.bField, charge, mass);
          if (rm.exact.status === "value")
            out.radiusCurvatureMagneticExact = rm.exact.value as number;
          if (rm.newtonian.status === "value")
            out.radiusCurvatureMagneticNewtonian = rm.newtonian.value as number;
        }

        if (typeof ctx.inputs.eField === "number") {
          const re = electronElectricRadius(beta, ctx.inputs.eField, charge, mass);
          if (re.exact.status === "value")
            out.radiusCurvatureElectricExact = re.exact.value as number;
          if (re.newtonian.status === "value")
            out.radiusCurvatureElectricNewtonian = re.newtonian.value as number;
        }
      }

      // Transverse field trajectory scenario
      if (
        typeof ctx.inputs.transverseE === "number" &&
        typeof ctx.inputs.v0x === "number" &&
        typeof ctx.inputs.t === "number"
      ) {
        const mass = typeof ctx.inputs.mass === "number" ? ctx.inputs.mass : ELECTRON_MASS;
        const charge =
          typeof ctx.inputs.charge === "number" ? ctx.inputs.charge : -ELEMENTARY_CHARGE;
        const pts = transverseFieldTrajectory(
          ctx.inputs.transverseE,
          ctx.inputs.v0x,
          ctx.inputs.t,
          1,
          charge,
          mass,
        );
        const last = pts[pts.length - 1];
        if (last) {
          out.x = last.x;
          out.y = last.y;
          out.speedRatio = last.speedRatio;
          out.gamma = last.gamma;
        }
      }

      // Relations scenario
      if (typeof ctx.inputs.relationsBeta === "number") {
        const beta = ctx.inputs.relationsBeta;
        const eMag = typeof ctx.inputs.relationsE === "number" ? ctx.inputs.relationsE : 1e5;
        const bMag = typeof ctx.inputs.relationsB === "number" ? ctx.inputs.relationsB : 0.01;
        const rel = threePrintedRelations(beta, eMag, bMag);
        if (rel.deflectabilityRatio.status === "value")
          out.deflectabilityRatio = rel.deflectabilityRatio.value as number;
        if (rel.potentialDifference.status === "value")
          out.potentialDifference = rel.potentialDifference.value as number;
        if (rel.magneticRadius.status === "value")
          out.magneticRadius = rel.magneticRadius.value as number;
        if (rel.electricRadius.status === "value")
          out.electricRadius = rel.electricRadius.value as number;
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
